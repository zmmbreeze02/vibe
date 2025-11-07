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
  const [screenShareParticipant, setScreenShareParticipant] = useState<Participant | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const handleParticipantJoined = useCallback((participant: Participant) => {
    setParticipants(prev => [...prev, participant]);
  }, []);

  const handleParticipantLeft = useCallback((participant: Participant) => {
    setParticipants(prev => prev.filter(p => p.id !== participant.id));
  }, []);

  const handleParticipantUpdated = useCallback((participant: Participant) => {
    setParticipants(prev => prev.map(p => p.id === participant.id ? participant : p));
  }, []);

  const handleScreenShareStarted = useCallback((participant: Participant) => {
    setScreenShareParticipant(participant);
  }, []);

  const handleScreenShareStopped = useCallback(({ socketId }: { socketId: string }) => {
    // If the local user stopped sharing, the SDK handles the producer.
    // If a remote user stopped, we just need to update the UI.
    setScreenShareParticipant(null);
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
    sdk.on('participant-updated', handleParticipantUpdated);
    sdk.on('screen-share-started', handleScreenShareStarted);
    sdk.on('screen-share-stopped', handleScreenShareStopped);
    sdk.on('local-stream-updated', (newStream) => setLocalStream(newStream));

    sdk.joinRoom(roomId, localName, localStream);

    return () => {
      sdk.leaveRoom();
      // Unsubscribe from all events
    };
  }, [localStream, localName, roomId, router, sdk, handleParticipantJoined, handleParticipantLeft, handleParticipantUpdated, handleScreenShareStarted, handleScreenShareStopped, setLocalStream]);

  const handleMute = () => {
    const newMutedState = !isMuted;
    sdk?.toggleMute(newMutedState);
    setIsMuted(newMutedState);
  };

  const handleCameraOff = () => {
    const newCameraState = !isCameraOff;
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

  const otherParticipants = participants.filter(p => !p.isLocal);
  const localParticipant = participants.find(p => p.isLocal);

  return (
    <div className="room-container-new">
      <div className="main-stage">
        {screenShareParticipant ? (
          <VideoPlayer 
            key={screenShareParticipant.id} 
            stream={screenShareParticipant.stream} 
            name={screenShareParticipant.name} 
          />
        ) : (
          localParticipant && <VideoPlayer key={localParticipant.id} stream={localParticipant.stream} name={`${localParticipant.name} (You)`} isLocal={true} isMuted={isMuted} />
        )}
      </div>
      <div className="sidebar">
        {otherParticipants.map(p => (
          <VideoPlayer key={p.id} stream={p.stream} name={p.name} isLocal={p.isLocal} isMuted={p.isMuted} />
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
