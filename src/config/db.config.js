import mongoose from 'mongoose';
import { appConfig } from './app.config.js';

export const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(appConfig.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`🍃 MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.warn(`⚠️ MongoDB Connection Warning: ${error.message}`);
    console.warn(`💡 Check that MongoDB is running or update MONGODB_URI in .env`);
  }
};
