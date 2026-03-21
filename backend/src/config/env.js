import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.PORT ?? '4000');
const NODE_ENV = process.env.NODE_ENV ?? 'development';

const secureOverride = process.env.SESSION_COOKIE_SECURE?.toLowerCase();
const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const defaultSecureCookie =
  NODE_ENV === 'production' && frontendUrl.startsWith('https://');
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
  PORT,
  NODE_ENV,
  isProduction: NODE_ENV === 'production',
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'change-me',
  MONGODB_URL: process.env.MONGODB_URL ?? '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL ?? '/api/auth/google/callback',
  EMAIL_USER: process.env.EMAIL_USER ?? '',
  EMAIL_PASS: process.env.EMAIL_PASS ?? '',
  FRONTEND_URL: frontendUrl,
  SESSION_COOKIE_SECURE: secureCookies
};
