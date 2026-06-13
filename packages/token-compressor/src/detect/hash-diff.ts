import type { ChangeDetectionResult } from '../types';

/**
 * 哈希差异检测
 */
export class HashDiffDetector {
  constructor(private readonly options: { threshold?: number } = {}) {}

  detect(_currentHash: string, _previousHash: string): ChangeDetectionResult {
    throw new Error('Not implemented');
  }
}
