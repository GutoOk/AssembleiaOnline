'use client';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export function useAdmin() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'admins', user.uid);
  }, [firestore, user]);

  // isLoading from useDoc is for the document fetch, not auth.
  const { data: adminDoc, isLoading: isAdminDocLoading } = useDoc(adminDocRef);

  const isAdmin = !!adminDoc;
  
  // The overall loading state depends on both auth loading and the admin doc loading.
  const isLoading = isAuthLoading || (user && isAdminDocLoading);

  return { user, isAdmin, isLoading };
}
