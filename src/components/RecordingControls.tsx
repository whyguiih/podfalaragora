interface RecordingControlsProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  participantCount: number;
  disabled?: boolean;
}

export function RecordingControls({ isRecording, onStart, onStop, participantCount, disabled = false }: RecordingControlsProps) {
  if (isRecording) {
    return (
      <button
        onClick={onStop}
        disabled={disabled}
        className="btn-danger flex items-center gap-2 px-6"
      >
        <span className="w-2 h-2 bg-white rounded-full recording-pulse"></span>
        <span>Parar Gravação</span>
        <span className="px-2 py-0.5 text-xs bg-white/20 rounded-full">{participantCount} trilhas</span>
      </button>
    );
  }

  return (
    <button
      onClick={onStart}
      disabled={disabled || participantCount === 0}
      className="btn-primary flex items-center gap-2 px-6"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
      </svg>
      <span>Iniciar Gravação</span>
      <span className="px-2 py-0.5 text-xs bg-white/20 rounded-full">{participantCount} trilhas</span>
    </button>
  );
}