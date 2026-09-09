function floatTo16BitPCM(output, offset, input, normalize) {
  let max = 1;
  if (normalize) {
    for (let i = 0; i < input.length; i++) {
      const abs = Math.abs(input[i]);
      if (abs > max) max = abs;
    }
  }
  for (let i = 0; i < input.length; i++) {
    const val = Math.max(-1, Math.min(1, input[i] / max));
    output.setInt16(offset, Math.round(val * 0x7fff), true);
    offset += 2;
  }
}

function floatTo24BitPCM(output, offset, input, normalize) {
  let max = 1;
  if (normalize) {
    for (let i = 0; i < input.length; i++) {
      const abs = Math.abs(input[i]);
      if (abs > max) max = abs;
    }
  }
  for (let i = 0; i < input.length; i++) {
    const val = Math.max(-1, Math.min(1, input[i] / max));
    const intVal = Math.round(val * 0x7fffff);
    output.setUint8(offset, intVal & 0xff);
    output.setUint8(offset + 1, (intVal >> 8) & 0xff);
    output.setUint8(offset + 2, (intVal >> 16) & 0xff);
    offset += 3;
  }
}

function floatTo32BitPCM(output, offset, input, normalize) {
  let max = 1;
  if (normalize) {
    for (let i = 0; i < input.length; i++) {
      const abs = Math.abs(input[i]);
      if (abs > max) max = abs;
    }
  }
  for (let i = 0; i < input.length; i++) {
    const val = Math.max(-1, Math.min(1, input[i] / max));
    output.setFloat32(offset, val, true);
    offset += 4;
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
  return offset + string.length;
}

function createWavHeader(dataLength, sampleRate, channels, bitDepth) {
  const headerLength = 44;
  const buffer = new ArrayBuffer(headerLength);
  const view = new DataView(buffer);

  let offset = 0;
  offset = writeString(view, offset, 'RIFF');
  view.setUint32(offset, 36 + dataLength, true);
  offset += 4;
  offset = writeString(view, offset, 'WAVE');
  offset = writeString(view, offset, 'fmt ');
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, channels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * channels * (bitDepth / 8), true);
  offset += 4;
  view.setUint16(offset, channels * (bitDepth / 8), true);
  offset += 2;
  view.setUint16(offset, bitDepth, true);
  offset += 2;
  offset = writeString(view, offset, 'data');
  view.setUint32(offset, dataLength, true);

  return buffer;
}

self.onmessage = function(event) {
  const { channels, sampleRate, bitDepth, normalize } = event.data;

  if (!channels || channels.length === 0) {
    self.postMessage({ type: 'error', error: 'No audio data provided' });
    return;
  }

  const length = channels[0].length;
  const numChannels = channels.length;
  const bytesPerSample = bitDepth / 8;
  const dataLength = length * numChannels * bytesPerSample;

  const header = createWavHeader(dataLength, sampleRate, numChannels, bitDepth);
  const wavBuffer = new ArrayBuffer(header.byteLength + dataLength);
  const view = new DataView(wavBuffer);

  new Uint8Array(wavBuffer).set(new Uint8Array(header), 0);

  let offset = header.byteLength;

  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = channels[c][i];
      switch (bitDepth) {
        case 16:
          const val16 = Math.max(-1, Math.min(1, sample));
          view.setInt16(offset, Math.round(val16 * 0x7fff), true);
          offset += 2;
          break;
        case 24:
          const val24 = Math.max(-1, Math.min(1, sample));
          const int24 = Math.round(val24 * 0x7fffff);
          view.setUint8(offset, int24 & 0xff);
          view.setUint8(offset + 1, (int24 >> 8) & 0xff);
          view.setUint8(offset + 2, (int24 >> 16) & 0xff);
          offset += 3;
          break;
        case 32:
          view.setFloat32(offset, sample, true);
          offset += 4;
          break;
      }
    }

    if (i % 4096 === 0) {
      self.postMessage({ type: 'progress', progress: i / length });
    }
  }

  self.postMessage({ type: 'result', data: wavBuffer }, [wavBuffer]);
};