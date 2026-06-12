export interface MediaConfig {
  audio: boolean;
  video: boolean;
  videoConstraints?: MediaStreamConstraints['video'];
}

export interface FrameCaptureOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  intervalMs: number;
}

export interface CapturedFrame {
  id: string;
  timestamp: number;
  mimeType: 'image/jpeg';
  data: string; // base64
  width: number;
  height: number;
}

export interface ASRConfig {
  sampleRate: number;
  language: string;
  continuous: boolean;
}

export interface ASRResult {
  text: string;
  isFinal: boolean;
  confidence: number;
}
