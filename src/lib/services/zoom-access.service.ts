import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { AssemblyPrivateConfig, SpeakerAccess } from '@/lib/data';

export async function getAssemblyPrivateConfig({
  firestore,
  assemblyId,
}: {
  firestore: Firestore;
  assemblyId: string;
}): Promise<AssemblyPrivateConfig | null> {
  const configRef = doc(
    firestore,
    'assemblies',
    assemblyId,
    'private',
    'config'
  );

  const snapshot = await getDoc(configRef);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as AssemblyPrivateConfig;
}

export async function saveAssemblyPrivateConfig({
  firestore,
  assemblyId,
  zoomUrl,
  internalNotes = null,
}: {
  firestore: Firestore;
  assemblyId: string;
  zoomUrl?: string | null;
  internalNotes?: string | null;
}) {
  const configRef = doc(
    firestore,
    'assemblies',
    assemblyId,
    'private',
    'config'
  );

  await setDoc(
    configRef,
    {
      zoomUrl: zoomUrl?.trim() || null,
      internalNotes,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function grantSpeakerZoomAccess({
  firestore,
  assemblyId,
  userId,
  zoomUrl,
  adminId,
}: {
  firestore: Firestore;
  assemblyId: string;
  userId: string;
  zoomUrl: string;
  adminId: string;
}) {
  const accessRef = doc(
    firestore,
    'assemblies',
    assemblyId,
    'speakerAccess',
    userId
  );

  await setDoc(
    accessRef,
    {
      userId,
      zoomUrl,
      active: true,
      createdAt: serverTimestamp(),
      createdBy: adminId,
      expiresAt: null,
    },
    { merge: true }
  );
}

export async function revokeSpeakerZoomAccess({
  firestore,
  assemblyId,
  userId,
}: {
  firestore: Firestore;
  assemblyId: string;
  userId: string;
}) {
  const accessRef = doc(
    firestore,
    'assemblies',
    assemblyId,
    'speakerAccess',
    userId
  );

  await setDoc(
    accessRef,
    {
      active: false,
      revokedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteSpeakerZoomAccess({
  firestore,
  assemblyId,
  userId,
}: {
  firestore: Firestore;
  assemblyId: string;
  userId: string;
}) {
  const accessRef = doc(
    firestore,
    'assemblies',
    assemblyId,
    'speakerAccess',
    userId
  );

  await deleteDoc(accessRef);
}

export async function getMySpeakerZoomAccess({
  firestore,
  assemblyId,
  userId,
}: {
  firestore: Firestore;
  assemblyId: string;
  userId: string;
}): Promise<SpeakerAccess | null> {
  const accessRef = doc(
    firestore,
    'assemblies',
    assemblyId,
    'speakerAccess',
    userId
  );

  const snapshot = await getDoc(accessRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as SpeakerAccess;
}
