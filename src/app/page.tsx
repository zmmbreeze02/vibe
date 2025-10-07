'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMedia } from '@/context/MediaContext';
import MicIndicator from '@/components/MicIndicator';
import VideoPlayer from '@/components/VideoPlayer';

const adjectives = ['Happy', 'Cool', 'Sunny', 'Brave', 'Clever', 'Gentle'];
const nouns = ['Panda', 'Lion', 'Tiger', 'Eagle', 'Shark', 'Wolf'];

const generateRandomName = () => {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
};

export default function LobbyPage() {
  const router = useRouter();
  const { localStream, setLocalStream, name, setName, sdk } = useMedia();
  const [roomId, setRoomId] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
      } catch (error) {
        console.error('Error accessing media devices.', error);
      }
    };
    if (!localStream) getMedia();

    const storedName = localStorage.getItem('userName');
    if (storedName) {
      setName(storedName);
    } else {
      const newName = generateRandomName();
      setName(newName);
      localStorage.setItem('userName', newName);
    }

    if (sdk) {
      // Set initial state
      setSocketConnected(sdk.isConnected);

      // Listen for future changes
      const onConnected = () => setSocketConnected(true);
      const onDisconnected = () => setSocketConnected(false);
      sdk.on('connected', onConnected);
      sdk.on('disconnected', onDisconnected);

      // A robust implementation would also clean up these listeners
    }

  }, [localStream, setLocalStream, setName, sdk]);

  const handleJoin = () => {
    if (localStream && name && socketConnected) {
      const finalRoomId = roomId || crypto.randomUUID();
      router.push(`/room/${finalRoomId}`);
    }
  };

  const getButtonText = () => {
      if (!socketConnected) return 'Connecting to server...';
      if (!localStream) return 'Waiting for media...';
      return 'Join Room';
  }

  return (
    <div className="lobby-container">
      <h2>Ready to join?</h2>
      <div className="lobby-video-preview">
        <VideoPlayer stream={localStream} name="You" isLocal={true} />
      </div>
      <MicIndicator stream={localStream} />
      <h3 style={{ marginTop: 0 }}>{name}</h3>
      <input
        type="text"
        placeholder="Enter Room ID (or leave blank for new)"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
      />
      <button onClick={handleJoin} disabled={!localStream || !name || !socketConnected}>
        {getButtonText()}
      </button>
    </div>
  );
}
