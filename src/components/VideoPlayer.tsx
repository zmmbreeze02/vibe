'use client';
import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-container">
      <video ref={videoRef} autoPlay playsInline muted className={isLocal ? 'mirrored' : ''} />
      <div className="video-overlay">
        <div className="video-name">{name}</div>
        {isMuted && <div className="video-mute-icon"><MuteIcon /></div>}
      </div>
    </div>
  );
};

export default VideoPlayer;