import dotenv from 'dotenv';

dotenv.config();
const secureOverride = process.env.SESSION_COOKIE_SECURE?.toLowerCase();
const defaultSecureCookie =
process.env.PORT === 'production' && process.env.FRONTEND_URL.startsWith('https://');
const secureCookies =
  secureOverride === 'true'
    ? true
    : secureOverride === 'false'
      ? false
      : defaultSecureCookie;


const requiredVars = ['SESSION_SECRET', 'MONGODB_URL'];
const missingVars = requiredVars.filter((key) => !process.env[key]);
if (missingVars.length) {
  console.warn(`Missing environment variables: ${missingVars.join(', ')}`);
}

export const ENV = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  isProduction: process.env.NODE_ENV === 'production',
  SESSION_SECRET: process.env.SESSION_SECRET,
  MONGODB_URL: process.env.MONGODB_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL ?? '/api/auth/google/callback',
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  FRONTEND_URL: process.env.FRONTEND_URL,
  // SESSION_COOKIE_SECURE: secureCookies
};
