export interface ParticipantRow {
  id: string;
  name: string;
  color: string;
  is_muted: boolean;
  volume: number;
  joined_at: number;
}

export interface RoomRow {
  id: string;
  name: string;
  owner_id: string;
  participants: Record<string, ParticipantRow>;
  is_recording: boolean;
  recording_started_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface RecordingTrackRow {
  participant_id: string;
  participant_name: string;
  participant_color: string;
  mime_type: string;
  start_time: number;
  duration: number;
}

export interface RecordingRow {
  id: string;
  room_id: string;
  tracks: RecordingTrackRow[];
  started_at: number;
  ended_at: number | null;
  status: 'recording' | 'processing' | 'completed' | 'failed';
  mixed_audio_url: string | null;
  created_at: number;
}

export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: RoomRow;
        Insert: Omit<RoomRow, 'created_at' | 'updated_at'> & {
          created_at?: number;
          updated_at?: number;
        };
        Update: Partial<Omit<RoomRow, 'created_at' | 'updated_at'>> & {
          updated_at?: number;
        };
      };
      recordings: {
        Row: RecordingRow;
        Insert: Omit<RecordingRow, 'id' | 'created_at'> & {
          created_at?: number;
        };
        Update: Partial<Omit<RecordingRow, 'id' | 'created_at'>>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}