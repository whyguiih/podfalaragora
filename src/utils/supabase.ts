import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 50,
    },
  },
});

export function createRoomChannel(roomId: string): RealtimeChannel {
  return supabase.channel(`room:${roomId}`, {
    config: {
      presence: {
        key: 'user',
      },
    },
  });
}

export function createSignalingChannel(roomId: string): RealtimeChannel {
  return supabase.channel(`signaling:${roomId}`);
}

interface RoomRow {
  id: string;
  name: string;
  owner_id: string;
  participants: Record<string, unknown>;
  is_recording: boolean;
  recording_started_at: number | null;
  created_at: number;
  updated_at: number;
}

export async function createRoom(name: string, ownerId: string, ownerName: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      name,
      owner_id: ownerId,
      participants: {
        [ownerId]: {
          id: ownerId,
          name: ownerName,
          color: generateColor(),
          is_muted: false,
          volume: 1,
          joined_at: Date.now(),
        },
      },
      is_recording: false,
      created_at: Date.now(),
      updated_at: Date.now(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating room:', error);
    return null;
  }

  return data;
}

export async function joinRoom(roomId: string, userId: string, userName: string): Promise<boolean> {
  const { data: room, error: fetchError } = await supabase
    .from('rooms')
    .select('participants')
    .eq('id', roomId)
    .single();

  if (fetchError || !room) {
    console.error('Room not found:', fetchError);
    return false;
  }

  const participants = (room as unknown as RoomRow).participants as Record<string, unknown>;
  const newParticipant = {
    id: userId,
    name: userName,
    color: generateColor(),
    is_muted: false,
    volume: 1,
    joined_at: Date.now(),
  };

  const { error } = await supabase
    .from('rooms')
    .update({
      participants: {
        ...participants,
        [userId]: newParticipant,
      },
      updated_at: Date.now(),
    })
    .eq('id', roomId);

  if (error) {
    console.error('Error joining room:', error);
    return false;
  }

  return true;
}

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  const { data: room } = await supabase
    .from('rooms')
    .select('participants')
    .eq('id', roomId)
    .single();

  if (room) {
    const participants = { ...((room as unknown as RoomRow).participants as Record<string, unknown>) };
    delete participants[userId];

    await supabase
      .from('rooms')
      .update({
        participants,
        updated_at: Date.now(),
      })
      .eq('id', roomId);
  }
}

export async function updateParticipantState(
  roomId: string,
  userId: string,
  updates: Partial<{ is_muted: boolean; volume: number }>
): Promise<void> {
  const { data: room } = await supabase
    .from('rooms')
    .select('participants')
    .eq('id', roomId)
    .single();

  if (room) {
    const participants = { ...((room as unknown as RoomRow).participants as Record<string, unknown>) };
    if (participants[userId]) {
      participants[userId] = { ...participants[userId], ...updates };

      await supabase
        .from('rooms')
        .update({
          participants,
          updated_at: Date.now(),
        })
        .eq('id', roomId);
    }
  }
}

export async function setRoomRecording(roomId: string, isRecording: boolean, startedAt?: number): Promise<void> {
  await supabase
    .from('rooms')
    .update({
      is_recording: isRecording,
      recording_started_at: isRecording ? (startedAt ?? Date.now()) : null,
      updated_at: Date.now(),
    })
    .eq('id', roomId);
}

export async function saveRecordingSession(session: {
  room_id: string;
  tracks: Array<{
    participant_id: string;
    participant_name: string;
    participant_color: string;
    audio_data: ArrayBuffer;
    mime_type: string;
    start_time: number;
    duration: number;
  }>;
  started_at: number;
  ended_at: number;
  status: string;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('recordings')
    .insert({
      room_id: session.room_id,
      tracks: session.tracks.map(t => ({
        participant_id: t.participant_id,
        participant_name: t.participant_name,
        participant_color: t.participant_color,
        mime_type: t.mime_type,
        start_time: t.start_time,
        duration: t.duration,
      })),
      started_at: session.started_at,
      ended_at: session.ended_at,
      status: session.status,
      created_at: Date.now(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error saving recording:', error);
    return null;
  }

  return data.id;
}

function generateColor(): string {
  const colors = [
    '#f85149', '#3fb950', '#d29922', '#58a6ff', '#a371f7',
    '#f97583', '#79c0ff', '#ffa657', '#ffdf5d', '#a5d6ff',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export async function getRoom(roomId: string): Promise<RoomRow | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (error) {
    console.error('Error fetching room:', error);
    return null;
  }

  return data as unknown as RoomRow;
}

export async function getRecordings(roomId: string): Promise<Array<{ id: string; room_id: string; tracks: unknown[]; started_at: number; ended_at: number | null; status: string; created_at: number }>> {
  const { data, error } = await supabase
    .from('recordings')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching recordings:', error);
    return [];
  }

  return (data || []) as unknown as Array<{ id: string; room_id: string; tracks: unknown[]; started_at: number; ended_at: number | null; status: string; created_at: number }>;
}