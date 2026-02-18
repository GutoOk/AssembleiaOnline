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
  proxyVoterId?: string; // UID of the user who cast the vote on behalf of userId
};

export type Poll = {
  id: string;
  question: string;
  endDate: Timestamp;
  status: 'draft' | 'open' | 'closed' | 'annulled';
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  // Denormalized fields for rules
  assemblyId: string;
  administratorId: string;
  assemblyStatus: Assembly['status'];
  // Annulment fields
  annulmentReason?: string;
  annulledBy?: string; // UID of admin
  annulledAt?: Timestamp;
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

export type AtaItem = {
  id: string;
  assemblyId: string;
  administratorId: string;
  text: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  // Denormalized for rules
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
  allowProxyVoting?: boolean;
  maxProxiesPerUser?: number;
};

export type ChatMessage = {
  id: string;
  assemblyId: string;
  userId: string;
  text: string;
  timestamp: Timestamp;
};

export type BlockedUser = {
  id: string; // The UID of the user who is blocked.
};

export type ProxyAssignment = {
  id: string; // Grantor's UID
  assemblyId: string;
  grantorId: string;
  proxyId: string; // Representative's UID
  createdAt: Timestamp;
};
