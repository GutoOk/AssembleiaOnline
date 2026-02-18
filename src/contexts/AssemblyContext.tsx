'use client';
import type { Assembly } from '@/lib/data';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AssemblyContextType {
  status: Assembly['status'] | null;
  setStatus: (status: Assembly['status'] | null) => void;
  isQueueOpen: boolean;
  setIsQueueOpen: (isOpen: boolean) => void;
}

const AssemblyContext = createContext<AssemblyContextType | undefined>(undefined);

export function AssemblyProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Assembly['status'] | null>(null);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  return (
    <AssemblyContext.Provider value={{ status, setStatus, isQueueOpen, setIsQueueOpen }}>
      {children}
    </AssemblyContext.Provider>
  );
}

export function useAssemblyContext() {
  const context = useContext(AssemblyContext);
  // Do not throw an error, so the header can use it optionally
  return context;
}
