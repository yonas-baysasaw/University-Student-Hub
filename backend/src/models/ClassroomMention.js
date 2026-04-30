import mongoose from 'mongoose';

const classroomMentionSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
    },
    readAt: { type: Date },
  },
  { timestamps: true },
);

classroomMentionSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model('ClassroomMention', classroomMentionSchema);
