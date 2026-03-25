import dotenv from 'dotenv';

dotenv.config();

const toBoolean = value => String(value).toLowerCase() === 'true';

export const ENV = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  SESSION_SECRET: process.env.SESSION_SECRET || 'replace-with-secure-secret',
  SESSION_COOKIE_SECURE: toBoolean(process.env.SESSION_COOKIE_SECURE),
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_URL: process.env.MONGODB_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL ?? '/api/auth/google/callback',
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  FRONTEND_URL: process.env.FRONTEND_URL,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
};
