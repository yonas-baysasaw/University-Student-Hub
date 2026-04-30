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
    /** Catalog metadata (PDF imports + optional on composed papers) */
    academicTrack: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    department: {
      type: String,
      default: '',
      trim: true,
      maxlength: 160,
    },
    courseSubject: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    /** exit / mock / model / final / midterm / other */
    paperType: {
      type: String,
      enum: [
        'exit_exam',
        'mock_exit_exam',
        'model_exit_exam',
        'final_exam',
        'midterm',
        'other',
      ],
      default: 'other',
      index: true,
    },
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    dislikesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    savesCount: {
      type: Number,
      default: 0,
      min: 0,
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

// Sync hook — do not call next(); Mongoose 9 may not pass it (causes "next is not a function").
examSchema.pre('validate', function () {
  if (this.examKind === 'vault_compiled') {
    return;
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
});

examSchema.index({ contentHash: 1, processingStatus: 1 });
examSchema.index({ filename: 'text', subject: 'text', topic: 'text', department: 'text', courseSubject: 'text' });

export default mongoose.model('Exam', examSchema);
