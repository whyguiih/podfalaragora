import { useEffect, useRef } from 'react';
import type { Participant } from '../types';

interface ParticipantTrackProps {
  participant: Participant;
  audioLevel: number;
  isMuted?: boolean;
  onMuteToggle?: () => void;
  onVolumeChange?: (volume: number) => void;
  volume?: number;
  isLocal?: boolean;
}

export function ParticipantTrack({
  participant,
  audioLevel,
  isMuted = false,
  onMuteToggle,
  onVolumeChange,
  volume = 1,
  isLocal = false,
}: ParticipantTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barWidth = 3;
      const gap = 2;
      const numBars = Math.floor(width / (barWidth + gap));
      const level = audioLevel;

      for (let i = 0; i < numBars; i++) {
        const barHeight = Math.random() * level * height;
        const x = i * (barWidth + gap);
        const y = height - barHeight;

        let color = '#58a6ff';
        if (level > 0.9) color = '#f85149';
        else if (level > 0.7) color = '#d29922';

        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + '80');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [audioLevel]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    onVolumeChange?.(newVolume);
  };

  return (
    <div className={`card relative group ${isLocal ? 'ring-2 ring-studio-accent/50' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-lg select-none"
            style={{ backgroundColor: participant.color }}
          >
            {participant.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-studio-text truncate">{participant.name}</h3>
            <p className="text-xs text-studio-text-muted flex items-center gap-1">
              {isLocal && <span className="w-2 h-2 bg-studio-accent rounded-full"></span>}
              {isLocal ? 'Você' : 'Remoto'}
            </p>
          </div>
        </div>
        {isLocal && onMuteToggle && (
          <button
            onClick={onMuteToggle}
            className={`btn-ghost p-1.5 ${isMuted ? 'text-studio-danger' : ''}`}
            title={isMuted ? 'Desmutar' : 'Mutar'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMuted ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5.586l1.707 1.707a1 1 0 010 1.414l-1.707 1.707a1 1 0 01-1.414 0zM10 14.235v-4.235a4 4 0 00-4-4v2a2 2 0 002 2h4M18 11a4 4 0 00-4-4v2a2 2 0 01-2 2H4m10.293-3.293l3.535 3.535M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              )}
            </svg>
          </button>
        )}
      </div>

      <div className="relative h-32 mb-4">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          width={300}
          height={128}
        />
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-studio-bg rounded-b-xl overflow-hidden">
          <div
            className={`track-meter h-full ${audioLevel > 0.9 ? 'track-meter-clipping' : audioLevel > 0.7 ? 'track-meter-warning' : ''}`}
            style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="flex items-center justify-between text-sm">
            <span className="text-studio-text-muted">Volume</span>
            <span className="text-studio-text">{Math.round(volume * 100)}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            className="w-full h-2 bg-studio-bg rounded-lg appearance-none accent-studio-accent"
          />
        </div>

        {isLocal && (
          <div className="pt-3 border-t border-studio-border flex items-center justify-between text-xs text-studio-text-muted">
            <span>Entrada: {participant.audioTrack?.label || 'Padrão'}</span>
            <span className="font-mono">{participant.audioTrack?.getSettings().sampleRate || 48000}Hz</span>
          </div>
        )}

        {participant.isRecording && (
          <div className="flex items-center gap-1.5 text-xs text-studio-danger">
            <span className="w-2 h-2 bg-studio-danger rounded-full recording-pulse"></span>
            <span>Gravando</span>
          </div>
        )}
      </div>
    </div>
  );
}