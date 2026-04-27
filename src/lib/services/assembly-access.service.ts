import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import {
  AUTHORIZED_PARTICIPANTS_BATCH_SIZE,
  chunkArray,
  normalizeEmail,
} from '@/lib/utils/email-list';

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
  const uniqueEmails = Array.from(
    new Set(emails.map((email) => normalizeEmail(email)))
  );

  const emailChunks = chunkArray(
    uniqueEmails,
    AUTHORIZED_PARTICIPANTS_BATCH_SIZE
  );

  for (const emailChunk of emailChunks) {
    const batch = writeBatch(firestore);

    emailChunk.forEach((email) => {
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

    await batch.commit();
  }

  const assemblyRef = doc(firestore, 'assemblies', assemblyId);
  const finalBatch = writeBatch(firestore);

  finalBatch.update(assemblyRef, {
    accessMode: 'restricted_email_list',
    authorizedParticipantsCount: uniqueEmails.length,
    authorizedParticipantsUploadedAt: serverTimestamp(),
    authorizedParticipantsUploadedBy: adminId,
    authorizedParticipantsImportStatus: 'completed',
    authorizedParticipantsImportError: null,
    updatedAt: serverTimestamp(),
  });

  await finalBatch.commit();
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
  const normalizedEmail = normalizeEmail(email);

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
