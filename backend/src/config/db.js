import mongoose from 'mongoose';
import { ENV } from './env.js';

const connectDB = async () => {
  if (!ENV.MONGODB_URL) {
    console.error('MongoDB connection string (MONGODB_URL) is missing');
    process.exit(1);
  }
  try {
    const connection = await mongoose.connect(ENV.MONGODB_URL);
    console.log(`Connected to MongoDB: ${connection.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export default connectDB;
