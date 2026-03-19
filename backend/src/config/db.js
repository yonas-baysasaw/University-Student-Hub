import mongoose from "mongoose";
import { ENV } from "./env.js";

 const connectDB = async () => {
  try {
    const conn = await mongoose.connect(ENV.MONGODB_URL);
    console.log(`✅ Connected to MONGODB: ${conn.connection.host}`);
  } catch (error) {
    console.error("💥 MONGODB connection error");
    process.exit(1); // exit code 1 means failure, 0 means success
  }
};

export default connectDB