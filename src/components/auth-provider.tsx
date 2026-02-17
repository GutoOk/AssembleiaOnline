'use client';

import { AuthContext } from '@/contexts/auth-context';
import type { User } from '@/lib/data';
import { MOCK_DATA } from '@/lib/data';
import { useEffect, useState } from 'react';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate checking for a logged-in user in localStorage
    const storedUserEmail = localStorage.getItem('user_email');
    if (storedUserEmail) {
      const foundUser = MOCK_DATA.users.find(u => u.email === storedUserEmail);
      if (foundUser) {
        setUser(foundUser);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string): Promise<'success' | 'error'> => {
    setLoading(true);
    // Simulate API call
    return new Promise(resolve => {
      setTimeout(() => {
        if (!email.endsWith('@mensa.org.br')) {
          setLoading(false);
          resolve('error');
          return;
        }

        const foundUser = MOCK_DATA.users.find(u => u.email === email);
        if (foundUser) {
          setUser(foundUser);
          localStorage.setItem('user_email', foundUser.email);
          setLoading(false);
          resolve('success');
        } else {
          // For demo, create a temporary user if email is valid but not in mock data
          const newUser: User = {
            id: String(Date.now()),
            name: email.split('@')[0],
            email,
            avatarUrl: `https://picsum.photos/seed/${email}/40/40`,
            role: 'member',
          };
          MOCK_DATA.users.push(newUser);
          setUser(newUser);
          localStorage.setItem('user_email', newUser.email);
          setLoading(false);
          resolve('success');
        }
      }, 500);
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user_email');
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}
