import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
      index: true,
    },
    // Position within the exam (0-based index from AI extraction)
    questionIndex: {
      type: Number,
      required: true,
    },
    question: {
      type: String,
      required: true,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => arr.length >= 2 && arr.length <= 5,
        message: 'Questions must have between 2 and 5 options',
      },
    },
    // Zero-based index into options array
    correctAnswer: {
      type: Number,
      required: true,
    },
    explanation: {
      type: String,
      default: '',
    },
    batchNumber: {
      type: Number,
      default: 1,
    },
    source: {
      type: String,
      enum: ['ai', 'manual'],
      default: 'ai',
    },
  },
  { timestamps: true },
);

questionSchema.index({ examId: 1, questionIndex: 1 }, { unique: true });

export default mongoose.model('Question', questionSchema);
