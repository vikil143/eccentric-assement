import mongoose from 'mongoose';
import { env } from '../config/env.js';

mongoose.set('strictQuery', true);

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected [host=%s db=%s]', mongoose.connection.host, mongoose.connection.name);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (err: Error) => {
  console.error('MongoDB connection error:', err.message);
});

export async function connectMongo(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 10,
  });
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
