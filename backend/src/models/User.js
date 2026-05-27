import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      trim: true,
      index: true,
    },
    name: {
      type: String,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    password: {
      type: String,
    },
    avatar: {
      type: String,
    },
    email_verified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    googleId: {
      type: String,
      sparse: true,
      index: true,
    },
    provider: {
      type: [String],
      default: () => [],
    },
    displayName: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    schoolYear: {
      type: Number,
      min: 1,
      max: 7,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    notificationsLastSeenAt: {
      type: Date,
    },
    subscriptions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    subscribers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    role: {
      type: String,
      enum: ['user', 'admin', 'lecturer'],
      default: 'user',
      index: true,
    },
    permissions: {
      type: [String],
      default: () => [],
    },
    accountType: {
      type: String,
      enum: ['student', 'instructor'],
      default: 'student',
      index: true,
    },
    platformReadOnly: {
      type: Boolean,
      default: false,
    },
    instructorPostingSuspended: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active',
      index: true,
    },
    suspendedAt: {
      type: Date,
    },
    suspendedReason: {
      type: String,
      trim: true,
      maxlength: 240,
    },
    deletedAt: {
      type: Date,
      index: true,
    },
    showEmailPublic: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
    },
    campus: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    emergencyContact: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 1600,
      default: '',
    },
    interests: {
      type: String,
      trim: true,
      maxlength: 600,
      default: '',
    },
    careerGoals: {
      type: String,
      trim: true,
      maxlength: 600,
      default: '',
    },
    skills: {
      type: String,
      trim: true,
      maxlength: 600,
      default: '',
    },
    socialTelegram: {
      type: String,
      trim: true,
      maxlength: 400,
      default: '',
    },
    socialLinkedIn: {
      type: String,
      trim: true,
      maxlength: 400,
      default: '',
    },
    socialInstagram: {
      type: String,
      trim: true,
      maxlength: 400,
      default: '',
    },
    socialFacebook: {
      type: String,
      trim: true,
      maxlength: 400,
      default: '',
    },
    socialUpwork: {
      type: String,
      trim: true,
      maxlength: 400,
      default: '',
    },
    socialGitHub: {
      type: String,
      trim: true,
      maxlength: 400,
      default: '',
    },
    geminiApiKey: {
      type: String,
      select: false,
    },
    geminiModelId: {
      type: String,
      trim: true,
      default: '',
    },
    geminiKeySet: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.geminiApiKey;
  return obj;
};

export default mongoose.model('User', userSchema);
