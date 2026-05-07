import crypto from "node:crypto";
import express from "express";
import { ENV } from "../config/env.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { createRateLimiter } from "../middlewares/rateLimit.js";
import User from "../models/User.js";
import { createPortalAdminUser } from "../services/userService.js";
import { toPublicUser } from "../utils/userSerializer.js";

const router = express.Router();

const registerLimiter = createRateLimiter({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max: ENV.RATE_LIMIT_REGISTER_MAX,
  keyFn: (req) => `register-admin:${req.ip}`,
});

function inviteKeysMatch(provided, expected) {
  const p = String(provided ?? "").trim();
  const e = String(expected ?? "").trim();
  if (!e || p.length !== e.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(p, "utf8"), Buffer.from(e, "utf8"));
  } catch {
    return false;
  }
}

async function countExistingAdmins() {
  return User.countDocuments({ role: "admin" });
}

router.get(
  "/meta",
  asyncHandler(async (_req, res) => {
    const secretOn = ENV.ADMIN_REGISTRATION_SECRET.length > 0;
    const existingAdmins = await countExistingAdmins();
    const acceptingRegistrations = secretOn || existingAdmins === 0;
    const inviteKeyRequired = secretOn;
    res.json({ acceptingRegistrations, inviteKeyRequired });
  }),
);

router.post(
  "/",
  registerLimiter,
  asyncHandler(async (req, res) => {
    const secretOn = ENV.ADMIN_REGISTRATION_SECRET.length > 0;
    const existingAdmins = await countExistingAdmins();

    let authorized = false;
    if (secretOn) {
      authorized = inviteKeysMatch(
        req.body?.adminInviteKey,
        ENV.ADMIN_REGISTRATION_SECRET,
      );
    } else if (existingAdmins === 0) {
      authorized = true;
    }

    if (!authorized) {
      return res.status(403).json({
        message:
          "Administrator self-registration is not available. Use an invite key if your deployment requires one, or ask an existing administrator to promote your account.",
      });
    }

    const { username, email, password } = req.body;

    const user = await createPortalAdminUser({
      username,
      email,
      password,
    });

    res.status(201).json({
      user: toPublicUser(user),
      message:
        "Administrator account created. Sign in at the admin portal to open the dashboard.",
    });
  }),
);

export default router;
