import { Injectable } from '@nestjs/common';
import { SceneType } from '@ai-vision/shared';

@Injectable()
export class CostGuardian {
  private readonly requests = new Map<string, number[]>();
  private readonly maxRpm = 60;
  private readonly windowMs = 60 * 1000; // rolling 60 seconds

  /**
   * Lightweight scene classification based on a deterministic hash of the
   * beginning of the base64 payload. Real implementations may call a tiny
   * on-device classifier or use heuristics such as entropy / size.
   */
  classifyScene(imageBase64: string): SceneType {
    if (!imageBase64 || imageBase64.length < 1000) {
      return SceneType.LowValue;
    }

    const sample = imageBase64.slice(0, 64);
    let hash = 0;
    for (let i = 0; i < sample.length; i++) {
      hash = (hash << 5) - hash + sample.charCodeAt(i);
      hash |= 0;
    }
    const bucket = Math.abs(hash) % 10;

    if (bucket < 2) {
      return SceneType.LowValue;
    }
    if (bucket > 7) {
      return SceneType.HighDetail;
    }
    return SceneType.General;
  }

  shouldProceed(scene: SceneType): boolean {
    return scene !== SceneType.LowValue;
  }

  /**
   * Sliding-window rate limit: max 60 requests per client per minute.
   */
  checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const window = this.requests.get(clientId) ?? [];
    const active = window.filter((t) => now - t < this.windowMs);
    this.requests.set(clientId, active);
    return active.length < this.maxRpm;
  }

  recordRequest(clientId: string): void {
    const window = this.requests.get(clientId) ?? [];
    window.push(Date.now());
    this.requests.set(clientId, window);
  }
}
