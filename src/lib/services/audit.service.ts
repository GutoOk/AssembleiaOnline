'use client';
import {
  addDoc,
  collection,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import type { AuditEventType } from '@/lib/data';

// TODO: Move this entire logic to a secure backend environment (e.g., Cloud Functions)
// to prevent clients from being able to write arbitrary audit log entries.

type CreateAuditLogInput = {
  firestore: Firestore;
  assemblyId: string;
  actorId: string;
  type: AuditEventType;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createAuditLog({
  firestore,
  assemblyId,
  actorId,
  type,
  targetId = null,
  metadata = {},
}: CreateAuditLogInput) {
    if (!assemblyId || !actorId) {
    console.error("Audit log creation failed: assemblyId and actorId are required.", { assemblyId, actorId, type });
    return;
  }

  const auditRef = collection(
    firestore,
    'assemblies',
    assemblyId,
    'auditLogs'
  );

  await addDoc(auditRef, {
    type,
    assemblyId,
    actorId,
    targetId,
    metadata,
    createdAt: serverTimestamp(),
  });
}
