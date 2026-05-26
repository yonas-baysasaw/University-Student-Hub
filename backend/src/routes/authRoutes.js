import crypto from "node:crypto";
import express from "express";
import passport from "passport";
import { loginSuccess, logout } from "../controllers/authcontroller.js";
import { ENV } from "../config/env.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { createRateLimiter } from "../middlewares/rateLimit.js";
import User from "../models/User.js";
import { sendVerificationEmail } from "../services/verificationEmail.js";

const router = express.Router();

const resendLimiter = createRateLimiter({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max: ENV.RATE_LIMIT_RESEND_MAX,
  keyFn: (req) => {
    const raw = req.body?.email;
    const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    return `resend:${req.ip}:${email}`;
  },
});

const ensureIdentifier = (req, _res, next) => {
  if (!req.body.identifier) {
    if (req.body.email) {
      req.body.identifier = req.body.email;
    } else if (req.body.username) {
      req.body.identifier = req.body.username;
    }
  }
  next();
};

router.post("/login", ensureIdentifier, (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({
        message: info?.message || "Invalid credentials",
      });
    }

    // Enforce email verification for non-admin local accounts before session login.
    const hasLocalPassword = Boolean(user.password);
    const isAdmin = user.role === "admin";
    if (hasLocalPassword && !isAdmin && user.email_verified !== true) {
      return res.status(401).json({
        message:
          "VERIFY_EMAIL: Please verify your email before signing in. You can resend the confirmation email from the sign-in page.",
      });
    }

    return req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      return loginSuccess(req, res);
    });
  })(req, res, next);
});

router.post(
  "/resend-verification",
  resendLimiter,
  asyncHandler(async (req, res) => {
    const raw = req.body?.email;
    const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";

    const genericMessage =
      "If this address has an unverified account, we sent a new confirmation link.";

    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "Please provide a valid email." });
    }

    try {
      const user = await User.findOne({ email }).select(
        "+emailVerificationToken +emailVerificationExpires",
      );

      if (user?.password && user.email_verified === false) {
        const hasUsableToken =
          typeof user.emailVerificationToken === "string" &&
          user.emailVerificationToken.trim().length > 0 &&
          user.emailVerificationExpires &&
          new Date(user.emailVerificationExpires).getTime() > Date.now();

        const token = hasUsableToken
          ? user.emailVerificationToken
          : crypto.randomBytes(20).toString("hex");

        if (!hasUsableToken) {
          user.emailVerificationToken = token;
          user.emailVerificationExpires = Date.now() + 48 * 3600000;
          await user.save();
        }

        const verifyNext =
          user.role === "admin" ? "/admin" : undefined;
        await sendVerificationEmail({
          to: user.email,
          token,
          verifyNext,
        });
      }
    } catch (e) {
      console.error("[resend-verification]", e);
    }

    res.json({ message: genericMessage });
  }),
);

router.get("/logout", logout);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (_req, res) => {
    res.redirect("/");
  },
);

export default router;
