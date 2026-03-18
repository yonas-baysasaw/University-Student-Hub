import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  googleId: { type: String, unique: true },
  displayName: String,
  username: {type:String, unique:true},
  password: String,
  email: String,
  provider: String
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;