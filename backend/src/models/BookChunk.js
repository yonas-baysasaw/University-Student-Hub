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
    chapter: {
      type: String,
      default: '',
      index: true,
    },
    section: {
      type: String,
      default: '',
    },
    pageStart: {
      type: Number,
      default: null,
    },
    pageEnd: {
      type: Number,
      default: null,
    },
    embedding: {
      type: [Number],
      default: [],
      select: false,
    },
  },
  { timestamps: true },
);

bookChunkSchema.index({ book: 1, chunkIndex: 1 }, { unique: true });
bookChunkSchema.index({ text: 'text' });

export default mongoose.model('BookChunk', bookChunkSchema);
