import { useCallback, useRef } from 'react';
import type { RecordingTrack, TrackExportData, MixedExportData, ExportOptions } from '../types';
import { useStore } from '../store';

function normalizeAudio(buffer: AudioBuffer, targetPeak = 0.95): AudioBuffer {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  let peak = 0;

  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }

  if (peak === 0 || peak >= targetPeak) return buffer;

  const gain = targetPeak / peak;
  const audioContext = new AudioContext({ sampleRate: buffer.sampleRate });
  const newBuffer = audioContext.createBuffer(channels, length, buffer.sampleRate);

  for (let c = 0; c < channels; c++) {
    const input = buffer.getChannelData(c);
    const output = newBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      output[i] = input[i] * gain;
    }
  }

  audioContext.close();
  return newBuffer;
}

function trimSilence(buffer: AudioBuffer, threshold = 0.01): AudioBuffer {
  const data = buffer.getChannelData(0);
  const length = buffer.length;
  let start = 0;
  let end = length - 1;

  while (start < length && Math.abs(data[start]) < threshold) start++;
  while (end > start && Math.abs(data[end]) < threshold) end--;

  if (start >= end) return buffer;

  const newLength = end - start + 1;
  const audioContext = new AudioContext({ sampleRate: buffer.sampleRate });
  const newBuffer = audioContext.createBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);

  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const input = buffer.getChannelData(c);
    const output = newBuffer.getChannelData(c);
    for (let i = 0; i < newLength; i++) {
      output[i] = input[start + i];
    }
  }

  audioContext.close();
  return newBuffer;
}

function mixBuffers(buffers: AudioBuffer[]): AudioBuffer {
  if (buffers.length === 0) {
    throw new Error('No buffers to mix');
  }
  if (buffers.length === 1) return buffers[0];

  const maxLength = Math.max(...buffers.map((b) => b.length));
  const sampleRate = buffers[0].sampleRate;
  const channels = 2;

  const audioContext = new AudioContext({ sampleRate });
  const mixedBuffer = audioContext.createBuffer(channels, maxLength, sampleRate);

  for (let c = 0; c < channels; c++) {
    const output = mixedBuffer.getChannelData(c);
    output.fill(0);

    for (const buffer of buffers) {
      const input = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
      const gain = 1 / buffers.length;
      for (let i = 0; i < buffer.length; i++) {
        output[i] += input[i] * gain;
      }
    }
  }

  audioContext.close();
  return mixedBuffer;
}

async function encodeWav(
  channels: Float32Array[],
  sampleRate: number,
  bitDepth: 16 | 24 | 32,
  _normalize: boolean
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('/wav-encoder.js', import.meta.url));

    worker.onmessage = (event) => {
      if (event.data.type === 'result') {
        resolve(event.data.data);
        worker.terminate();
      } else if (event.data.type === 'error') {
        reject(new Error(event.data.error));
        worker.terminate();
      }
    };

    worker.postMessage({ type: 'encode', channels, sampleRate, bitDepth, normalize: false });
  });
}

export function useAudioExport() {
  const { recordingTracks, setExportedTracks, setMixedExport } = useStore();
  const exportingRef = useRef(false);

  const exportTrack = useCallback(
    async (track: RecordingTrack, options: ExportOptions): Promise<TrackExportData> => {
      const channels: Float32Array[] = [];
      for (let c = 0; c < track.audioBuffer.numberOfChannels; c++) {
        channels.push(track.audioBuffer.getChannelData(c));
      }

      let processedBuffer = track.audioBuffer;

      if (options.normalize) {
        processedBuffer = normalizeAudio(processedBuffer);
      }

      if (options.trimSilence) {
        processedBuffer = trimSilence(processedBuffer);
      }

      const processedChannels: Float32Array[] = [];
      for (let c = 0; c < processedBuffer.numberOfChannels; c++) {
        processedChannels.push(processedBuffer.getChannelData(c));
      }

      const wavBuffer = await encodeWav(processedChannels, options.sampleRate, options.bitDepth, false);
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      return {
        participantId: track.participantId,
        participantName: track.participantName,
        participantColor: track.participantColor,
        blob,
        url,
        duration: track.duration,
        size: blob.size,
      };
    },
    []
  );

  const exportAllTracks = useCallback(
    async (options: ExportOptions): Promise<TrackExportData[]> => {
      if (exportingRef.current) return [];
      exportingRef.current = true;

      try {
        const tracks = Array.from(recordingTracks.values());
        const exported = await Promise.all(tracks.map((track) => exportTrack(track, options)));
        setExportedTracks(exported);
        return exported;
      } finally {
        exportingRef.current = false;
      }
    },
    [recordingTracks, exportTrack, setExportedTracks]
  );

  const exportMixed = useCallback(
    async (options: ExportOptions): Promise<MixedExportData | null> => {
      if (exportingRef.current) return null;
      exportingRef.current = true;

      try {
        const tracks = Array.from(recordingTracks.values());
        if (tracks.length === 0) return null;

        const buffers = tracks.map((t) => t.audioBuffer);
        const mixedBuffer = mixBuffers(buffers);

        let processedBuffer = mixedBuffer;
        if (options.normalize) {
          processedBuffer = normalizeAudio(processedBuffer);
        }
        if (options.trimSilence) {
          processedBuffer = trimSilence(processedBuffer);
        }

        const channels: Float32Array[] = [];
        for (let c = 0; c < processedBuffer.numberOfChannels; c++) {
          channels.push(processedBuffer.getChannelData(c));
        }

        const wavBuffer = await encodeWav(channels, options.sampleRate, options.bitDepth, false);
        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);

        const trackExports = await exportAllTracks(options);

        const mixedExport: MixedExportData = {
          blob,
          url,
          duration: mixedBuffer.duration,
          size: blob.size,
          tracks: trackExports,
        };

        setMixedExport(mixedExport);
        return mixedExport;
      } finally {
        exportingRef.current = false;
      }
    },
    [recordingTracks, exportAllTracks, setMixedExport]
  );

  const revokeUrls = useCallback(() => {
    const { exportedTracks, mixedExport } = useStore.getState();
    exportedTracks.forEach((t) => URL.revokeObjectURL(t.url));
    if (mixedExport) URL.revokeObjectURL(mixedExport.url);
  }, []);

  return {
    exportTrack,
    exportAllTracks,
    exportMixed,
    revokeUrls,
    isExporting: exportingRef.current,
  };
}