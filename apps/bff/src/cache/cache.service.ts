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
    // Use the first 256 bytes (characters in base64) as a lightweight key.
    return base64.slice(0, 256);
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
