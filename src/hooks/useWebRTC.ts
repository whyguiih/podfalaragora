import { useEffect, useRef, useCallback, useState } from 'react';
import { createSignalingChannel } from '../utils/supabase';
import type { SignalingMessage } from '../types';
import { useStore } from '../store';

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

interface UseWebRTCReturn {
  createPeerConnection: (participantId: string, isInitiator: boolean) => RTCPeerConnection;
  sendSignal: (message: SignalingMessage) => void;
  onSignal: (callback: (message: SignalingMessage) => void) => void;
  cleanup: () => void;
}

export function useWebRTC(roomId: string, localStream: MediaStream | null): UseWebRTCReturn {
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const signalingChannel = useRef<ReturnType<typeof createSignalingChannel> | null>(null);
  const signalCallback = useRef<((message: SignalingMessage) => void) | null>(null);
  const { removeParticipant, updateParticipant, user } = useStore();
  const [iceServers] = useState(STUN_SERVERS);

  useEffect(() => {
    if (!roomId || !user) return;

    const channel = createSignalingChannel(roomId);

    channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        if (signalCallback.current && payload.from !== user.id) {
          signalCallback.current(payload as SignalingMessage);
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const presence = newPresences[0];
        if (presence.user_id !== user.id) {
          console.log('Participant joined:', presence);
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const presence = leftPresences[0];
        if (presence.user_id !== user.id) {
          removeParticipant(presence.user_id);
          peerConnections.current.get(presence.user_id)?.close();
          peerConnections.current.delete(presence.user_id);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, name: user.name });
        }
      });

    signalingChannel.current = channel;

    return () => {
      channel.untrack();
      channel.unsubscribe();
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
    };
  }, [roomId, user, removeParticipant]);

  const createPeerConnection = useCallback(
    (participantId: string, _isInitiator: boolean): RTCPeerConnection => {
      const pc = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 10,
      });

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({
            type: 'ice-candidate',
            from: user!.id,
            to: participantId,
            payload: event.candidate.toJSON(),
            timestamp: Date.now(),
          });
        }
      };

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        updateParticipant(participantId, {
          stream: remoteStream,
          audioTrack: remoteStream.getAudioTracks()[0],
        });
      };

      pc.onconnectionstatechange = () => {
        console.log(`Connection state with ${participantId}:`, pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          pc.close();
          peerConnections.current.delete(participantId);
        }
      };

      peerConnections.current.set(participantId, pc);
      return pc;
    },
    [localStream, iceServers, user, updateParticipant]
  );

  const sendSignal = useCallback((message: SignalingMessage) => {
    signalingChannel.current?.send({
      type: 'broadcast',
      event: 'signal',
      payload: message,
    });
  }, []);

  const onSignal = useCallback((callback: (message: SignalingMessage) => void) => {
    signalCallback.current = callback;
  }, []);

  const cleanup = useCallback(() => {
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    signalingChannel.current?.unsubscribe();
  }, []);

  return { createPeerConnection, sendSignal, onSignal, cleanup };
}

export async function createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const offer = await pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: false,
  });
  await pc.setLocalDescription(offer);
  return offer;
}

export async function createAnswer(pc: RTCPeerConnection, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
}

export async function handleAnswer(pc: RTCPeerConnection, answer: RTCSessionDescriptionInit): Promise<void> {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

export async function addIceCandidate(pc: RTCPeerConnection, candidate: RTCIceCandidateInit): Promise<void> {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
}