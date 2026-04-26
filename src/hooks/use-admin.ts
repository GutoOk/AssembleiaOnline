'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';

export function useAdmin() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminDocLoading, setIsAdminDocLoading] = useState(true);

  useEffect(() => {
    if (isAuthLoading) {
      // If auth is still loading, we can't know the admin status yet.
      // Set loading to true and wait.
      setIsAdmin(false);
      setIsAdminDocLoading(true);
      return;
    }

    if (!user || !firestore) {
      // If auth is done but there's no user or firestore, they can't be an admin.
      // Loading is complete.
      setIsAdmin(false);
      setIsAdminDocLoading(false);
      return;
    }

    // Auth is done, we have a user, start checking the admin document.
    setIsAdminDocLoading(true);

    const adminDocRef = doc(firestore, 'admins', user.uid);

    const unsubscribe = onSnapshot(
      adminDocRef,
      (snapshot) => {
        // Firestore has responded. The user is admin if the doc exists.
        setIsAdmin(snapshot.exists());
        // The admin check is now complete.
        setIsAdminDocLoading(false);
      },
      (error) => {
        // An error occurred (e.g., permissions). Treat as non-admin.
        console.error('Erro ao verificar admin:', error);
        setIsAdmin(false);
        setIsAdminDocLoading(false);
      }
    );

    // Clean up the listener when the component unmounts or dependencies change.
    return () => unsubscribe();
  }, [user, firestore, isAuthLoading]);

  // The overall loading state is true if either auth is loading or the admin doc check is loading.
  const isLoading = isAuthLoading || isAdminDocLoading;

  return { user, isAdmin, isLoading };
}
