import mongoose from 'mongoose';

const personalMcqSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) =>
          Array.isArray(arr) && arr.length >= 2 && arr.length <= 5,
        message: 'Questions must have between 2 and 5 options',
      },
    },
    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
    },
    explanation: {
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
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) =>
          Array.isArray(arr) &&
          arr.length <= 20 &&
          arr.every((t) => String(t).length <= 48 && String(t).length > 0),
      },
    },
    difficulty: {
      type: Number,
      default: 3,
      min: 1,
      max: 5,
    },
    revisionNote: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    clonedFromExamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      default: null,
    },
    clonedFromQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      default: null,
    },
  },
  { timestamps: true },
);

personalMcqSchema.pre('validate', function (next) {
  const n = this.options?.length ?? 0;
  if (n > 0 && this.correctAnswer >= n) {
    this.invalidate(
      'correctAnswer',
      `correctAnswer must be less than options length (${n})`,
    );
  }
  next();
});

personalMcqSchema.index({ owner: 1, updatedAt: -1 });
personalMcqSchema.index({ owner: 1, subject: 1 });

export default mongoose.model('PersonalMcq', personalMcqSchema);
