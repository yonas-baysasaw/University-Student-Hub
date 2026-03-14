import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT||5000,
  DB_URL: process.env.DB_URL,
};
