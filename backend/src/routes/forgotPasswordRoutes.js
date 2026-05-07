import crypto from "node:crypto";
import express from "express";
import { ENV } from "../config/env.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { createRateLimiter } from "../middlewares/rateLimit.js";
import User from "../models/User.js";
import {
  createMailTransporter,
  getMailFrom,
} from "../services/mailTransporter.js";

const router = express.Router();

const forgotPasswordLimiter = createRateLimiter({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max: ENV.RATE_LIMIT_FORGOT_MAX,
  keyFn: (req) => `forgot:${req.ip}`,
});

router.post(
  "/",
  forgotPasswordLimiter,
  asyncHandler(async (req, res) => {
    const rawEmail = req.body?.email;
    const email =
      typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

    const genericMessage =
      "If an account exists for this email, we sent password reset instructions.";

    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "Please provide a valid email." });
    }

    const user = await User.findOne({ email });
    const transport = createMailTransporter();
    const from = getMailFrom();

    if (user?.password && transport && from) {
      const token = crypto.randomBytes(20).toString("hex");
      user.resetPasswordToken = token;
      user.resetPasswordExpires = Date.now() + 3600000;
      await user.save();

      const resetURL = `${(ENV.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "")}/reset-password/${token}`;

      await transport.sendMail({
        to: user.email,
        from,
        subject: "Password reset — University Student Hub",
        text: `Reset your password using this link (valid for one hour):\n${resetURL}\n\nIf you did not request a reset, you can ignore this email.\n`,
        html: `<p>Reset your University Student Hub password using the link below (valid for one hour):</p>
<p><a href="${resetURL.replace(/"/g, "&quot;")}">Set a new password</a></p>
<p style="font-size:0.88em;color:#64748b;">If you did not request this, you can ignore this email.</p>`,
      });
    }

    res.json({ message: genericMessage });
  }),
);

export default router;
