import dotenv from "dotenv";

dotenv.config();

const splitEnvEmails = (raw) =>
  String(raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const adminEmailsPrimary = splitEnvEmails(process.env.ADMIN_EMAILS);
const adminEmailsLegacy = splitEnvEmails(process.env.STAFF_EMAILS);

const ADMIN_EMAILS_RESOLVED = adminEmailsPrimary.length
  ? adminEmailsPrimary
  : adminEmailsLegacy;

if (!adminEmailsPrimary.length && adminEmailsLegacy.length) {
  console.warn(
    "[env] STAFF_EMAILS is deprecated; set ADMIN_EMAILS instead (comma-separated addresses promoted on startup).",
  );
}

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
  EMAIL_FROM: process.env.EMAIL_FROM,
  FRONTEND_URL: process.env.FRONTEND_URL,
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
  GEMINI_MODEL_ID: process.env.GEMINI_MODEL_ID,
  GEMINI_EMBED_MODEL_ID:
    process.env.GEMINI_EMBED_MODEL_ID || "text-embedding-004",
  RAG_VECTOR_INDEX_NAME:
    process.env.RAG_VECTOR_INDEX_NAME || "book_chunks_vector_index",
  ADMIN_EMAILS: ADMIN_EMAILS_RESOLVED,
  ADMIN_REGISTRATION_SECRET: String(
    process.env.ADMIN_REGISTRATION_SECRET ?? "",
  ).trim(),
};
