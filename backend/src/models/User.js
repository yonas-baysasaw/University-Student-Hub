import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  googleId: { type: String, unique: true, sparse: true },
  displayName: String,
  username: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true },
  password: String,
  provider: { type: [String], default: [] },
  profile: Object,
  resetPasswordToken: String,
  resetPasswordExpires: Date
});

const User = mongoose.model('User', userSchema);

export default User; 
