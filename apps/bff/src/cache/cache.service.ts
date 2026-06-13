import { Injectable } from '@nestjs/common';
import { PerceptualHashStrategy } from '@ai-vision/token-compressor';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const VISUAL_SIMILARITY_THRESHOLD = 0.85;

@Injectable()
export class CacheService {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs = 5 * 60 * 1000; // 5 minutes
  private readonly hasher = new PerceptualHashStrategy();

  async getHash(imageBase64: string): Promise<string> {
    return this.hasher.hash(imageBase64);
  }

  /**
   * 比较两张图片的感知哈希，判断是否在视觉上相似
   */
  async isVisuallySimilar(
    base64A: string,
    base64B: string,
  ): Promise<boolean> {
    const [hashA, hashB] = await Promise.all([
      this.hasher.hash(base64A),
      this.hasher.hash(base64B),
    ]);
    const similarity = this.hasher.similarity(hashA, hashB);
    return similarity > VISUAL_SIMILARITY_THRESHOLD;
  }

  get<T>(key: string): T | undefined {
    this.evictExpired();
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }
    // Move to the end to keep LRU order.
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    this.evictExpired();
    // Remove existing key so the re-insertion updates LRU order.
    this.cache.delete(key);
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }
}
