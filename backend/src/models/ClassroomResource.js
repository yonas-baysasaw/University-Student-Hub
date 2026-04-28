import mongoose from 'mongoose';

const classroomResourceSchema = new mongoose.Schema(
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
    /** External link (optional if file is attached). */
    link: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    /** S3 key for delete; empty when only a link. */
    fileKey: {
      type: String,
      default: '',
    },
    fileUrl: {
      type: String,
      default: '',
    },
    fileName: {
      type: String,
      default: '',
    },
    fileMimeType: {
      type: String,
      default: '',
    },
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

classroomResourceSchema.index({ chat: 1, createdAt: -1 });

export default mongoose.model('ClassroomResource', classroomResourceSchema);
