/**
 * One-time migration: legacy role "staff" -> "admin".
 *
 * Run BEFORE deploying code that removes "staff" from the User schema enum:
 *   node scripts/migrate-staff-to-admin.mjs
 *
 * Requires MONGODB_URL or MONGODB_URI in .env (same as the API server).
 */
import "dotenv/config";
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI || process.env.MONGODB_URL;
if (!uri) {
  console.error(
    "Missing MONGODB_URL or MONGODB_URI. Load backend/.env or export the variable.",
  );
  process.exit(1);
}

try {
  await mongoose.connect(uri);
  const col = mongoose.connection.db.collection("users");
  const result = await col.updateMany(
    { role: "staff" },
    { $set: { role: "admin" } },
  );
  console.log(
    `[migrate-staff-to-admin] matched=${result.matchedCount} modified=${result.modifiedCount}`,
  );
} catch (err) {
  console.error("[migrate-staff-to-admin]", err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
