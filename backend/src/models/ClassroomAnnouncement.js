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
    /** 0 = normal, 1 = highlight, 2 = urgent (sort + UI accent). */
    importance: {
      type: Number,
      default: 0,
      min: 0,
      max: 2,
      index: true,
    },
    /** Pedagogical category for filtering and layout. */
    kind: {
      type: String,
      enum: ['statement', 'assignment', 'exam'],
      default: 'statement',
      index: true,
    },
    /** Optional instant after which the announcement is treated as expired in UI. */
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

classroomAnnouncementSchema.index({ chat: 1, createdAt: -1 });
classroomAnnouncementSchema.index({ chat: 1, importance: -1, createdAt: -1 });
classroomAnnouncementSchema.index({ chat: 1, expiresAt: 1 });
classroomAnnouncementSchema.index({ chat: 1, kind: 1, createdAt: -1 });

export default mongoose.model(
  'ClassroomAnnouncement',
  classroomAnnouncementSchema,
);
