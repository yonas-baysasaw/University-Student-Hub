import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      maxlength: 5000,
      default: '',
    },
    startsAt: {
      type: Date,
      required: true,
      index: true,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    location: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
    meetingUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    /** null or 0 = unlimited */
    capacity: {
      type: Number,
      default: null,
    },
    reservedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
    },
    dislikesCount: {
      type: Number,
      default: 0,
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
  },
  { timestamps: true },
);

eventSchema.index({ startsAt: 1, createdAt: -1 });

export default mongoose.model('Event', eventSchema);
