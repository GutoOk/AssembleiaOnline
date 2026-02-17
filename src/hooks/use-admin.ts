'use client';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export function useAdmin() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const adminRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'admins', user.uid);
  }, [firestore, user]);

  const { data: adminDoc, isLoading: isAdminLoading } = useDoc(adminRef);

  const isAdmin = !!adminDoc;
  const isLoading = isUserLoading || (user ? isAdminLoading : false);

  return { user, isAdmin, isLoading };
}
