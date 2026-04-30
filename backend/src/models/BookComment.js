import mongoose from 'mongoose';

const bookCommentSchema = new mongoose.Schema(
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
      maxlength: 2000,
    },
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BookComment',
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

bookCommentSchema.index({ bookId: 1, createdAt: 1 });

export default mongoose.model('BookComment', bookCommentSchema);
