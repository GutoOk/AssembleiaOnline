import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

export async function saveAuthorizedParticipants({
  firestore,
  assemblyId,
  emails,
  adminId,
}: {
  firestore: Firestore;
  assemblyId: string;
  emails: string[];
  adminId: string;
}) {
  const assemblyRef = doc(firestore, 'assemblies', assemblyId);
  const batch = writeBatch(firestore);

  emails.forEach((email) => {
    const participantRef = doc(
      firestore,
      'assemblies',
      assemblyId,
      'authorizedParticipants',
      email
    );

    batch.set(participantRef, {
      email,
      createdAt: serverTimestamp(),
      createdBy: adminId,
    });
  });

  batch.update(assemblyRef, {
    accessMode: 'restricted_email_list',
    authorizedParticipantsCount: emails.length,
    authorizedParticipantsUploadedAt: serverTimestamp(),
    authorizedParticipantsUploadedBy: adminId,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function checkMyAssemblyAccess({
  firestore,
  assemblyId,
  email,
}: {
  firestore: Firestore;
  assemblyId: string;
  email: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();

  const participantRef = doc(
    firestore,
    'assemblies',
    assemblyId,
    'authorizedParticipants',
    normalizedEmail
  );

  const snapshot = await getDoc(participantRef);

  return snapshot.exists();
}
