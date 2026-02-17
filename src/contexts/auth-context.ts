import type { User } from '@/lib/data';
import { createContext } from 'react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string) => Promise<'success' | 'error'>;
  logout: () => void;
  isAdmin: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
