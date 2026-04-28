import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      maxlength: 5000,
      default: '',
    },
    bookUrl: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
      default: '',
    },

    format: {
      type: String,
      default: String,
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'public',
      index: true,
    },

    /** Library catalog metadata (required on new uploads via upload controller) */
    academicTrack: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    department: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    publishYear: {
      type: Number,
      default: null,
    },
    courseSubject: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    views: {
      type: Number,
      default: 0,
    },
    likesCount: {
      type: Number,
      default: 0,
    },
    dislikesCount: {
      type: Number,
      default: 0,
    },
    likedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    dislikedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    savedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    viewedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    /** Liqu AI RAG: background indexing + progress (not the same as exam batching). */
    ragIndexStatus: {
      type: String,
      enum: ['idle', 'indexing', 'ready', 'failed'],
      default: 'idle',
      index: true,
    },
    ragIndexPhase: {
      type: String,
      default: '',
    },
    ragIndexTotalChunks: {
      type: Number,
      default: 0,
    },
    ragIndexDoneChunks: {
      type: Number,
      default: 0,
    },
    ragIndexError: {
      type: String,
      default: '',
    },
    ragIndexedAt: {
      type: Date,
    },
    /** Approximate 0–100% for UI while indexing. */
    ragIndexProgressPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true },
);

bookSchema.index({ title: 'text', description: 'text' });

export default mongoose.model('Book', bookSchema);
