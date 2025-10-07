'use client';

import { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';
import { VibeSDK } from '@/lib/VibeSDK';

interface MediaContextType {
  localStream: MediaStream | undefined;
  setLocalStream: (stream: MediaStream | undefined) => void;
  name: string;
  setName: (name: string) => void;
  sdk: VibeSDK | null;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export const MediaProvider = ({ children }: { children: ReactNode }) => {
  const [localStream, setLocalStream] = useState<MediaStream | undefined>(undefined);
  const [name, setName] = useState('');
  const sdkRef = useRef<VibeSDK | null>(null);

  if (!sdkRef.current) {
    sdkRef.current = new VibeSDK();
  }

  useEffect(() => {
    // Ensure socket is disconnected when the provider is unmounted (e.g. tab close)
    return () => {
      sdkRef.current?.disconnect();
    }
  }, []);

  return (
    <MediaContext.Provider value={{ localStream, setLocalStream, name, setName, sdk: sdkRef.current }}>
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