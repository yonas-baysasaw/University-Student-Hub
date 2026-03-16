import mongoose from "mongoose";
import dns from "node:dns";
import { ENV } from "./env.js";

export const connectDB = async () => {
  const dnsServers = ENV.MONGO_DNS_SERVERS.split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (dnsServers.length) {
  
    dns.setServers(dnsServers);
  }

  try {
    const conn = await mongoose.connect(ENV.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (error.message?.includes("querySrv ECONNREFUSED")) {
      console.error(
        "Mongo SRV lookup failed. Verify internet access and MongoDB Atlas network access list, or override MONGO_DNS_SERVERS in backend/.env."
      );
    }
    process.exit(1);
  }
};