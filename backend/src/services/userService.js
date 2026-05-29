import crypto from "node:crypto";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import { validatePasswordPolicy } from "../utils/passwordPolicy.js";
import { sendVerificationEmail } from "./verificationEmail.js";

const ensureProviderArray = (user) => {
  if (!Array.isArray(user.provider)) {
    user.provider = [];
  }
};

/**
 * @param {object} params
 * @param {string} [params.username]
 * @param {string} params.email
 * @param {string} params.password
 * @param {string} [params.accountType]
 * @param {string} [params.department]
 * @param {unknown} [params.schoolYear]
 */
export const createLocalUser = async ({
  username,
  email,
  password,
  accountType,
  department,
  schoolYear,
}) => {
  if (!email || !password) {
    const error = new Error("Email and password are required");
    error.status = 400;
    throw error;
  }

  const passwordCheck = validatePasswordPolicy(password);
  if (!passwordCheck.valid) {
    const error = new Error(passwordCheck.message);
    error.status = 400;
    throw error;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const atype =
    String(accountType || "student").toLowerCase() === "instructor"
      ? "instructor"
      : "student";

  let dept = typeof department === "string" ? department.trim() : "";
  let yearNum =
    schoolYear === "" || schoolYear === null || schoolYear === undefined
      ? NaN
      : Number(schoolYear);

  if (atype === "student") {
    if (!dept) {
      const error = new Error("Department is required for students");
      error.status = 400;
      throw error;
    }
    if (!Number.isFinite(yearNum) || yearNum < 1 || yearNum > 7) {
      const error = new Error("School year must be between 1 and 7");
      error.status = 400;
      throw error;
    }
  } else {
    dept = "";
    yearNum = NaN;
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    const error = new Error("Email already in use");
    error.status = 409;
    throw error;
  }

  const token = crypto.randomBytes(20).toString("hex");
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    username: typeof username === "string" ? username.trim() : username,
    email: normalizedEmail,
    password: hashedPassword,
    provider: ["local"],
    accountType: atype,
    department: atype === "student" ? dept : undefined,
    schoolYear: atype === "student" ? Math.round(yearNum) : undefined,
    email_verified: false,
    emailVerificationToken: token,
    emailVerificationExpires: Date.now() + 48 * 3600000,
  });

  try {
    await sendVerificationEmail({ to: user.email, token });
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  return user;
};

/**
 * Creates an administrator account (local password). Email verification is not required for portal admins.
 * Bootstrap / invite-key rules are enforced by the caller route only.
 */
export const createPortalAdminUser = async ({ username, email, password }) => {
  if (!email || !password) {
    const error = new Error("Email and password are required");
    error.status = 400;
    throw error;
  }

  const passwordCheck = validatePasswordPolicy(password);
  if (!passwordCheck.valid) {
    const error = new Error(passwordCheck.message);
    error.status = 400;
    throw error;
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    const error = new Error("Email already in use");
    error.status = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    username: typeof username === "string" ? username.trim() : username,
    email: normalizedEmail,
    password: hashedPassword,
    provider: ["local"],
    accountType: "instructor",
    role: "admin",
    email_verified: true,
  });

  return user;
};

export const findOrLinkGoogleUser = async (profile) => {
  const email = profile.emails?.[0]?.value?.trim?.().toLowerCase?.() ?? null;
  let user = await User.findOne({ googleId: profile.id });

  if (!user && email) {
    user = await User.findOne({ email });
    if (user) {
      ensureProviderArray(user);
      if (!user.provider.includes("google")) {
        user.provider.push("google");
      }
      user.googleId = profile.id;
      user.name ||= profile.displayName;
      user.avatar ||= profile?.photos?.[0]?.value;
      user.email_verified = true;
      await user.save();
      return user;
    }
  }

  if (user) {
    return user;
  }

  return User.create({
    googleId: profile.id,
    name: profile.displayName,
    email,
    provider: ["google"],
    avatar: profile?.photos?.[0]?.value,
    email_verified: true,
  });
};

export const getUserById = (id) => User.findById(id);

export const updateUserAvatar = async (userId, avatarUrl) => {
  if (!userId) {
    const error = new Error("User id is required");
    error.status = 400;
    throw error;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { avatar: avatarUrl },
    { returnDocument: 'after', runValidators: true },
  );

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  return user;
};

export const findByIdentifier = async (identifier) => {
  const raw = typeof identifier === "string" ? identifier.trim() : "";
  if (!raw) return null;
  const isEmail = raw.includes("@");
  const query = isEmail ? { email: raw.toLowerCase() } : { username: raw };
  return User.findOne(query);
};
