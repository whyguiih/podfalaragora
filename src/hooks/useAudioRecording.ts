import { useEffect, useRef, useCallback, useState } from 'react';
import type { RecordingTrack, AudioWorkletMessage, AudioWorkletResponse } from '../types';
import { useStore } from '../store';

interface UseAudioRecordingReturn {
  startRecording: (participantId: string, participantName: string, participantColor: string, stream: MediaStream) => Promise<void>;
  stopRecording: (participantId: string) => Promise<RecordingTrack | null>;
  pauseRecording: (participantId: string) => void;
  resumeRecording: (participantId: string) => void;
  getAudioLevel: (participantId: string) => number;
  isRecording: (participantId: string) => boolean;
}

interface TrackRecorder {
  audioContext: AudioContext;
  workletNode: AudioWorkletNode;
  sourceNode: MediaStreamAudioSourceNode;
  analyserNode: AnalyserNode;
  dataArray: Uint8Array<ArrayBuffer>;
  animationFrame: number;
  startTime: number;
  isPaused: boolean;
  pausedAt: number;
  totalPausedDuration: number;
}

export function useAudioRecording(): UseAudioRecordingReturn {
  const recorders = useRef<Map<string, TrackRecorder>>(new Map());
  const { addRecordingTrack, recordingTracks } = useStore();
  const [audioLevels, setAudioLevels] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const updateLevels = () => {
      const levels = new Map<string, number>();
      recorders.current.forEach((recorder, id) => {
        recorder.analyserNode.getByteFrequencyData(recorder.dataArray);
        const sum = recorder.dataArray.reduce((acc, val) => acc + val, 0);
        const average = sum / recorder.dataArray.length;
        const normalized = Math.min(average / 128, 1);
        levels.set(id, normalized);
      });
      setAudioLevels(levels);
      requestAnimationFrame(updateLevels);
    };
    requestAnimationFrame(updateLevels);
    return () => {
      // cleanup handled by stopRecording
    };
  }, []);

  const startRecording = useCallback(
    async (_participantId: string, _participantName: string, _participantColor: string, stream: MediaStream): Promise<void> => {
      const participantId = _participantId;
      if (recorders.current.has(participantId)) {
        console.warn(`Recorder already exists for ${participantId}`);
        return;
      }

      const audioContext = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive',
      });

      await audioContext.audioWorklet.addModule('/recording-processor.js');

      const workletNode = new AudioWorkletNode(audioContext, 'recording-processor', {
        processorOptions: {
          sampleRate: 48000,
          numberOfChannels: 2,
        },
      });

      const sourceNode = audioContext.createMediaStreamSource(stream);
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.8;

      const dataArray = new Uint8Array(analyserNode.frequencyBinCount) as Uint8Array<ArrayBuffer>;

      sourceNode.connect(analyserNode);
      analyserNode.connect(workletNode);
      workletNode.connect(audioContext.destination);

      workletNode.port.onmessage = (_event: MessageEvent<AudioWorkletResponse>) => {
        // Handle responses if needed
      };

      workletNode.port.postMessage({ type: 'start' } as AudioWorkletMessage);

      const recorder: TrackRecorder = {
        audioContext,
        workletNode,
        sourceNode,
        analyserNode,
        dataArray,
        animationFrame: 0,
        startTime: Date.now(),
        isPaused: false,
        pausedAt: 0,
        totalPausedDuration: 0,
      };

      recorders.current.set(participantId, recorder);
    },
    []
  );

  const stopRecording = useCallback(
    async (participantId: string): Promise<RecordingTrack | null> => {
      const recorder = recorders.current.get(participantId);
      if (!recorder) return null;

      return new Promise((resolve) => {
        const handleMessage = (event: MessageEvent<AudioWorkletResponse>) => {
          if (event.data.type === 'buffer' && event.data.data) {
            const channels = event.data.data as Float32Array<ArrayBuffer>[];
            const sampleRate = recorder.audioContext.sampleRate;
            const length = channels[0].length;

            const audioBuffer = recorder.audioContext.createBuffer(2, length, sampleRate);
            audioBuffer.copyToChannel(channels[0], 0);
            audioBuffer.copyToChannel(channels[1], 1);

            const duration = (Date.now() - recorder.startTime - recorder.totalPausedDuration) / 1000;

            const track: RecordingTrack = {
              participantId,
              participantName: recordingTracks.get(participantId)?.participantName ?? 'Unknown',
              participantColor: recordingTracks.get(participantId)?.participantColor ?? '#58a6ff',
              audioBuffer,
              mimeType: 'audio/wav',
              startTime: recorder.startTime,
              duration,
            };

            recorder.workletNode.port.removeEventListener('message', handleMessage);
            recorder.workletNode.disconnect();
            recorder.sourceNode.disconnect();
            recorder.analyserNode.disconnect();
            recorder.audioContext.close();
            recorders.current.delete(participantId);

            addRecordingTrack(track);
            resolve(track);
          }
        };

        recorder.workletNode.port.addEventListener('message', handleMessage);
        recorder.workletNode.port.postMessage({ type: 'stop' } as AudioWorkletMessage);
      });
    },
    [recordingTracks, addRecordingTrack]
  );

  const pauseRecording = useCallback((participantId: string) => {
    const recorder = recorders.current.get(participantId);
    if (recorder && !recorder.isPaused) {
      recorder.isPaused = true;
      recorder.pausedAt = Date.now();
      recorder.workletNode.port.postMessage({ type: 'pause' } as AudioWorkletMessage);
    }
  }, []);

  const resumeRecording = useCallback((participantId: string) => {
    const recorder = recorders.current.get(participantId);
    if (recorder && recorder.isPaused) {
      recorder.isPaused = false;
      recorder.totalPausedDuration += Date.now() - recorder.pausedAt;
      recorder.workletNode.port.postMessage({ type: 'resume' } as AudioWorkletMessage);
    }
  }, []);

  const getAudioLevel = useCallback((participantId: string): number => {
    return audioLevels.get(participantId) ?? 0;
  }, [audioLevels]);

  const isRecording = useCallback((participantId: string): boolean => {
    return recorders.current.has(participantId);
  }, []);

  return {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    getAudioLevel,
    isRecording,
  };
}