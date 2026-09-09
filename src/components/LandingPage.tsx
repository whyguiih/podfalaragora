import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../store';
import { createRoom, joinRoom, getRoom } from '../utils/supabase';
import type { Room } from '../types';
import { participantFromState } from '../types';

interface RoomRow {
  id: string;
  name: string;
  owner_id: string;
  participants: Record<string, unknown>;
  is_recording: boolean;
  recording_started_at: number | null;
  created_at: number;
}

interface ParticipantState {
  id: string;
  name: string;
  color: string;
  is_muted: boolean;
  volume: number;
  joined_at: number;
}

export function LandingPage() {
  const { user, setUser, setRoom, setError } = useStore();
  const [name, setName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');

  const handleCreateRoom = useCallback(async () => {
    if (!name.trim() || !roomName.trim()) {
      setError('Por favor, preencha seu nome e o nome da sala');
      return;
    }

    setIsCreating(true);
    setError(null);

    const userId = uuidv4();
    const newUser = {
      id: userId,
      name: name.trim(),
      color: '#58a6ff',
    };

    setUser(newUser);

    const room = await createRoom(roomName.trim(), userId, name.trim());

    if (room) {
      const newRoom: Room = {
        id: room.id,
        name: roomName.trim(),
        ownerId: userId,
        participants: [{
          ...newUser,
          isLocal: true,
          isMuted: false,
          volume: 1,
          level: 0,
          isRecording: false,
        }],
        createdAt: Date.now(),
        isRecording: false,
      };
      setRoom(newRoom);
    } else {
      setError('Erro ao criar sala. Tente novamente.');
      setIsCreating(false);
    }
  }, [name, roomName, setUser, setRoom, setError]);

  const handleJoinRoom = useCallback(async () => {
    if (!name.trim() || !joinRoomId.trim()) {
      setError('Por favor, preencha seu nome e o ID da sala');
      return;
    }

    setIsJoining(true);
    setError(null);

    const userId = uuidv4();
    const newUser = {
      id: userId,
      name: name.trim(),
      color: '#58a6ff',
    };

    setUser(newUser);

    const success = await joinRoom(joinRoomId.trim(), userId, name.trim());

    if (success) {
      const roomData = await getRoom(joinRoomId.trim());
      if (roomData) {
        const roomRow = roomData as unknown as RoomRow;
        const newRoom: Room = {
          id: roomRow.id,
          name: roomRow.name,
          ownerId: roomRow.owner_id,
          participants: Object.values(roomRow.participants).map((p) => {
            const participant = p as ParticipantState;
            return participantFromState(participant, participant.id === userId);
          }),
          createdAt: roomRow.created_at,
          isRecording: roomRow.is_recording,
          recordingStartedAt: roomRow.recording_started_at ?? undefined,
        };
        setRoom(newRoom);
      }
    } else {
      setError('Erro ao entrar na sala. Verifique o ID e tente novamente.');
      setIsJoining(false);
    }
  }, [name, joinRoomId, setUser, setRoom, setError]);

  const handleLogout = useCallback(() => {
    setUser(null);
    setRoom(null);
  }, [setUser, setRoom]);

  return (
    <div className="min-h-screen bg-studio-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-studio-text mb-2">
            <span className="text-studio-accent">Pod</span>FalarAgora
          </h1>
          <p className="text-studio-text-muted">Estúdio Web de Gravação e Podcast</p>
        </div>

        <div className="card space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-studio-text mb-2">
              Seu Nome
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como você quer ser chamado?"
              className="input"
              autoFocus
            />
          </div>

          <div className="border-t border-studio-border pt-6">
            <h2 className="text-lg font-semibold text-studio-text mb-4">Criar Nova Sala</h2>
            <div className="space-y-3">
              <div>
                <label htmlFor="roomName" className="block text-sm font-medium text-studio-text mb-2">
                  Nome da Sala
                </label>
                <input
                  id="roomName"
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Ex: Podcast Semanal, Entrevista, etc."
                  className="input"
                />
              </div>
              <button
                onClick={handleCreateRoom}
                disabled={isCreating || !name.trim() || !roomName.trim()}
                className="btn-primary w-full"
              >
                {isCreating ? 'Criando...' : 'Criar Sala e Entrar'}
              </button>
            </div>
          </div>

          <div className="border-t border-studio-border pt-6">
            <h2 className="text-lg font-semibold text-studio-text mb-4">Entrar em Sala Existente</h2>
            <div className="space-y-3">
              <div>
                <label htmlFor="joinRoomId" className="block text-sm font-medium text-studio-text mb-2">
                  ID da Sala
                </label>
                <input
                  id="joinRoomId"
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                  placeholder="ABC123XY"
                  className="input text-center font-mono text-lg tracking-widest"
                  maxLength={8}
                />
              </div>
              <button
                onClick={handleJoinRoom}
                disabled={isJoining || !name.trim() || !joinRoomId.trim()}
                className="btn-secondary w-full"
              >
                {isJoining ? 'Entrando...' : 'Entrar na Sala'}
              </button>
            </div>
          </div>

          {user && (
            <div className="border-t border-studio-border pt-4 text-center">
              <p className="text-studio-text-muted text-sm">
                Logado como <span className="font-medium text-studio-text">{user.name}</span>
              </p>
            </div>
          )}
        </div>

        {user && (
          <div className="mt-6 text-center">
            <button
              onClick={handleLogout}
              className="btn-ghost text-studio-text-muted hover:text-studio-danger"
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </div>
  );
}