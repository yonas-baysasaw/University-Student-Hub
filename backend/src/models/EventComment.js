import mongoose from 'mongoose';

const eventCommentSchema = new mongoose.Schema(
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
      maxlength: 2000,
    },
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EventComment',
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

eventCommentSchema.index({ eventId: 1, createdAt: 1 });

export default mongoose.model('EventComment', eventCommentSchema);
