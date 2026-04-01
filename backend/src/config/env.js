import dotenv from 'dotenv';

dotenv.config();

export const ENV = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  isProduction: process.env.NODE_ENV,
  SESSION_SECRET: process.env.SESSION_SECRET ,
  SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE,
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_URL: process.env.MONGODB_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL ,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  FRONTEND_URL: process.env.FRONTEND_URL,
  AWS_REGION : process.env.AWS_REGION,
  AWS_BUCKET_NAME : process.env.AWS_BUCKET_NAME,
  AWS_ACCESS_KEY_ID : process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY : process.env.AWS_SECRET_ACCESS_KEY,
  AWS_SESSION_TOKEN : process.env.AWS_SESSION_TOKEN,
};
