import { Injectable } from '@nestjs/common';
import { SceneType } from '@ai-vision/shared';
import {
  TokenOptimizer,
  type CompressionParams,
} from '@ai-vision/token-compressor';

interface TokenBucket {
  tokens: number;
  lastRefillAt: number;
}

@Injectable()
export class CostGuardian {
  private readonly buckets = new Map<string, TokenBucket>();
  private readonly requests = new Map<string, number[]>();
  private readonly maxRpm = 60;
  private readonly windowMs = 60 * 1000; // rolling 60 seconds
  private readonly optimizer = new TokenOptimizer({ rpmLimit: this.maxRpm });

  /**
   * 根据 base64 大小快速判断场景类型：
   * - 极小 payload 视为空白帧（BLANK）
   * - 其余视为正常帧（NORMAL）
   *
   * STATIC / TRANSITION 由调用方结合缓存/哈希变化检测补充。
   */
  classifyScene(imageBase64: string): SceneType {
    if (!imageBase64 || imageBase64.length < 1000) {
      return SceneType.Blank;
    }
    return SceneType.Normal;
  }

  /**
   * BLANK / STATIC / TRANSITION 帧直接跳过，不调用视觉 API。
   */
  shouldProceed(scene: SceneType): boolean {
    return (
      scene !== SceneType.Blank &&
      scene !== SceneType.Static &&
      scene !== SceneType.Transition
    );
  }

  /**
   * 根据当前全局 RPM 动态选择压缩档位：
   * - RPM > 48 → 256x256, quality 0.5
   * - RPM > 30 → 384x384, quality 0.6
   * - 其他     → 512x512, quality 0.7
   */
  selectResolutionTier(): CompressionParams {
    return this.optimizer.getOptimalCompressionParams({
      currentRPM: this.getCurrentRpm(),
      rpmLimit: this.maxRpm,
    });
  }

  /**
   * 令牌桶限流，默认桶容量 60、每秒补充 1 个 token。
   */
  checkRateLimit(clientId: string): boolean {
    const bucket = this.getBucket(clientId);
    this.refillBucket(bucket);
    return bucket.tokens > 0;
  }

  recordRequest(clientId: string): void {
    const bucket = this.getBucket(clientId);
    this.refillBucket(bucket);
    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
    }

    const window = this.requests.get(clientId) ?? [];
    window.push(Date.now());
    this.requests.set(clientId, window);
  }

  /**
   * 计算最近 60 秒内所有客户端的总 RPM（用于动态降级）。
   */
  getCurrentRpm(): number {
    const now = Date.now();
    let total = 0;
    for (const window of this.requests.values()) {
      total += window.filter((t) => now - t < this.windowMs).length;
    }
    return total;
  }

  private getBucket(clientId: string): TokenBucket {
    let bucket = this.buckets.get(clientId);
    if (!bucket) {
      bucket = { tokens: this.maxRpm, lastRefillAt: Date.now() };
      this.buckets.set(clientId, bucket);
    }
    return bucket;
  }

  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const secondsPassed = Math.floor((now - bucket.lastRefillAt) / 1000);
    if (secondsPassed > 0) {
      bucket.tokens = Math.min(this.maxRpm, bucket.tokens + secondsPassed);
      bucket.lastRefillAt = now;
    }
  }
}
