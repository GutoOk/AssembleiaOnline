'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';

export function useAdmin() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminDocLoading, setIsAdminDocLoading] = useState(true);

  useEffect(() => {
    if (isAuthLoading) {
      setIsAdmin(false);
      setIsAdminDocLoading(true);
      return;
    }

    if (!user || !firestore) {
      setIsAdmin(false);
      setIsAdminDocLoading(false);
      return;
    }

    setIsAdminDocLoading(true);

    const adminDocRef = doc(firestore, 'admins', user.uid);

    const unsubscribe = onSnapshot(
      adminDocRef,
      (snapshot) => {
        setIsAdmin(snapshot.exists());
        setIsAdminDocLoading(false);
      },
      (error) => {
        console.error('Erro ao verificar admin:', error);
        setIsAdmin(false);
        setIsAdminDocLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, firestore, isAuthLoading]);

  return {
    user,
    isAdmin,
    isLoading: isAuthLoading || isAdminDocLoading,
  };
}
