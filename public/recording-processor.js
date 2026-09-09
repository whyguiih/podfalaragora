class RecordingProcessor extends AudioWorkletProcessor {
  private buffers: Float32Array[] = [];
  private bufferLength = 0;
  private isRecording = false;
  private sampleRate: number;
  private numberOfChannels: number;
  private maxBuffers = 1000;

  constructor(options: AudioWorkletNodeOptions) {
    super();
    this.sampleRate = options.processorOptions?.sampleRate ?? sampleRate;
    this.numberOfChannels = options.processorOptions?.numberOfChannels ?? 2;

    this.port.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data);
    };
  }

  private handleMessage(message: { type: string; config?: any }): void {
    switch (message.type) {
      case 'start':
        this.startRecording(message.config);
        break;
      case 'stop':
        this.stopRecording();
        break;
      case 'pause':
        this.pauseRecording();
        break;
      case 'resume':
        this.resumeRecording();
        break;
      case 'getBuffer':
        this.sendBuffer();
        break;
      case 'clear':
        this.clearBuffers();
        break;
    }
  }

  private startRecording(config?: any): void {
    if (config) {
      this.sampleRate = config.sampleRate ?? this.sampleRate;
      this.numberOfChannels = config.numberOfChannels ?? this.numberOfChannels;
    }
    this.buffers = [];
    this.bufferLength = 0;
    this.isRecording = true;
    this.port.postMessage({ type: 'status', status: 'recording' });
  }

  private stopRecording(): void {
    this.isRecording = false;
    this.sendBuffer();
    this.port.postMessage({ type: 'status', status: 'stopped' });
  }

  private pauseRecording(): void {
    this.isRecording = false;
    this.port.postMessage({ type: 'status', status: 'paused' });
  }

  private resumeRecording(): void {
    this.isRecording = true;
    this.port.postMessage({ type: 'status', status: 'recording' });
  }

  private clearBuffers(): void {
    this.buffers = [];
    this.bufferLength = 0;
  }

  private sendBuffer(): void {
    if (this.bufferLength === 0) {
      this.port.postMessage({ type: 'buffer', data: [] });
      return;
    }

    const merged = new Float32Array(this.bufferLength * this.numberOfChannels);
    let offset = 0;

    for (const buffer of this.buffers) {
      merged.set(buffer, offset);
      offset += buffer.length;
    }

    const channels = this.splitChannels(merged);
    this.port.postMessage(
      { type: 'buffer', data: channels },
      channels.map(c => c.buffer)
    );
  }

  private splitChannels(interleaved: Float32Array): Float32Array[] {
    const channels: Float32Array[] = [];
    for (let c = 0; c < this.numberOfChannels; c++) {
      const channelData = new Float32Array(this.bufferLength);
      for (let i = 0; i < this.bufferLength; i++) {
        channelData[i] = interleaved[i * this.numberOfChannels + c];
      }
      channels.push(channelData);
    }
    return channels;
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0];

    if (this.isRecording && input.length > 0) {
      const channelData = input[0];
      const copy = new Float32Array(channelData.length);
      copy.set(channelData);
      this.buffers.push(copy);
      this.bufferLength += channelData.length / this.numberOfChannels;

      if (this.buffers.length > this.maxBuffers) {
        this.buffers = this.buffers.slice(-this.maxBuffers);
      }
    }

    return true;
  }
}

registerProcessor('recording-processor', RecordingProcessor);