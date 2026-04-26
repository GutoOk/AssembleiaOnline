'use client';
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
  id: string; // document id = effectiveVoterId
  effectiveVoterId: string; // user.uid ou grantorId, quando voto por procuração
  userId: string; // quem lançou o voto
  pollId: string;
  assemblyId: string;
  pollOptionId: string;
  timestamp: Timestamp;
  assemblyStatus: Assembly['status'];
  representedUserId?: string; // pessoa representada, quando houver procuração
};

export type Poll = {
  id: string;
  question: string;
  endDate: Timestamp;
  status: 'draft' | 'open' | 'closed' | 'annulled';
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  type: 'proposal' | 'opinion';
  // Denormalized fields for rules
  assemblyId: string;
  administratorId: string;
  assemblyStatus: Assembly['status'];
  // Annulment fields
  annulmentReason?: string;
  annulledBy?: string; // UID of admin
  annulledAt?: Timestamp;
  // Quorum fields
  quorumType?: 'simple_majority' | 'absolute_majority' | 'two_thirds_majority';
  totalActiveMembers?: number;
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
  location?: {
    address: string;
    city: string;
    state: string;
    zip: string;
    details?: string;
  };
  ordemDoDia?: string;
};

export type ChatMessage = {
  id: string;
  assemblyId: string;
  userId: string;
  text: string;
  timestamp: Timestamp;
};

export type Reaction = {
  id: string; // userId
  userId: string;
  emoji: string;
  createdAt: Timestamp;
  messageId: string;
  assemblyId: string;
};


export type BlockedUser = {
  id: string; // The UID of the user who is blocked.
};

export type ProxyAssignment = {
  id: string; // Grantor's UID
  assemblyId: string;
  grantorId: string;
  proxyId: string;
  status: 'active' | 'revoked';
  createdAt: Timestamp;
  revokedAt?: Timestamp;
  revokedBy?: string;
};

export type AssemblyPresence = {
  id: string; // user UID
  joinedAt: Timestamp;
  lastSeen: Timestamp;
};
