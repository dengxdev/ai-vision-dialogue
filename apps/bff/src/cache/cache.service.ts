import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class CacheService {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs = 5 * 60 * 1000; // 5 minutes

  getHash(base64: string): string {
    // 简单感知哈希：对完整 base64 做 djb2，避免仅改尾部就被判为新帧。
    let hash = 5381;
    for (let i = 0; i < base64.length; i++) {
      hash = ((hash << 5) + hash + base64.charCodeAt(i)) | 0;
    }
    return `ph-${(hash >>> 0).toString(16)}`;
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
