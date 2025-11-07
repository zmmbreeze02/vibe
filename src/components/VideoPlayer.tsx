'use client';
import { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  stream?: MediaStream;
  name?: string;
  isLocal?: boolean;
  isMuted?: boolean;
}

const MuteIcon = () => (
  <svg height="100%" viewBox="0 0 24 24" fill="#fff">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2h2v2a5 5 0 0 0 10 0v-2h2zM4.22 4.22l15.56 15.56-1.41 1.41L2.81 5.63z"/>
  </svg>
);

const VideoPlayer: React.FC<VideoPlayerProps> = ({ stream, name, isLocal, isMuted }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | undefined>(stream);

  useEffect(() => {
    setVideoStream(stream);

    const handleTrack = () => {
      // When a new track is added, create a new MediaStream object
      // to force a re-render of the video component.
      if (stream) {
        setVideoStream(new MediaStream(stream.getTracks()));
      }
    };

    stream?.addEventListener('addtrack', handleTrack);

    return () => {
      stream?.removeEventListener('addtrack', handleTrack);
    };
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  return (
    <div className="video-container">
      <video ref={videoRef} autoPlay playsInline muted={isLocal} className={isLocal ? 'mirrored' : ''} />
      <div className="video-overlay">
        <div className="video-name">{name}</div>
        {isMuted && <div className="video-mute-icon"><MuteIcon /></div>}
      </div>
    </div>
  );
};

export default VideoPlayer;