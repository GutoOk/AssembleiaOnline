'use client';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export function useAdmin() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  // Create the doc ref only when we are certain auth is done and we have a user.
  const adminDocRef = useMemoFirebase(() => {
    if (isAuthLoading || !user || !firestore) {
      return null;
    }
    return doc(firestore, 'admins', user.uid);
  }, [isAuthLoading, user, firestore]);

  const { data: adminDoc, isLoading: isAdminDocLoading } = useDoc(adminDocRef);

  const isAdmin = !!adminDoc;

  // If auth is loading, we are definitely loading.
  // If auth is done but we don't have a user, we are not loading and not an admin.
  // If auth is done and we have a user, then isLoading depends on the doc query.
  const isLoading = isAuthLoading || (!!user && isAdminDocLoading);

  return { user, isAdmin, isLoading };
}
