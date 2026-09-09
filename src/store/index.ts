import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Participant, Room, RecordingTrack, RecordingSession, TrackExportData, MixedExportData } from '../types';

interface AppState {
  user: User | null;
  room: Room | null;
  participants: Map<string, Participant>;
  localStream: MediaStream | null;
  isRecording: boolean;
  recordingSession: RecordingSession | null;
  recordingTracks: Map<string, RecordingTrack>;
  exportedTracks: TrackExportData[];
  mixedExport: MixedExportData | null;
  error: string | null;
  isConnected: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';

  setUser: (user: User | null) => void;
  setRoom: (room: Room | null) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (id: string) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRecording: (isRecording: boolean, session?: RecordingSession) => void;
  addRecordingTrack: (track: RecordingTrack) => void;
  clearRecordingTracks: () => void;
  setExportedTracks: (tracks: TrackExportData[]) => void;
  setMixedExport: (exportData: MixedExportData | null) => void;
  setError: (error: string | null) => void;
  setConnected: (connected: boolean) => void;
  setConnectionQuality: (quality: AppState['connectionQuality']) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  room: null,
  participants: new Map<string, Participant>(),
  localStream: null,
  isRecording: false,
  recordingSession: null,
  recordingTracks: new Map<string, RecordingTrack>(),
  exportedTracks: [],
  mixedExport: null,
  error: null,
  isConnected: false,
  connectionQuality: 'disconnected' as const,
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (user) => set({ user }),

      setRoom: (room) => set({ room }),

      addParticipant: (participant) =>
        set((state) => {
          const newParticipants = new Map(state.participants);
          newParticipants.set(participant.id, participant);
          return { participants: newParticipants };
        }),

      removeParticipant: (id) =>
        set((state) => {
          const newParticipants = new Map(state.participants);
          newParticipants.delete(id);
          return { participants: newParticipants };
        }),

      updateParticipant: (id, updates) =>
        set((state) => {
          const participant = state.participants.get(id);
          if (!participant) return state;
          const newParticipants = new Map(state.participants);
          newParticipants.set(id, { ...participant, ...updates });
          return { participants: newParticipants };
        }),

      setLocalStream: (stream) => set({ localStream: stream }),

      setRecording: (isRecording, session) =>
        set({ isRecording, recordingSession: session ?? null }),

      addRecordingTrack: (track) =>
        set((state) => {
          const newTracks = new Map(state.recordingTracks);
          newTracks.set(track.participantId, track);
          return { recordingTracks: newTracks };
        }),

      clearRecordingTracks: () => set({ recordingTracks: new Map() }),

      setExportedTracks: (tracks) => set({ exportedTracks: tracks }),

      setMixedExport: (exportData) => set({ mixedExport: exportData }),

      setError: (error) => set({ error }),

      setConnected: (connected) => set({ isConnected: connected }),

      setConnectionQuality: (quality) => set({ connectionQuality: quality }),

      reset: () => set(initialState),
    }),
    {
      name: 'podfalaragora-storage',
      partialize: (state) => ({
        user: state.user,
      }),
    }
  )
);