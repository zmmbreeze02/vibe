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
  const { localStream, setLocalStream, name, setName } = useMedia();
  const [roomId, setRoomId] = useState('');

  useEffect(() => {
    // Get user media
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
      } catch (error) {
        console.error('Error accessing media devices.', error);
      }
    };
    if (!localStream) {
      getMedia();
    }

    // Handle name generation and persistence
    const storedName = localStorage.getItem('userName');
    if (storedName) {
      setName(storedName);
    } else {
      const newName = generateRandomName();
      setName(newName);
      localStorage.setItem('userName', newName);
    }

    return () => {
      if (localStream && !localStream.active) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [localStream, setLocalStream, setName]);

  const handleJoin = () => {
    if (localStream && name) {
      const finalRoomId = roomId || crypto.randomUUID();
      router.push(`/room/${finalRoomId}`);
    }
  };

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
      <button onClick={handleJoin} disabled={!localStream || !name}>
        Join Room
      </button>
    </div>
  );
}