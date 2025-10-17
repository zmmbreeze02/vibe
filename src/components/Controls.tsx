interface ControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  onMute: () => void;
  onCameraOff: () => void;
  onLeave: () => void;
  onShareScreen: () => void;
}

const Controls: React.FC<ControlsProps> = ({
  isMuted,
  isCameraOff,
  onMute,
  onCameraOff,
  onLeave,
  onShareScreen,
}) => {
  return (
    <div className="controls-container">
      <button onClick={onMute}>{isMuted ? 'Unmute' : 'Mute'}</button>
      <button onClick={onCameraOff}>{isCameraOff ? 'Camera On' : 'Camera Off'}</button>
      <button onClick={onShareScreen}>Share Screen</button>
      <button onClick={onLeave}>Leave</button>
    </div>
  );
};

export default Controls;