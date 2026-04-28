import mongoose from 'mongoose';

const bookReviewSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    /** Optional 1–5 star rating */
    rating: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true },
);

bookReviewSchema.index({ bookId: 1, userId: 1 }, { unique: true });

export default mongoose.model('BookReview', bookReviewSchema);
