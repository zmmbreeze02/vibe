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
  console.log(`[VideoPlayer] Rendering for ${name}. Initial stream prop:`, stream);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | undefined>(stream);

  useEffect(() => {
    console.log(`[VideoPlayer] Top useEffect for ${name}. Stream prop changed:`, stream);
    setVideoStream(stream);

    const handleTrack = (e: MediaStreamTrackEvent) => {
      console.log(`[VideoPlayer] 'addtrack' event fired for ${name}. Track:`, e.track);
      if (stream) {
        console.log(`[VideoPlayer] Re-setting videoStream for ${name} with new tracks.`);
        setVideoStream(new MediaStream(stream.getTracks()));
      }
    };

    stream?.addEventListener('addtrack', handleTrack as EventListener);

    return () => {
      stream?.removeEventListener('addtrack', handleTrack as EventListener);
    };
  }, [stream, name]);

  useEffect(() => {
    console.log(`[VideoPlayer] Bottom useEffect for ${name}. videoStream state changed:`, videoStream);
    if (videoRef.current && videoStream) {
      console.log(`[VideoPlayer] Assigning srcObject for ${name}.`, videoStream);
      videoRef.current.srcObject = videoStream;
    } else {
      console.log(`[VideoPlayer] Not assigning srcObject for ${name}. Ref or stream is null.`, { ref: videoRef.current, videoStream });
    }
  }, [videoStream, name]);

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