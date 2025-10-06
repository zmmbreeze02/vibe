'use client';

import { useEffect, useRef, useState } from 'react';

interface MicIndicatorProps {
  stream?: MediaStream;
}

const MicIndicator: React.FC<MicIndicatorProps> = ({ stream }) => {
  const [volume, setVolume] = useState(0);
  const animationFrameId = useRef<number>();

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
      // Normalize volume to a 0-1 range for scaleX
      setVolume(Math.min(average / 128, 1));
      animationFrameId.current = requestAnimationFrame(updateVolume);
    };

    updateVolume();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      source.disconnect();
      audioContext.close();
    };
  }, [stream]);

  return (
    <div className="mic-track">
      <div className="mic-fill" style={{ transform: `scaleX(${volume})` }} />
    </div>
  );
};

export default MicIndicator;