import type { CostMetrics } from '@ai-vision/shared';

const WINDOW_MS = 60_000;
const COST_PER_1K_TOKENS = 0.02;

export class CostTracker extends EventTarget {
  private metrics: CostMetrics;

  constructor() {
    super();
    this.metrics = {
      apiCalls: 0,
      visionCalls: 0,
      llmCalls: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostCny: 0,
      rpm: 0,
      windowStart: Date.now(),
      framesCaptured: 0,
      framesSkipped: 0,
      cacheHits: 0,
      avgResponseMs: 0,
    };
  }

  getMetrics(): CostMetrics {
    return { ...this.metrics };
  }

  recordCall(tokens = 0): void {
    const now = Date.now();

    if (now - this.metrics.windowStart >= WINDOW_MS) {
      this.metrics.windowStart = now;
      this.metrics.rpm = 0;
    }

    this.metrics.apiCalls += 1;
    this.metrics.totalTokens += tokens;
    this.metrics.inputTokens += tokens;
    this.metrics.rpm += 1;
    this.metrics.estimatedCostCny = (this.metrics.totalTokens / 1000) * COST_PER_1K_TOKENS;

    this.dispatchEvent(new CustomEvent<CostMetrics>('change', { detail: this.getMetrics() }));
  }

  reset(): void {
    this.metrics = {
      apiCalls: 0,
      visionCalls: 0,
      llmCalls: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostCny: 0,
      rpm: 0,
      windowStart: Date.now(),
      framesCaptured: 0,
      framesSkipped: 0,
      cacheHits: 0,
      avgResponseMs: 0,
    };
    this.dispatchEvent(new CustomEvent<CostMetrics>('change', { detail: this.getMetrics() }));
  }
}
