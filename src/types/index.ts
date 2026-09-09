export interface User {
  id: string;
  name: string;
  avatar?: string;
  color: string;
}

export interface Participant extends User {
  stream?: MediaStream;
  audioTrack?: MediaStreamTrack;
  connection?: RTCPeerConnection;
  isLocal: boolean;
  isMuted: boolean;
  volume: number;
  level: number;
  isRecording: boolean;
}

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  participants: Participant[];
  createdAt: number;
  isRecording: boolean;
  recordingStartedAt?: number;
}

export interface RecordingTrack {
  participantId: string;
  participantName: string;
  participantColor: string;
  audioBuffer: AudioBuffer;
  mimeType: string;
  startTime: number;
  duration: number;
}

export interface RecordingSession {
  id: string;
  roomId: string;
  tracks: RecordingTrack[];
  startedAt: number;
  endedAt?: number;
  status: 'recording' | 'processing' | 'completed' | 'failed';
  mixedBuffer?: AudioBuffer;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'mute' | 'unmute' | 'sync';
  from: string;
  to?: string;
  payload: unknown;
  timestamp: number;
}

export interface SupabaseRoomState {
  id: string;
  name: string;
  owner_id: string;
  participants: Record<string, ParticipantState>;
  is_recording: boolean;
  recording_started_at?: number;
  created_at: number;
  updated_at: number;
}

export interface ParticipantState {
  id: string;
  name: string;
  color: string;
  is_muted: boolean;
  volume: number;
  joined_at: number;
}

export interface IceCandidatePayload {
  candidate: RTCIceCandidateInit;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export interface OfferPayload {
  sdp: RTCSessionDescriptionInit;
}

export interface AnswerPayload {
  sdp: RTCSessionDescriptionInit;
}

export interface SyncPayload {
  serverTime: number;
  localTime: number;
}

export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

export interface AudioWorkletMessage {
  type: 'start' | 'stop' | 'pause' | 'resume' | 'getBuffer' | 'clear';
  config?: {
    sampleRate: number;
    numberOfChannels: number;
    bitDepth?: number;
  };
}

export interface AudioWorkletResponse {
  type: 'buffer' | 'status' | 'error';
  data?: AudioBuffer | Float32Array[] | string;
  status?: 'recording' | 'paused' | 'stopped';
  error?: string;
}

export interface ExportOptions {
  format: 'wav' | 'mp3' | 'webm';
  sampleRate: number;
  bitDepth: 16 | 24 | 32;
  channels: 1 | 2;
  normalize: boolean;
  trimSilence: boolean;
}

export interface TrackExportData {
  participantId: string;
  participantName: string;
  participantColor: string;
  blob: Blob;
  url: string;
  duration: number;
  size: number;
}

export interface MixedExportData {
  blob: Blob;
  url: string;
  duration: number;
  size: number;
  tracks: TrackExportData[];
}

export function participantFromState(state: ParticipantState, isLocal: boolean): Participant {
  return {
    ...state,
    isMuted: state.is_muted,
    isLocal,
    stream: undefined,
    audioTrack: undefined,
    connection: undefined,
    level: 0,
    isRecording: false,
  };
}