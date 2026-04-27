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
  createdAt: Timestamp;
  order?: number;
};

export type VoteStatus = 'active' | 'withdrawn';

export type Vote = {
  id: string;
  effectiveVoterId: string;
  userId: string;
  pollId: string;
  assemblyId: string;
  pollOptionId: string | null;
  previousPollOptionId?: string | null;
  status: VoteStatus;
  timestamp: Timestamp;
  withdrawnAt?: Timestamp | null;
  withdrawnBy?: string | null;
  votedAgainAt?: Timestamp | null;
  votedAgainBy?: string | null;
  assemblyStatus: Assembly['status'];
  representedUserId?: string | null;
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
  joinedAt: Timestamp;
  status: 'Na Fila' | 'Entrada Autorizada' | 'Com a Fala';
  assemblyId: string;
  administratorId: string;
  assemblyStatus: Assembly['status'];
  calledAt?: Timestamp;
  calledBy?: string;
  speakerStartedAt?: Timestamp;
  finishedAt?: Timestamp;
  finishedBy?: string;
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

export type AssemblyAccessMode =
  | 'all_verified_members'
  | 'restricted_email_list';

export type AuthorizedParticipantsImportStatus =
  | 'none'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export type AuthorizedParticipant = {
  id: string;
  email: string;
  createdAt: Timestamp;
  createdBy: string;
};

export type Assembly = {
  id: string;
  title: string;
  description: string;
  date: Timestamp;
  youtubeUrl: string;
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
  accessMode?: AssemblyAccessMode;
  authorizedParticipantsCount?: number;
  authorizedParticipantsUploadedAt?: Timestamp | null;
  authorizedParticipantsUploadedBy?: string | null;
  authorizedParticipantsImportStatus?: AuthorizedParticipantsImportStatus;
  authorizedParticipantsImportError?: string | null;
};

export type AssemblyPrivateConfig = {
  zoomUrl?: string | null;
  internalNotes?: string | null;
  updatedAt?: Timestamp;
};

export type SpeakerAccess = {
  id: string; // userId
  userId: string;
  zoomUrl: string | null;
  active: boolean;
  createdAt: Timestamp;
  createdBy: string;
  expiresAt?: Timestamp | null;
  revokedAt?: Timestamp | null;
  revokedBy?: string | null;
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

export type AuditEventType =
  | 'ASSEMBLY_CREATED'
  | 'ASSEMBLY_UPDATED'
  | 'ASSEMBLY_STARTED'
  | 'ASSEMBLY_ENDED'
  | 'POLL_CREATED'
  | 'POLL_ANNULLED'
  | 'VOTE_CAST'
  | 'VOTE_RECAST'
  | 'VOTE_WITHDRAWN'
  | 'PROXY_GRANTED'
  | 'PROXY_REVOKED'
  | 'ATA_ITEM_CREATED'
  | 'ATA_ITEM_UPDATED'
  | 'ADMIN_GRANTED'
  | 'ADMIN_REMOVED'
  | 'ZOOM_ACCESS_GRANTED'
  | 'ZOOM_ACCESS_REVOKED'
  | 'AUTHORIZED_PARTICIPANTS_UPLOADED'
  | 'AUTHORIZED_PARTICIPANTS_UPDATED';

export type AuditLog = {
  id: string;
  type: AuditEventType;
  assemblyId: string;
  actorId: string; // User UID
  targetId?: string; // e.g., Poll ID, User ID, etc.
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
};
    
