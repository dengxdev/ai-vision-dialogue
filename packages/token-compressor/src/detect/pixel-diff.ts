import type { ChangeDetectionResult } from '../types';

/**
 * 像素采样差异检测
 */
export class PixelDiffDetector {
  constructor(
    private readonly options: { threshold?: number; sampleStep?: number } = {},
  ) {}

  detect(_current: ImageData, _previous: ImageData): ChangeDetectionResult {
    throw new Error('Not implemented');
  }
}
