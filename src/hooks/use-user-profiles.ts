'use client';
import { useFirestore } from '@/firebase';
import { collection, query, where, documentId, getDocs } from 'firebase/firestore';
import type { UserProfile } from '@/lib/data';
import { useEffect, useState } from 'react';

export function useUserProfiles(userIds: string[]) {
    const firestore = useFirestore();
    const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
    const [isLoading, setIsLoading] = useState(false);

    // Using JSON.stringify for stable dependency on userIds array
    const userIdsString = JSON.stringify(userIds.filter(id => id).sort());

    useEffect(() => {
        const uniqueUserIds = JSON.parse(userIdsString) as string[];

        if (!firestore || uniqueUserIds.length === 0) {
            setProfiles({});
            return;
        }
        
        // Don't refetch if we already have all the requested profiles
        const missingProfiles = uniqueUserIds.filter(id => !profiles[id]);
        if (missingProfiles.length === 0) {
            return;
        }

        const fetchProfiles = async () => {
            setIsLoading(true);
            const newProfiles: Record<string, UserProfile> = {};
            
            // Firestore 'in' query is limited to 30 elements in latest versions.
            const chunks: string[][] = [];
            for (let i = 0; i < missingProfiles.length; i += 30) {
                chunks.push(missingProfiles.slice(i, i + 30));
            }
            
            try {
                await Promise.all(chunks.map(async (chunk) => {
                    if (chunk.length === 0) return;
                    const usersRef = collection(firestore, 'users');
                    const q = query(usersRef, where(documentId(), 'in', chunk));
                    const querySnapshot = await getDocs(q);
                    querySnapshot.forEach((doc) => {
                        newProfiles[doc.id] = { id: doc.id, ...doc.data() } as UserProfile;
                    });
                }));

                setProfiles(prev => ({...prev, ...newProfiles}));

            } catch (error) {
                console.error("Error fetching user profiles:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firestore, userIdsString]);

    return { profiles, isLoading };
}
