import dotenv from "dotenv";

dotenv.config();

export const ENV = {
PORT:process.env.PORT,
GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
SESSION_SECRET: process.env.SESSION_SECRET,
MONGODB_URL: process.env.MONGODB_URL,
EMAIL_USER: process.env.EMAIL_USER,
EMAIL_PASS: process.env.EMAIL_PASS,
NODE_ENV: process.env.NODE_ENV,
};
