import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || process.env.DB_URL, // supports both
  // Optional comma-separated DNS servers used for Atlas SRV lookup reliability.
  MONGO_DNS_SERVERS: process.env.MONGO_DNS_SERVERS || "8.8.8.8,1.1.1.1",
};