import mongoose from 'mongoose';

const personalCalendarEventSchema = new mongoose.Schema(
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
      maxlength: 300,
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
    allDay: {
      type: Boolean,
      default: false,
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
    recurrence: {
      type: String,
      enum: ['none', 'daily', 'weekly', 'weekdays'],
      default: 'none',
    },
    /** Last day recurrence applies (inclusive, end of local day handled in service). */
    recurrenceUntil: {
      type: Date,
      default: null,
    },
    /** Minutes before start to remind (e.g. 10, 60). null = no reminder. */
    reminderMinutesBefore: {
      type: Number,
      default: null,
      min: 0,
      max: 10_080,
    },
    color: {
      type: String,
      trim: true,
      default: '#7c3aed',
      maxlength: 20,
    },
  },
  { timestamps: true },
);

personalCalendarEventSchema.index({ userId: 1, startsAt: 1 });

export default mongoose.model(
  'PersonalCalendarEvent',
  personalCalendarEventSchema,
);
