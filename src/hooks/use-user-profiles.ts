'use client';
import { useFirestore } from '@/firebase';
import { collection, query, where, documentId, onSnapshot, Unsubscribe } from 'firebase/firestore';
import type { UserProfile } from '@/lib/data';
import { useEffect, useState, useMemo } from 'react';

export function useUserProfiles(userIds: string[]) {
    const firestore = useFirestore();
    const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
    const [isLoading, setIsLoading] = useState(true);

    // Memoize and sort the user IDs to create a stable dependency for the useEffect hook.
    const sortedUniqueUserIds = useMemo(() => {
        const unique = [...new Set(userIds.filter(id => id))];
        unique.sort();
        return JSON.stringify(unique); // Stringify for a stable dependency
    }, [userIds]);

    useEffect(() => {
        const uniqueUserIds: string[] = JSON.parse(sortedUniqueUserIds);

        if (!firestore || uniqueUserIds.length === 0) {
            setProfiles({});
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        // Firestore 'in' query is limited to 30 elements.
        // We must create listeners for each chunk of 30.
        const chunks: string[][] = [];
        for (let i = 0; i < uniqueUserIds.length; i += 30) {
            chunks.push(uniqueUserIds.slice(i, i + 30));
        }

        const allUnsubscribes: Unsubscribe[] = [];
        
        // Use a ref to track loading state across snapshots and chunks
        let initialLoadsPending = chunks.length;

        chunks.forEach(chunk => {
            if (chunk.length === 0) {
                initialLoadsPending--;
                if (initialLoadsPending === 0) setIsLoading(false);
                return;
            }

            const q = query(collection(firestore, 'users'), where(documentId(), 'in', chunk));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const changes: Record<string, UserProfile> = {};
                snapshot.docs.forEach(doc => {
                    changes[doc.id] = { id: doc.id, ...doc.data() } as UserProfile;
                });
                
                // Update state with new/changed profiles
                setProfiles(prevProfiles => ({ ...prevProfiles, ...changes }));

                // Manage loading state. It's only truly finished when the first snapshot
                // from all chunks has been processed.
                if (initialLoadsPending > 0) {
                    initialLoadsPending--;
                    if (initialLoadsPending === 0) {
                        setIsLoading(false);
                    }
                }

            }, (error) => {
                console.error("Error fetching user profiles chunk:", error);
                if (initialLoadsPending > 0) {
                   initialLoadsPending--;
                    if (initialLoadsPending === 0) {
                        setIsLoading(false);
                    }
                }
            });

            allUnsubscribes.push(unsubscribe);
        });

        // Cleanup function to unsubscribe from all listeners.
        return () => {
            allUnsubscribes.forEach(unsub => unsub());
        };
    }, [firestore, sortedUniqueUserIds]);

    return { profiles, isLoading };
}
