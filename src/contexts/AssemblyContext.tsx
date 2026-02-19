'use client';
import type { Assembly, UserProfile, AtaItem, Poll } from '@/lib/data';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AssemblyContextType {
  assembly: Assembly | null;
  setAssembly: (assembly: Assembly | null) => void;
  isQueueOpen: boolean;
  setIsQueueOpen: (isOpen: boolean) => void;
  isChatOpen: boolean;
  setIsChatOpen: (isOpen: boolean) => void;
  isEndAssemblyDialogOpen: boolean;
  setIsEndAssemblyDialogOpen: (isOpen: boolean) => void;
  isStartAssemblyDialogOpen: boolean;
  setIsStartAssemblyDialogOpen: (isOpen: boolean) => void;
  attendees: UserProfile[];
  setAttendees: (attendees: UserProfile[]) => void;
  isAttendeesSheetOpen: boolean;
  setIsAttendeesSheetOpen: (isOpen: boolean) => void;
  timelineItems: (AtaItem | Poll)[];
  setTimelineItems: (items: (AtaItem | Poll)[]) => void;
}

const AssemblyContext = createContext<AssemblyContextType | undefined>(undefined);

export function AssemblyProvider({ children }: { children: ReactNode }) {
  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isEndAssemblyDialogOpen, setIsEndAssemblyDialogOpen] = useState(false);
  const [isStartAssemblyDialogOpen, setIsStartAssemblyDialogOpen] = useState(false);
  const [attendees, setAttendees] = useState<UserProfile[]>([]);
  const [isAttendeesSheetOpen, setIsAttendeesSheetOpen] = useState(false);
  const [timelineItems, setTimelineItems] = useState<(AtaItem | Poll)[]>([]);

  return (
    <AssemblyContext.Provider value={{ 
        assembly, setAssembly, 
        isQueueOpen, setIsQueueOpen, 
        isChatOpen, setIsChatOpen, 
        isEndAssemblyDialogOpen, setIsEndAssemblyDialogOpen, 
        isStartAssemblyDialogOpen, setIsStartAssemblyDialogOpen,
        attendees, setAttendees,
        isAttendeesSheetOpen, setIsAttendeesSheetOpen,
        timelineItems, setTimelineItems
      }}>
      {children}
    </AssemblyContext.Provider>
  );
}

export function useAssemblyContext() {
  const context = useContext(AssemblyContext);
  // Do not throw an error, so the header can use it optionally
  return context;
}
