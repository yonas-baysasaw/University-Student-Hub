import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
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
