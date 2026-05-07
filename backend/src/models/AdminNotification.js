import mongoose from 'mongoose';

const adminNotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    audience: {
      type: String,
      enum: ['all', 'students', 'instructors', 'department'],
      default: 'all',
      index: true,
    },
    department: {
      type: String,
      trim: true,
      maxlength: 140,
    },
    channel: {
      type: String,
      enum: ['email', 'in_app', 'both'],
      default: 'email',
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    recipientCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'failed'],
      default: 'sent',
      index: true,
    },
    error: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true },
);

export default mongoose.model('AdminNotification', adminNotificationSchema);
