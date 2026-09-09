import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../store';
import { useWebRTC } from '../hooks/useWebRTC';
import { useAudioRecording } from '../hooks/useAudioRecording';
import { createRoomChannel, setRoomRecording, leaveRoom, updateParticipantState, getRoom } from '../utils/supabase';
import type { Participant, SignalingMessage, ParticipantState, RecordingSession } from '../types';
import { ParticipantTrack } from './ParticipantTrack';
import { RecordingControls } from './RecordingControls';
import { InviteModal } from './InviteModal';
import { SettingsModal } from './SettingsModal';
import { createOffer, handleAnswer, addIceCandidate } from '../hooks/useWebRTC';
import { participantFromState } from '../types';

export function RoomPage() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const {
    user,
    room,
    participants,
    localStream,
    isRecording,
    recordingSession,
    setRoom,
    addParticipant,
    removeParticipant,
    updateParticipant,
    setLocalStream,
    setRecording,
    clearRecordingTracks,
    setError,
    setConnected,
  } = useStore();

  const [isInitialized, setIsInitialized] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [selectedInput, setSelectedInput] = useState<string>('default');
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const signalingChannelRef = useRef<ReturnType<typeof createRoomChannel> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const { createPeerConnection, sendSignal, cleanup } = useWebRTC(roomId!, localStream);
  const { startRecording, stopRecording, getAudioLevel, isRecording: isTrackRecording } = useAudioRecording();

  useEffect(() => {
    const enumerateDevices = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === 'audioinput');
      setAudioInputs(inputs);
    };
    enumerateDevices();
  }, []);

  useEffect(() => {
    if (!roomId || !user) {
      navigate('/');
      return;
    }

    let mounted = true;
    let initTimeout: ReturnType<typeof setTimeout>;

    const initRoom = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: selectedInput !== 'default' ? { exact: selectedInput } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 2,
          },
        });

        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        setLocalStream(stream);

        const localParticipant: Participant = {
          ...user,
          stream,
          audioTrack: stream.getAudioTracks()[0],
          isLocal: true,
          isMuted: false,
          volume: 1,
          level: 0,
          isRecording: false,
        };

        addParticipant(localParticipant);

        const channel = createRoomChannel(roomId!);

        channel
          .on('broadcast', { event: 'signal' }, async ({ payload }) => {
            const message = payload as SignalingMessage;
            if (message.from === user.id) return;

            const pc = peerConnectionsRef.current.get(message.from) ?? createPeerConnection(message.from, false);

            switch (message.type) {
              case 'offer':
                await handleOffer(pc, message.payload as RTCSessionDescriptionInit, message.from);
                break;
              case 'answer':
                await handleAnswer(pc, message.payload as RTCSessionDescriptionInit);
                break;
              case 'ice-candidate':
                await addIceCandidate(pc, message.payload as RTCIceCandidateInit);
                break;
              case 'mute':
                updateParticipant(message.from, { isMuted: true });
                break;
              case 'unmute':
                updateParticipant(message.from, { isMuted: false });
                break;
            }
          })
          .on('presence', { event: 'join' }, ({ newPresences }) => {
            const presence = newPresences[0];
            if (presence.user_id !== user.id) {
              const pc = createPeerConnection(presence.user_id, true);
              createOffer(pc).then((offer) => {
                sendSignal({
                  type: 'offer',
                  from: user.id,
                  to: presence.user_id,
                  payload: offer,
                  timestamp: Date.now(),
                });
              });
            }
          })
          .on('presence', { event: 'leave' }, ({ leftPresences }) => {
            const presence = leftPresences[0];
            if (presence.user_id !== user.id) {
              removeParticipant(presence.user_id);
              peerConnectionsRef.current.get(presence.user_id)?.close();
              peerConnectionsRef.current.delete(presence.user_id);
            }
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
            const newRoom = payload.new as { is_recording: boolean; recording_started_at: number | null; participants: Record<string, unknown> };
            if (newRoom.is_recording !== room?.isRecording) {
              const session: RecordingSession | undefined = newRoom.is_recording
                ? { startedAt: newRoom.recording_started_at ?? undefined } as RecordingSession
                : undefined;
              setRecording(newRoom.is_recording, session);
            }
            Object.entries(newRoom.participants).forEach(([id, p]) => {
              const participant = p as { is_muted: boolean; volume: number };
              updateParticipant(id, { isMuted: participant.is_muted, volume: participant.volume });
            });
          })
          .subscribe(async (status) => {
            if (!mounted) return;
            
            if (status === 'SUBSCRIBED') {
              clearTimeout(initTimeout);
              await channel.track({ user_id: user.id, name: user.name });
              setConnected(true);
              setIsInitialized(true);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              clearTimeout(initTimeout);
              console.error('Supabase connection failed:', status);
              setError(`Erro de conexão com o servidor (${status}). Verifique suas credenciais do Supabase e se as tabelas foram criadas.`);
            }
          });

        // Timeout fallback - 10 segundos
        initTimeout = setTimeout(() => {
          if (mounted && !isInitialized) {
            console.warn('Supabase connection timeout, continuing anyway...');
            setIsInitialized(true);
          }
        }, 10000);

        signalingChannelRef.current = channel;

        const roomData = await getRoom(roomId!);
        if (roomData && mounted) {
          const roomRow = roomData as unknown as { id: string; name: string; owner_id: string; participants: Record<string, unknown>; is_recording: boolean; recording_started_at: number | null; created_at: number };
          setRoom({
            id: roomRow.id,
            name: roomRow.name,
            ownerId: roomRow.owner_id,
            participants: Object.values(roomRow.participants).map((p) => {
              const participant = p as ParticipantState;
              return participantFromState(participant, participant.id === user.id);
            }),
            createdAt: roomRow.created_at,
            isRecording: roomRow.is_recording,
            recordingStartedAt: roomRow.recording_started_at ?? undefined,
          });

          if (roomRow.is_recording && roomRow.recording_started_at) {
            setRecording(true, { startedAt: roomRow.recording_started_at } as RecordingSession);
          }
        } else if (!roomData && mounted) {
          setError('Sala não encontrada. Verifique o ID da sala.');
        }
      } catch (error) {
        if (!mounted) return;
        console.error('Error initializing room:', error);
        if (error instanceof Error && error.name === 'NotAllowedError') {
          setError('Permissão de microfone negada. Permita o acesso nas configurações do navegador.');
        } else if (error instanceof Error && error.name === 'NotFoundError') {
          setError('Nenhum microfone encontrado. Conecte um microfone e tente novamente.');
        } else {
          setError('Erro ao acessar microfone. Verifique as permissões.');
        }
      }
    };

    initRoom();

    return () => {
      mounted = false;
      clearTimeout(initTimeout);
      cleanup();
      signalingChannelRef.current?.untrack();
      signalingChannelRef.current?.unsubscribe();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomId, user, navigate, selectedInput, createPeerConnection, sendSignal, addParticipant, removeParticipant, updateParticipant, setLocalStream, setRoom, setRecording, setConnected, setError, cleanup, isInitialized]);

  const handleOffer = async (pc: RTCPeerConnection, offer: RTCSessionDescriptionInit, from: string) => {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendSignal({
      type: 'answer',
      from: user!.id,
      to: from,
      payload: answer,
      timestamp: Date.now(),
    });
  };

  const handleStartRecording = useCallback(async () => {
    if (!roomId || !user) return;

    clearRecordingTracks();

    const allParticipants = Array.from(participants.values());
    const recordingPromises = allParticipants.map(async (p) => {
      if (p.stream) {
        await startRecording(p.id, p.name, p.color, p.stream);
        updateParticipant(p.id, { isRecording: true });
      }
    });

    await Promise.all(recordingPromises);

    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      roomId,
      tracks: [],
      startedAt: Date.now(),
      status: 'recording' as const,
    };

    setRecording(true, session);
    await setRoomRecording(roomId, true, session.startedAt);

    signalingChannelRef.current?.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        type: 'sync',
        from: user.id,
        payload: { serverTime: Date.now(), localTime: Date.now() },
        timestamp: Date.now(),
      },
    });
  }, [roomId, user, participants, startRecording, updateParticipant, setRecording, clearRecordingTracks]);

  const handleStopRecording = useCallback(async () => {
    if (!roomId || !user) return;

    const allParticipants = Array.from(participants.values());
    const stopPromises = allParticipants.map(async (p) => {
      if (isTrackRecording(p.id)) {
        const track = await stopRecording(p.id);
        if (track) updateParticipant(p.id, { isRecording: false });
      }
    });

    await Promise.all(stopPromises);

    setRecording(false);
    await setRoomRecording(roomId, false);
  }, [roomId, user, participants, isTrackRecording, stopRecording, updateParticipant, setRecording]);

  const handleMuteToggle = useCallback(async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    mediaStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !newMuted;
    });

    if (newMuted) {
      sendSignal({ type: 'mute', from: user!.id, payload: {}, timestamp: Date.now() });
    } else {
      sendSignal({ type: 'unmute', from: user!.id, payload: {}, timestamp: Date.now() });
    }

    await updateParticipantState(roomId!, user!.id, { is_muted: newMuted });
    updateParticipant(user!.id, { isMuted: newMuted });
  }, [isMuted, user, roomId, sendSignal, updateParticipant]);

  const handleVolumeChange = useCallback(async (newVolume: number) => {
    setVolume(newVolume);
    await updateParticipantState(roomId!, user!.id, { volume: newVolume });
    updateParticipant(user!.id, { volume: newVolume });
  }, [roomId, user, updateParticipant]);

  const handleInputChange = useCallback(async (deviceId: string) => {
    setSelectedInput(deviceId);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId !== 'default' ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2,
        },
      });
      mediaStreamRef.current = stream;
      setLocalStream(stream);
      updateParticipant(user!.id, { stream, audioTrack: stream.getAudioTracks()[0] });

      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (sender) {
          sender.replaceTrack(stream.getAudioTracks()[0]);
        }
      });
    } catch (error) {
      console.error('Error switching input:', error);
      setError('Erro ao trocar dispositivo de áudio');
    }
  }, [user, setLocalStream, updateParticipant, setError]);

  const handleLeaveRoom = useCallback(async () => {
    if (isRecording) {
      await handleStopRecording();
    }
    if (roomId && user) {
      await leaveRoom(roomId, user.id);
    }
    cleanup();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    navigate('/');
  }, [isRecording, roomId, user, handleStopRecording, cleanup, navigate]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-studio-bg">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-studio-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-studio-text-muted">Entrando na sala...</p>
        </div>
      </div>
    );
  }

  const allParticipants = Array.from(participants.values());
  const remoteParticipants = allParticipants.filter((p) => !p.isLocal);
  const localParticipant = allParticipants.find((p) => p.isLocal);

  return (
    <div className="min-h-screen bg-studio-bg flex flex-col">
      <header className="border-b border-studio-border bg-studio-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={handleLeaveRoom} className="btn-ghost p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-studio-text">{room?.name}</h1>
            <p className="text-sm text-studio-text-muted">ID: {roomId?.toUpperCase()}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-studio-bg rounded-lg border border-studio-border">
            <select
              value={selectedInput}
              onChange={(e) => handleInputChange(e.target.value)}
              className="bg-transparent border-none text-studio-text focus:outline-none text-sm"
            >
              <option value="default">Dispositivo Padrão</option>
              {audioInputs.map((input) => (
                <option key={input.deviceId} value={input.deviceId}>
                  {input.label || `Microfone ${input.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="btn-ghost p-2"
            title="Configurações"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          <button
            onClick={() => setShowInviteModal(true)}
            className="btn-secondary"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Convidar
          </button>

          <RecordingControls
            isRecording={isRecording}
            onStart={handleStartRecording}
            onStop={handleStopRecording}
            participantCount={allParticipants.length}
          />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {localParticipant && (
              <ParticipantTrack
                participant={localParticipant}
                audioLevel={getAudioLevel(localParticipant.id)}
                isMuted={isMuted}
                onMuteToggle={handleMuteToggle}
                onVolumeChange={handleVolumeChange}
                volume={volume}
                isLocal
              />
            )}

            {remoteParticipants.map((participant) => (
              <ParticipantTrack
                key={participant.id}
                participant={participant}
                audioLevel={getAudioLevel(participant.id)}
                isMuted={participant.isMuted}
                onVolumeChange={(vol) => updateParticipant(participant.id, { volume: vol })}
                volume={participant.volume}
              />
            ))}

            {allParticipants.length < 8 && (
              <div className="card flex flex-col items-center justify-center min-h-[200px] border-dashed border-studio-border/50 hover:border-studio-accent/50 transition-colors">
                <svg className="w-12 h-12 text-studio-text-muted mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <p className="text-studio-text-muted text-center">Convide participantes</p>
                <button onClick={() => setShowInviteModal(true)} className="btn-primary mt-3">
                  + Adicionar
                </button>
              </div>
            )}
          </div>

          {isRecording && recordingSession && (
            <div className="card border-studio-danger/50 bg-studio-danger/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 bg-studio-danger rounded-full recording-pulse"></span>
                  <span className="font-medium text-studio-danger">GRAVANDO</span>
                  <span className="px-2 py-1 text-xs bg-studio-danger/20 text-studio-danger rounded">
                    {formatDuration(Date.now() - recordingSession.startedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-studio-text-muted">
                  {allParticipants.filter((p) => isTrackRecording(p.id)).length} de {allParticipants.length} trilhas
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {showInviteModal && (
        <InviteModal
          roomId={roomId!}
          roomName={room?.name || ''}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          audioInputs={audioInputs}
          selectedInput={selectedInput}
          onInputChange={handleInputChange}
        />
      )}
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