import mongoose from 'mongoose';

const classroomAnnouncementSchema = new mongoose.Schema(
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
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20000,
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

classroomAnnouncementSchema.index({ chat: 1, createdAt: -1 });

export default mongoose.model(
  'ClassroomAnnouncement',
  classroomAnnouncementSchema,
);
