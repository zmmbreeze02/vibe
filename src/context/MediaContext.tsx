'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface MediaContextType {
  localStream: MediaStream | undefined;
  setLocalStream: (stream: MediaStream) => void;
  name: string;
  setName: (name: string) => void;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export const MediaProvider = ({ children }: { children: ReactNode }) => {
  const [localStream, setLocalStream] = useState<MediaStream | undefined>(undefined);
  const [name, setName] = useState('');

  return (
    <MediaContext.Provider value={{ localStream, setLocalStream, name, setName }}>
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return context;
};
