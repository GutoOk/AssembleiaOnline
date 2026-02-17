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

  const login = async (userInput: string): Promise<'success' | 'error'> => {
    setLoading(true);
    // Simulate API call
    return new Promise(resolve => {
      setTimeout(() => {
        let userToLogin: User | undefined;
        const value = userInput.toLowerCase().trim();

        if (value === 'admin') {
          userToLogin = MOCK_DATA.users.find(u => u.role === 'admin');
        } else if (value === 'associado') {
          userToLogin = MOCK_DATA.users.find(u => u.role === 'member');
        }

        if (userToLogin) {
          setUser(userToLogin);
          localStorage.setItem('user_email', userToLogin.email);
          setLoading(false);
          resolve('success');
        } else {
          setLoading(false);
          resolve('error');
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
