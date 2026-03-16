import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always load backend/.env even when the process is started from the repo root.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const ENV = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT || 5000,
  // Prefer MONGO_URI but keep DB_URL as a fallback for older configs.
  MONGO_URI: process.env.MONGO_URI || process.env.DB_URL,
  MONGO_DNS_SERVERS: process.env.MONGO_DNS_SERVERS,
};
