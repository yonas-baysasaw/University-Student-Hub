import mongoose from 'mongoose';

const examSchema = new mongoose.Schema(
  {
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** `pdf`: uploaded extraction; `vault_compiled`: published from user's private vault. */
    examKind: {
      type: String,
      enum: ['pdf', 'vault_compiled'],
      default: 'pdf',
      index: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    fileUrl: {
      type: String,
      default: '',
    },
    fileKey: {
      type: String,
      default: '',
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

examSchema.pre('validate', function (next) {
  if (this.examKind === 'vault_compiled') {
    return next();
  }
  if (!this.fileUrl?.trim()) {
    this.invalidate('fileUrl', 'PDF exams require a file URL');
  }
  if (!this.fileKey?.trim()) {
    this.invalidate('fileKey', 'PDF exams require a file key');
  }
  if (this.fileSize == null || this.fileSize <= 0) {
    this.invalidate('fileSize', 'PDF exams require a positive file size');
  }
  next();
});

examSchema.index({ contentHash: 1, processingStatus: 1 });
examSchema.index({ filename: 'text', subject: 'text', topic: 'text' });

export default mongoose.model('Exam', examSchema);
