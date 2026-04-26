import mongoose from 'mongoose';

const attemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
      index: true,
    },
    // Parallel array to exam questions; null means unanswered, number = selected option index
    answers: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    flaggedQuestions: {
      type: [Number],
      default: [],
    },
    score: {
      type: Number,
      default: 0,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

attemptSchema.index({ userId: 1, examId: 1 });

export default mongoose.model('Attempt', attemptSchema);
