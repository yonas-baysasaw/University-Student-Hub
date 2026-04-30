import mongoose from 'mongoose';

const readingListSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    bookIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
      },
    ],
  },
  { timestamps: true },
);

readingListSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model('ReadingList', readingListSchema);
