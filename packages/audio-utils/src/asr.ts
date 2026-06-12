export interface ASROptions {
  sampleRate?: number;
  language?: string;
}

export async function transcribeAudio(
  _blob: Blob,
  _options?: ASROptions,
): Promise<string> {
  throw new Error('ASR not implemented yet');
}
