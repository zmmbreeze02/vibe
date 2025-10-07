'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useMedia } from '@/context/MediaContext';
import Controls from '@/components/Controls';
import VideoPlayer from '@/components/VideoPlayer';

interface RemoteStream {
  id: string;
  stream: MediaStream;
  name: string;
  socketId: string;
  isMuted?: boolean;
}

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const router = useRouter();
  const { localStream, name: localName, setLocalStream, sdk } = useMedia();
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  useEffect(() => {
    if (!localStream || !sdk) {
      router.push('/');
      return;
    }

    sdk.joinRoom(roomId, localStream);

    const handleNewStream = (remoteData: RemoteStream) => {
      setRemoteStreams(prev => [...prev, remoteData]);
    };
    const handleUserLeft = (socketId: string) => {
      setRemoteStreams(prev => prev.filter(rs => rs.socketId !== socketId));
    };

    sdk.on('new-remote-stream', handleNewStream);
    sdk.on('remote-user-disconnected', handleUserLeft);

    return () => {
      sdk.leaveRoom();
      // We don't remove listeners from the SDK here because the SDK instance is persistent.
      // A more robust SDK would have a `removeListener` method.
    };
  }, [localStream, roomId, router, sdk]);

  const handleMute = () => {
    const newMutedState = !isMuted;
    // Toggle local track
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => (track.enabled = !newMutedState));
    }
    // Toggle remote track via SDK
    sdk?.toggleMute(newMutedState);
    // Update UI state
    setIsMuted(newMutedState);
  };

  const handleCameraOff = () => {
    const newCameraState = !isCameraOff;
    // Toggle local track
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => (track.enabled = !newCameraState));
    }
    // Toggle remote track via SDK
    sdk?.toggleCamera(newCameraState);
    // Update UI state
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
        <VideoPlayer stream={localStream} name={`${localName} (You)`} isLocal={true} isMuted={isMuted} />
        {remoteStreams.map(rs => (
          <VideoPlayer key={rs.id} stream={rs.stream} name={rs.name} isMuted={rs.isMuted} />
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