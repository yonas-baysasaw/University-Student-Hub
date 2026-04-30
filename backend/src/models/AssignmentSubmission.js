import mongoose from 'mongoose';

const filePartSchema = new mongoose.Schema(
  {
    fileKey: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileMimeType: { type: String, default: '' },
  },
  { _id: false },
);

const assignmentSubmissionSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true,
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
      maxlength: 4000,
    },
    files: {
      type: [filePartSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['submitted', 'graded', 'returned'],
      default: 'submitted',
    },
    score: {
      type: Number,
      default: null,
      min: 0,
    },
    feedback: {
      type: String,
      default: '',
      trim: true,
      maxlength: 8000,
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    gradedAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    /** True if submitted after dueAt but within allowLateUntil. */
    isLate: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

assignmentSubmissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

export default mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);
