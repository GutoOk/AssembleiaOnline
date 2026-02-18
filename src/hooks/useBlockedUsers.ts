'use client';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { BlockedUser } from '@/lib/data';
import { useMemo } from 'react';

export function useBlockedUsers() {
    const firestore = useFirestore();
    const { user } = useUser();

    const blockedUsersQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, 'users', user.uid, 'blockedUsers');
    }, [firestore, user]);

    const { data: blockedUsers, isLoading } = useCollection<BlockedUser>(blockedUsersQuery);

    const blockedUserIds = useMemo(() => {
        if (!blockedUsers) return new Set<string>();
        return new Set(blockedUsers.map(u => u.id));
    }, [blockedUsers]);

    return { blockedUserIds, isLoading };
}
