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
    /** Image URLs (e.g. S3) for gallery; max length enforced in controller */
    mediaUrls: {
      type: [String],
      default: [],
      validate: {
        validator(arr) {
          return !Array.isArray(arr) || arr.length <= 12;
        },
        message: 'At most 12 images allowed per event.',
      },
    },

    visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'public',
      index: true,
    },

    /** Catalog metadata (required on create; legacy events may omit) */
    academicTrack: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    department: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    publishYear: {
      type: Number,
      default: null,
    },
    courseSubject: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
  },
  { timestamps: true },
);

eventSchema.index({ startsAt: 1, createdAt: -1 });

export default mongoose.model('Event', eventSchema);
