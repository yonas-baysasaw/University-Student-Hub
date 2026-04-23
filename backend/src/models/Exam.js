import mongoose from 'mongoose';

const examSchema = new mongoose.Schema(
  {
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileKey: {
      type: String,
      required: true,
    },
    // SHA-256 hash of extracted text content for deduplication
    contentHash: {
      type: String,
      index: true,
    },
    textContent: {
      type: String,
      default: '',
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'complete', 'failed'],
      default: 'pending',
      index: true,
    },
    processingError: {
      type: String,
      default: '',
    },
    subject: {
      type: String,
      default: '',
      trim: true,
    },
    topic: {
      type: String,
      default: '',
      trim: true,
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
      index: true,
    },
    // True when this exam is a duplicate pointing to original's questions
    isDuplicate: {
      type: Boolean,
      default: false,
    },
    originalExamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      default: null,
    },
  },
  { timestamps: true },
);

examSchema.index({ contentHash: 1, processingStatus: 1 });
examSchema.index({ title: 'text', subject: 'text', topic: 'text' });

export default mongoose.model('Exam', examSchema);
