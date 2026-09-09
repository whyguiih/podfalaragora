import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { getRecordings } from '../utils/supabase';
import { useAudioExport } from '../hooks/useAudioExport';
import type { RecordingTrack, TrackExportData, ExportOptions } from '../types';

export function RecordingPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { recordingTracks, exportedTracks, mixedExport } = useStore();
  const { exportAllTracks, exportMixed } = useAudioExport();

  const [recordings, setRecordings] = useState<Array<{ id: string; name: string; created_at: number; tracks: number }>>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'wav',
    sampleRate: 48000,
    bitDepth: 24,
    channels: 2,
    normalize: true,
    trimSilence: false,
  });

  useEffect(() => {
    if (sessionId) {
      loadRecordings(sessionId);
    }
  }, [sessionId]);

  const loadRecordings = async (roomId: string) => {
    const data = await getRecordings(roomId);
    setRecordings(data.map((r) => ({
      id: r.id,
      name: `Gravação ${new Date(r.created_at).toLocaleString('pt-BR')}`,
      created_at: r.created_at,
      tracks: (r.tracks as unknown[]).length,
    })));
  };

  const handleExportTracks = async () => {
    if (recordingTracks.size === 0) return;
    setIsExporting(true);
    setExportProgress(0);

    try {
      await exportAllTracks(exportOptions);
      setExportProgress(100);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMixed = async () => {
    if (recordingTracks.size === 0) return;
    setIsExporting(true);
    setExportProgress(0);

    try {
      await exportMixed(exportOptions);
      setExportProgress(100);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const allTracks = Array.from(recordingTracks.values());
  const allExportedTracks = exportedTracks;
  const hasRecordings = allTracks.length > 0 || allExportedTracks.length > 0;

  return (
    <div className="min-h-screen bg-studio-bg flex flex-col">
      <header className="border-b border-studio-border bg-studio-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="btn-ghost p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-studio-text">Gravações</h1>
            <p className="text-sm text-studio-text-muted">{recordings.length} sessão(ões) encontrada(s)</p>
          </div>
        </div>

        {hasRecordings && (
          <div className="flex items-center gap-3">
            <select
              value={exportOptions.format}
              onChange={(e) => setExportOptions({ ...exportOptions, format: e.target.value as ExportOptions['format'] })}
              className="input w-auto bg-studio-bg"
            >
              <option value="wav">WAV</option>
              <option value="mp3">MP3</option>
            </select>
            <select
              value={exportOptions.sampleRate}
              onChange={(e) => setExportOptions({ ...exportOptions, sampleRate: parseInt(e.target.value) })}
              className="input w-auto bg-studio-bg"
            >
              <option value="44100">44.1 kHz</option>
              <option value="48000">48 kHz</option>
              <option value="96000">96 kHz</option>
            </select>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={exportOptions.normalize}
                onChange={(e) => setExportOptions({ ...exportOptions, normalize: e.target.checked })}
                className="w-4 h-4 accent-studio-accent"
              />
              Normalizar
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={exportOptions.trimSilence}
                onChange={(e) => setExportOptions({ ...exportOptions, trimSilence: e.target.checked })}
                className="w-4 h-4 accent-studio-accent"
              />
              Cortar Silêncio
            </label>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {recordings.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-studio-text mb-4">Sessões de Gravação</h2>
              <div className="space-y-2">
                {recordings.map((rec) => (
                  <button
                    key={rec.id}
                    onClick={() => {}}
                    className="w-full text-left p-4 rounded-lg transition-colors hover:bg-studio-bg border border-transparent"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-studio-text">{rec.name}</p>
                        <p className="text-sm text-studio-text-muted">{rec.tracks} trilha(s)</p>
                      </div>
                      <svg className="w-5 h-5 text-studio-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {allTracks.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-studio-text">Trilhas Gravadas ({allTracks.length})</h2>
                <button
                  onClick={handleExportTracks}
                  disabled={isExporting}
                  className="btn-primary"
                >
                  {isExporting ? 'Exportando...' : 'Exportar Todas'}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allTracks.map((track) => (
                  <TrackCard
                    key={track.participantId}
                    track={track}
                    exportedTrack={allExportedTracks.find((t) => t.participantId === track.participantId)}
                    onDownload={handleDownload}
                    onExport={handleExportTracks}
                  />
                ))}
              </div>

              {isExporting && (
                <div className="mt-4 p-4 bg-studio-bg rounded-lg">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-studio-text-muted">Exportando trilhas...</span>
                    <span className="text-studio-text">{exportProgress}%</span>
                  </div>
                  <div className="h-2 bg-studio-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-studio-accent transition-all duration-300"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {mixedExport && (
            <div className="card border-studio-success/50 bg-studio-success/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-studio-success flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Mix Estéreo Exportado
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportMixed}
                    disabled={isExporting}
                    className="btn-secondary text-sm"
                  >
                    Re-exportar
                  </button>
                  <button
                    onClick={() => handleDownload(mixedExport.url, `mix-${Date.now()}.wav`)}
                    className="btn-primary"
                  >
                    Baixar Mix
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3 text-sm">
                <div className="bg-studio-bg p-3 rounded-lg">
                  <p className="text-studio-text-muted">Duração</p>
                  <p className="font-mono text-studio-text">{formatDuration(mixedExport.duration * 1000)}</p>
                </div>
                <div className="bg-studio-bg p-3 rounded-lg">
                  <p className="text-studio-text-muted">Tamanho</p>
                  <p className="font-mono text-studio-text">{formatBytes(mixedExport.size)}</p>
                </div>
                <div className="bg-studio-bg p-3 rounded-lg">
                  <p className="text-studio-text-muted">Trilhas Incluídas</p>
                  <p className="font-mono text-studio-text">{mixedExport.tracks.length}</p>
                </div>
              </div>
            </div>
          )}

          {!hasRecordings && recordings.length === 0 && (
            <div className="card flex flex-col items-center justify-center min-h-[300px] text-center">
              <svg className="w-16 h-16 text-studio-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.82-1.36 3.3-3 3.72V21h6v-1.28c1.64-.42 3-1.9 3-3.72V6l-12 3v13z" />
              </svg>
              <h3 className="text-xl font-medium text-studio-text mb-2">Nenhuma gravação encontrada</h3>
              <p className="text-studio-text-muted mb-6">Volte para a sala e inicie uma gravação</p>
              <button onClick={() => navigate('/')} className="btn-primary">
                Voltar ao Início
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TrackCard({ track, exportedTrack, onDownload, onExport }: { track: RecordingTrack; exportedTrack?: TrackExportData; onDownload: (url: string, filename: string) => void; onExport: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(exportedTrack?.url || URL.createObjectURL(new Blob([track.audioBuffer.getChannelData(0)])));
    }
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="card relative">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
          style={{ backgroundColor: track.participantColor }}
        >
          {track.participantName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-studio-text truncate">{track.participantName}</p>
          <p className="text-sm text-studio-text-muted">{formatDuration(track.duration * 1000)}</p>
        </div>
      </div>

      <div className="space-y-2">
        {exportedTrack ? (
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="btn-ghost p-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                {isPlaying ? (
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                ) : (
                  <path d="M8 5v14l11-7z" />
                )}
              </svg>
            </button>
            <button
              onClick={() => onDownload(exportedTrack.url, `${track.participantName}-${Date.now()}.wav`)}
              className="btn-secondary text-sm flex-1"
            >
              Baixar Trilha
            </button>
          </div>
        ) : (
          <button
            onClick={onExport}
            className="btn-primary w-full text-sm"
          >
            Exportar para baixar
          </button>
        )}

        <div className="pt-2 border-t border-studio-border text-xs text-studio-text-muted grid grid-cols-2 gap-2">
          <div><span className="block">Início</span> <span className="font-mono">{new Date(track.startTime).toLocaleTimeString('pt-BR')}</span></div>
          <div><span className="block">Duração</span> <span className="font-mono">{formatDuration(track.duration * 1000)}</span></div>
        </div>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}