/**
 * One-time migration: remove legacy embedding fields from `bookchunks`.
 *
 * Run:
 *   node scripts/remove-bookchunk-embedding-fields.mjs
 *
 * Requires MONGODB_URL or MONGODB_URI in .env.
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
  const col = mongoose.connection.db.collection("bookchunks");
  const result = await col.updateMany(
    {},
    { $unset: { embedding: "", embeddingModel: "" } },
  );
  console.log(
    `[remove-bookchunk-embedding-fields] matched=${result.matchedCount} modified=${result.modifiedCount}`,
  );
} catch (err) {
  console.error("[remove-bookchunk-embedding-fields]", err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}

