'use client';
import type { Assembly } from '@/lib/data';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AssemblyContextType {
  assembly: Assembly | null;
  setAssembly: (assembly: Assembly | null) => void;
  isQueueOpen: boolean;
  setIsQueueOpen: (isOpen: boolean) => void;
  isEndAssemblyDialogOpen: boolean;
  setIsEndAssemblyDialogOpen: (isOpen: boolean) => void;
}

const AssemblyContext = createContext<AssemblyContextType | undefined>(undefined);

export function AssemblyProvider({ children }: { children: ReactNode }) {
  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isEndAssemblyDialogOpen, setIsEndAssemblyDialogOpen] = useState(false);

  return (
    <AssemblyContext.Provider value={{ assembly, setAssembly, isQueueOpen, setIsQueueOpen, isEndAssemblyDialogOpen, setIsEndAssemblyDialogOpen }}>
      {children}
    </AssemblyContext.Provider>
  );
}

export function useAssemblyContext() {
  const context = useContext(AssemblyContext);
  // Do not throw an error, so the header can use it optionally
  return context;
}
