import mongoose from 'mongoose';

const bookChunkSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      required: true,
    },
    embeddingModel: {
      type: String,
      default: 'gemini-embedding-001',
    },
  },
  { timestamps: true },
);

bookChunkSchema.index({ book: 1, chunkIndex: 1 }, { unique: true });

export default mongoose.model('BookChunk', bookChunkSchema);
