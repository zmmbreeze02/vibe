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

  const handleParticipantJoined = useCallback((participant: Participant) => {
    console.log('[UI-DEBUG] Participant joined event received:', participant.name);
    setParticipants(prev => {
      // Defensive check to prevent adding duplicates
      if (prev.some(p => p.id === participant.id)) {
        console.warn('[UI-WARN] Attempted to add duplicate participant:', participant.name);
        return prev;
      }
      return [...prev, participant];
    });
  }, []);

  const handleParticipantLeft = useCallback((participant: Participant) => {
    console.log('[UI-DEBUG] Participant left:', participant.name);
    setParticipants(prev => prev.filter(p => p.id !== participant.id));
  }, []);

  useEffect(() => {
    if (!localStream || !sdk || !localName) {
      router.push('/');
      return;
    }

    const handleReady = (localParticipant: Participant) => {
        localParticipant.stream = localStream;
        setParticipants([localParticipant]);
    };

    sdk.on('ready', handleReady);
    sdk.on('participant-joined', handleParticipantJoined);
    sdk.on('participant-left', handleParticipantLeft);

    sdk.joinRoom(roomId, localName, localStream);

    return () => {
      sdk.leaveRoom();
      // In a real app, you'd need to remove listeners via sdk.off()
    };
  }, [localStream, localName, roomId, router, sdk, handleParticipantJoined, handleParticipantLeft]);

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

  const handleShareScreen = () => {
    sdk?.startScreenShare();
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
        onShareScreen={handleShareScreen}
      />
    </div>
  );
}
