import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    targetType: {
      type: String,
      enum: ['user', 'book', 'classroom', 'event', 'message'],
      required: true,
      index: true,
    },
    targetId: {
      type: String,
      required: true,
      index: true,
    },
    /** Legacy single field; newer reports also set reasonCode + reasonLabel */
    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    reasonCode: {
      type: String,
      trim: true,
      maxlength: 80,
      index: true,
    },
    reasonLabel: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    status: {
      type: String,
      enum: [
        'pending',
        'reviewed',
        'resolved',
        'rejected',
        'open',
        'reviewing',
        'dismissed',
      ],
      default: 'pending',
      index: true,
    },
    /** @deprecated prefer adminNote */
    resolution: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    adminNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  { timestamps: true },
);

reportSchema.index(
  { reporter: 1, targetType: 1, targetId: 1 },
  { name: 'report_reporter_target' },
);

export default mongoose.model('Report', reportSchema);
