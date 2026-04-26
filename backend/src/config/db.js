import mongoose from 'mongoose';
import { ENV } from './env.js';

const connectDB = async () => {
  const mongoUri = ENV.MONGODB_URI || ENV.MONGODB_URL;
  if (!mongoUri) {
    console.error(
      'MongoDB connection string (MONGODB_URI or MONGODB_URL) is missing',
    );
    process.exit(1);
  }

  try {
    mongoose.set('strictQuery', false);
    const connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`Connected to MongoDB: ${connection.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export default connectDB;
