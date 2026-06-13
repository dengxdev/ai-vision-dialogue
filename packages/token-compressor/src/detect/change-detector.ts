import type { ChangeDetectionResult } from '../types';

export interface ChangeDetectorOptions {
  threshold?: number;
  sampleStep?: number;
}

/**
 * 综合变化检测器：可组合像素采样与哈希差异策略
 */
export class ChangeDetector {
  constructor(private readonly options: ChangeDetectorOptions = {}) {}

  detect(_current: ImageData, _previous?: ImageData): ChangeDetectionResult {
    throw new Error('Not implemented');
  }
}
