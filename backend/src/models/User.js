import mongoose from "mongoose";

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
    subscriptions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    subscribers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    geminiApiKey: {
      type: String,
      default: "",
    },
    geminiModelId: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["user", "staff"],
      default: "user",
      index: true,
    },
    accountType: {
      type: String,
      enum: ["student", "instructor"],
      default: "student",
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
  return obj;
};

export default mongoose.model("User", userSchema);
