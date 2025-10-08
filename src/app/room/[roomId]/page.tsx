'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMedia } from '@/context/MediaContext';
import { VibeSDK } from '@/lib/VibeSDK';
import { Participant } from '@/lib/Participant';
import Controls from '@/components/Controls';
import VideoPlayer from '@/components/VideoPlayer';

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const router = useRouter();
  const { localStream, name: localName, setLocalStream, sdk } = useMedia();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  useEffect(() => {
    if (!localStream || !sdk || !localName) {
      router.push('/');
      return;
    }

    const localParticipant = new Participant(sdk.socket.id!, localName, true);
    localParticipant.stream = localStream;
    setParticipants([localParticipant]);

    sdk.joinRoom(roomId, localName, localStream);

    const handleParticipantJoined = (participant: Participant) => {
      console.log('Participant joined:', participant);
      setParticipants(prev => [...prev, participant]);
    };

    const handleParticipantLeft = (participant: Participant) => {
      console.log('Participant left:', participant);
      setParticipants(prev => prev.filter(p => p.id !== participant.id));
    };

    const handleParticipantUpdated = (participant: Participant) => {
        setParticipants(prev => prev.map(p => p.id === participant.id ? participant : p));
    };

    sdk.on('participant-joined', handleParticipantJoined);
    sdk.on('participant-left', handleParticipantLeft);
    sdk.on('participant-updated', handleParticipantUpdated);

    return () => {
      sdk.leaveRoom();
      // In a real app, you'd need sdk.off(...) to remove listeners
    };
  }, [localStream, localName, roomId, router, sdk]);

  const handleMute = () => {
    const newMutedState = !isMuted;
    localStream?.getAudioTracks().forEach((track) => (track.enabled = !newMutedState));
    sdk?.toggleMute(newMutedState);
    setIsMuted(newMutedState);
  };

  const handleCameraOff = () => {
    const newCameraState = !isCameraOff;
    localStream?.getVideoTracks().forEach((track) => (track.enabled = !newCameraState));
    sdk?.toggleCamera(newCameraState);
    setIsCameraOff(newCameraState);
  };

  const handleLeave = () => {
    sdk?.leaveRoom();
    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(undefined);
    router.push('/');
  };

  return (
    <div className="room-container">
      <div className="videos-grid">
        {participants.map(p => (
          <VideoPlayer key={p.id} stream={p.stream} name={p.isLocal ? `${p.name} (You)` : p.name} isLocal={p.isLocal} isMuted={p.isMuted} />
        ))}
      </div>
      <Controls
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        onMute={handleMute}
        onCameraOff={handleCameraOff}
        onLeave={handleLeave}
      />
    </div>
  );
}