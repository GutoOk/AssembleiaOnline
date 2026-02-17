'use client';
import { useUser } from '@/firebase';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useState, useEffect } from 'react';

export function useAdmin() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Start loading whenever the user or their loading status changes.
    setIsLoading(true);

    if (isUserLoading) {
      // If the parent hook is still loading the user, we wait.
      return;
    }

    if (!user) {
      // If there's no user, they are not an admin. We are done loading.
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    // If we have a user, subscribe to their document in the 'admins' collection.
    const adminRef = doc(firestore, 'admins', user.uid);
    const unsubscribe = onSnapshot(
      adminRef,
      (doc) => {
        // The user is an admin if the document exists.
        setIsAdmin(doc.exists());
        // We are now done loading.
        setIsLoading(false);
      },
      (error) => {
        // If there's an error (e.g., permissions), assume not an admin.
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
        setIsLoading(false);
      }
    );

    // Clean up the subscription when the component unmounts or dependencies change.
    return () => unsubscribe();
  }, [user, isUserLoading, firestore]);

  return { user, isAdmin, isLoading };
}
