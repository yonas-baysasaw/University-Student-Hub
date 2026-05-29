import mongoose from 'mongoose';

const referenceSchema = new mongoose.Schema(
  {
    bookId: { type: String, default: '' },
    bookTitle: { type: String, default: '' },
    excerptNumber: { type: Number, default: 0 },
    chapter: { type: String, default: '' },
    section: { type: String, default: '' },
    pageStart: { type: Number, default: null },
    pageEnd: { type: Number, default: null },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    references: { type: [referenceSchema], default: undefined },
    grounding: {
      type: String,
      enum: ['book', 'library', 'none'],
      default: undefined,
    },
  },
  { timestamps: true },
);

const chatSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** 'liqu' = Study buddy / Liqu AI; 'support' = help widget (excluded from Liqu session list). */
    kind: {
      type: String,
      enum: ['liqu', 'support'],
      default: 'liqu',
      index: true,
    },
    title: { type: String, default: 'New chat' },
    messages: [messageSchema],
  },
  { timestamps: true },
);

export default mongoose.model('ChatSession', chatSessionSchema);
