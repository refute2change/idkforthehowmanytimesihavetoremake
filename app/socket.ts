// app/socket.ts
import { io } from 'socket.io-client';

// Compute URL based on environment
const URL = process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3000';

export const socket = io(URL, {
  autoConnect: false, // Don't connect until root layout mounts
});