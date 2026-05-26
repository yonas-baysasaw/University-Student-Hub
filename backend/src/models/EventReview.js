import mongoose from 'mongoose';

const eventReviewSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
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
    rating: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true },
);

eventReviewSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export default mongoose.model('EventReview', eventReviewSchema);
