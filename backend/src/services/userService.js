import bcrypt from 'bcrypt';
import User from '../models/User.js';

const ensureProviderArray = (user) => {
  if (!Array.isArray(user.provider)) {
    user.provider = [];
  }
};

export const createLocalUser = async ({ username, email, password }) => {
  if (!email || !password) {
    const error = new Error('Email and password are required');
    error.status = 400;
    throw error;
  }

  const existing = await User.findOne({ email });
  if (existing) {
    const error = new Error('Email already in use');
    error.status = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    username,
    email,
    password: hashedPassword,
    provider: ['local']
  });

  return user;
};

export const findOrLinkGoogleUser = async (profile) => {
  const email = profile.emails?.[0]?.value;
  let user = await User.findOne({ googleId: profile.id });

  if (!user && email) {
    user = await User.findOne({ email });
    if (user) {
      ensureProviderArray(user);
      if (!user.provider.includes('google')) {
        user.provider.push('google');
      }
      user.googleId = profile.id;
      user.name ||= profile.displayName;
      user.avatar ||= profile?.photos?.[0]?.value;
      user.email_verified = true
      await user.save();
      return user;
    }
  }

  if (user) {
    return user;
  }

  return User.create({
    googleId: profile.id,
    name: profile.displayName,
    email,
    provider: ['google'],
    avatar: profile?.photos?.[0]?.value,
    email_verified : true,
    
  });
};

export const getUserById = (id) => User.findById(id);

export const updateUserAvatar = async (userId, avatarUrl) => {
  if (!userId) {
    const error = new Error('User id is required');
    error.status = 400;
    throw error;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { avatar: avatarUrl },
    { new: true, runValidators: true }
  );

  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  return user;
};

export const findByIdentifier = async (identifier) => {
  const isEmail = typeof identifier === 'string' && identifier.includes('@');
  const query = isEmail ? { email: identifier } : { username: identifier };
  return User.findOne(query);
};
