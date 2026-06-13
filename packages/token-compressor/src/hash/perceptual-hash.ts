import type { HashStrategy } from './hash-strategy';

/**
 * 8x8 感知哈希（pHash）策略
 */
export class PerceptualHashStrategy implements HashStrategy {
  async hash(_base64: string): Promise<string> {
    throw new Error('Not implemented');
  }

  similarity(_hash1: string, _hash2: string): number {
    throw new Error('Not implemented');
  }

  isSimilar(_hash1: string, _hash2: string, _threshold?: number): boolean {
    throw new Error('Not implemented');
  }
}
