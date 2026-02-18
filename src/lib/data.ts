import type { Timestamp } from 'firebase/firestore';

// Represents the user profile stored in /users/{userId}
export type UserProfile = {
  id: string; // UID from Auth
  name: string;
  email: string;
  avatarDataUri: string;
  createdAt?: Timestamp;
};

export type PollOption = {
  id: string;
  text: string;
  pollId: string;
  assemblyId: string;
  assemblyStatus: Assembly['status'];
};

export type Vote = {
  id: string; // User's UID to enforce one vote per poll
  userId: string;
  pollId: string;
  assemblyId: string;
  pollOptionId: string;
  timestamp: Timestamp;
  assemblyStatus: Assembly['status'];
};

export type Poll = {
  id: string;
  question: string;
  endDate: Timestamp;
  status: 'draft' | 'open' | 'closed';
  createdAt: Timestamp;
  // Denormalized fields for rules
  assemblyId: string;
  administratorId: string;
  assemblyStatus: Assembly['status'];
};

export type SpeakerQueueItem = {
  id: string;
  userId: string;
  joinedAt: Timestamp; // Renamed from requestTime
  status: 'Na Fila' | 'Entrada Autorizada' | 'Com a Fala';
  // Denormalized fields for rules
  assemblyId: string;
  administratorId: string;
  assemblyStatus: Assembly['status'];
};

export type Assembly = {
  id: string;
  title: string;
  description: string;
  date: Timestamp;
  youtubeUrl: string;
  zoomUrl?: string;
  imageUrl: string;
  status: 'scheduled' | 'live' | 'finished' | 'cancelled';
  administratorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
};

    