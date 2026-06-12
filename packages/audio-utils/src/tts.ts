export interface TTSOptions {
  voice?: string;
  speed?: number;
}

export async function synthesizeSpeech(
  _text: string,
  _options?: TTSOptions,
): Promise<ArrayBuffer> {
  throw new Error('TTS not implemented yet');
}
