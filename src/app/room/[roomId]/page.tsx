'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { Device } from 'mediasoup-client';
import { Transport } from 'mediasoup-client/lib/Transport';
import { useMedia } from '@/context/MediaContext';
import Controls from '@/components/Controls';
import VideoPlayer from '@/components/VideoPlayer';

interface RemoteStream {
  id: string;
  stream: MediaStream;
  name: string;
  socketId: string;
  isMuted: boolean;
}

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const { roomId } = params;
  const router = useRouter();
  const { localStream, name: localName } = useMedia();
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | undefined>(undefined);

  useEffect(() => {
    if (!localStream) {
      router.push('/');
      return;
    }

    const socket = io('http://localhost:3000');
    socketRef.current = socket;

    const setup = async () => {
      // Join the room
      socket.emit('join-room', roomId);

      socket.emit('routerRtpCapabilities', async (routerRtpCapabilities: any) => {
        try {
          const device = new Device();
          await device.load({ routerRtpCapabilities });
          deviceRef.current = device;

          socket.emit('create-transport', { isSender: true }, async (params: any) => {
            const sendTransport = device.createSendTransport(params);
            sendTransport.on('connect', ({ dtlsParameters }, cb) => socket.emit('connect-transport', { transportId: sendTransport.id, dtlsParameters }, () => cb()));
            sendTransport.on('produce', ({ kind, rtpParameters }, cb) => socket.emit('produce', { kind, rtpParameters }, ({ id }: any) => cb({ id })));
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) await sendTransport.produce({ track: videoTrack });
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) await sendTransport.produce({ track: audioTrack });
          });

          socket.emit('create-transport', { isSender: false }, async (params: any) => {
            const recvTransport = device.createRecvTransport(params);
            recvTransport.on('connect', ({ dtlsParameters }, cb) => socket.emit('connect-transport', { transportId: recvTransport.id, dtlsParameters }, () => cb()));
            
            socket.on('new-producer', ({ producerId, socketId }) => consume(recvTransport, producerId, socketId));
            socket.on('existing-producers', (producers) => {
                for(const { producerId, socketId } of producers) consume(recvTransport, producerId, socketId);
            });
          });
        } catch (error) { console.error(error); }
      });
    };

    const consume = async (transport: Transport, producerId: string, socketId: string) => {
        const { rtpCapabilities } = deviceRef.current!;
        socket.emit('consume', { producerId, rtpCapabilities }, async (params: any) => {
            if (params.error) return console.error(params.error);
            const consumer = await transport.consume(params);
            socket.emit('resume-consumer', { consumerId: consumer.id }, () => {});
            const { track } = consumer;
            const newStream = new MediaStream([track]);
            setRemoteStreams(prev => [...prev, { id: consumer.id, stream: newStream, name: `User ${socketId.substring(0, 4)}`, socketId, isMuted: false }]);
        });
    }

    socket.on('connect', setup);
    socket.on('user-mute-status-changed', ({ socketId, muted }) => {
        setRemoteStreams(prev => prev.map(rs => rs.socketId === socketId ? { ...rs, isMuted: muted } : rs));
    });

    return () => {
      socket.disconnect();
      setRemoteStreams([]);
    };
  }, [localStream, router, roomId]);

  const handleMute = () => {
    if (localStream) {
      const newMutedState = !isMuted;
      localStream.getAudioTracks().forEach((track) => (track.enabled = !newMutedState));
      setIsMuted(newMutedState);
      socketRef.current?.emit('mute-status-change', { muted: newMutedState });
    }
  };

  const handleCameraOff = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
      setIsCameraOff(!isCameraOff);
    }
  };

  const handleLeave = () => {
    localStream?.getTracks().forEach((track) => track.stop());
    socketRef.current?.disconnect();
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