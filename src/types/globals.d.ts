interface AudioWorkletProcessorConstructor {
  new (options: AudioWorkletNodeOptions): AudioWorkletProcessor;
}

interface AudioWorkletProcessor {
  readonly port: MessagePort;
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array[]>): boolean;
}

declare var registerProcessor: (name: string, processorCtor: AudioWorkletProcessorConstructor) => void;

interface AudioWorkletNodeOptions extends AudioNodeOptions {
  processorOptions?: Record<string, unknown>;
  numberOfInputs?: number;
  numberOfOutputs?: number;
  outputChannelCount?: number[];
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface AudioBuffer {
  readonly context: BaseAudioContext;
}