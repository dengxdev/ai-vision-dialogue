export interface VisionRequest {
  imageBase64: string;
  prompt: string;
  context?: string[];
  maxTokens?: number;
}

export interface VisionResponse {
  text: string;
  objects: DetectedObject[];
  costTokens: number;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  bbox?: [number, number, number, number];
}
