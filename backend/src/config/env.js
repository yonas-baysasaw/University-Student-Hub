import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  isProduction: process.env.NODE_ENV === "production",
  SESSION_SECRET: process.env.SESSION_SECRET,
  MONGODB_URL: process.env.MONGODB_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  /** Optional display/from address (must be allowed by Gmail). */
  EMAIL_FROM: process.env.EMAIL_FROM,
  /** Base URL for links in transactional email (verify, reset). Omit trailing slash. */
  FRONTEND_URL: process.env.FRONTEND_URL,
  /** Rate limits (per-window max requests). */
  RATE_LIMIT_WINDOW_MS: (() => {
    const n = parseInt(
      String(process.env.RATE_LIMIT_WINDOW_MS || "900000"),
      10,
    );
    return Number.isFinite(n) && n > 0 ? n : 900_000;
  })(),
  RATE_LIMIT_REGISTER_MAX: (() => {
    const n = parseInt(String(process.env.RATE_LIMIT_REGISTER_MAX || "5"), 10);
    return Number.isFinite(n) && n > 0 ? n : 5;
  })(),
  RATE_LIMIT_FORGOT_MAX: (() => {
    const n = parseInt(String(process.env.RATE_LIMIT_FORGOT_MAX || "5"), 10);
    return Number.isFinite(n) && n > 0 ? n : 5;
  })(),
  RATE_LIMIT_RESEND_MAX: (() => {
    const n = parseInt(String(process.env.RATE_LIMIT_RESEND_MAX || "5"), 10);
    return Number.isFinite(n) && n > 0 ? n : 5;
  })(),
  SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE === "true",
  AWS_REGION: process.env.AWS_REGION,
  AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL_ID: process.env.GEMINI_MODEL_ID || "gemini-2.0-flash",
  /** RAG `embedContent` model id (path segment after `models/`). */
  GEMINI_EMBEDDING_MODEL:
    process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
  /**
   * Milliseconds for TCP/TLS connect to `generativelanguage.googleapis.com`.
   * Node’s default `fetch` (Undici) uses 10s — too low on slow networks.
   */
  GEMINI_HTTP_CONNECT_TIMEOUT_MS: (() => {
    const n = parseInt(
      String(process.env.GEMINI_HTTP_CONNECT_TIMEOUT_MS || "90000"),
      10,
    );
    return Number.isFinite(n) && n >= 5_000 ? n : 90_000;
  })(),
  /**
   * Comma-separated emails promoted to staff on server start (no auto-demotion).
   */
  STAFF_EMAILS: (() => {
    const raw = process.env.STAFF_EMAILS || "";
    return raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  })(),
  /**
   * When set, every admin self-registration must send this key (body.adminInviteKey).
   * When unset, only the first admin/staff bootstrap is allowed (no existing admin or staff).
   */
  ADMIN_REGISTRATION_SECRET: String(
    process.env.ADMIN_REGISTRATION_SECRET ?? "",
  ).trim(),
};
