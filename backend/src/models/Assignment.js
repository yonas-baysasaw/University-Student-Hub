import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    instructions: {
      type: String,
      required: true,
      trim: true,
      maxlength: 16000,
    },
    dueAt: {
      type: Date,
      required: true,
      index: true,
    },
    /** After dueAt, submissions still accepted until this instant (optional). */
    allowLateUntil: {
      type: Date,
      default: null,
    },
    points: {
      type: Number,
      default: 100,
      min: 0,
      max: 10000,
    },
    published: {
      type: Boolean,
      default: true,
    },
    fileKey: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileMimeType: { type: String, default: '' },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true },
);

assignmentSchema.index({ chat: 1, dueAt: 1 });

export default mongoose.model('Assignment', assignmentSchema);
