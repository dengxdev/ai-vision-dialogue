import { Injectable } from '@nestjs/common';
import type { CostMetrics } from '@ai-vision/shared';

const WINDOW_MS = 60_000;
const COST_PER_1K_TOKENS = 0.02;

interface TokenRecord {
  tokensUsed: number;
  promptTokens?: number;
  completionTokens?: number;
  durationMs: number;
}

interface FrameRecord {
  skipped?: boolean;
  cacheHit?: boolean;
}

class ClientCostStats implements CostMetrics {
  apiCalls = 0;
  visionCalls = 0;
  llmCalls = 0;
  totalTokens = 0;
  inputTokens = 0;
  outputTokens = 0;
  estimatedCostCny = 0;
  rpm = 0;
  windowStart = Date.now();
  framesCaptured = 0;
  framesSkipped = 0;
  cacheHits = 0;
  avgResponseMs = 0;

  totalResponseMs = 0;
}

@Injectable()
export class CostService {
  private readonly stats = new Map<string, ClientCostStats>();

  private getOrCreateStats(clientId: string): ClientCostStats {
    let clientStats = this.stats.get(clientId);
    if (!clientStats) {
      clientStats = new ClientCostStats();
      this.stats.set(clientId, clientStats);
    }
    return clientStats;
  }

  recordFrame(clientId: string, record: FrameRecord): void {
    const stats = this.getOrCreateStats(clientId);
    stats.framesCaptured += 1;
    if (record.skipped) {
      stats.framesSkipped += 1;
    }
    if (record.cacheHit) {
      stats.cacheHits += 1;
    }
  }

  recordVisionCall(clientId: string, record: TokenRecord): void {
    const stats = this.getOrCreateStats(clientId);
    this.rotateRpmWindow(stats);

    stats.apiCalls += 1;
    stats.visionCalls += 1;
    stats.rpm += 1;

    const promptTokens = record.promptTokens ?? record.tokensUsed;
    const completionTokens = record.completionTokens ?? 0;

    stats.totalTokens += record.tokensUsed;
    stats.inputTokens += promptTokens;
    stats.outputTokens += completionTokens;
    stats.totalResponseMs += record.durationMs;

    this.recalculateCostAndLatency(stats);
  }

  recordLLMCall(clientId: string, record: TokenRecord): void {
    const stats = this.getOrCreateStats(clientId);
    this.rotateRpmWindow(stats);

    stats.apiCalls += 1;
    stats.llmCalls += 1;
    stats.rpm += 1;

    const promptTokens = record.promptTokens ?? record.tokensUsed;
    const completionTokens = record.completionTokens ?? 0;

    stats.totalTokens += record.tokensUsed;
    stats.inputTokens += promptTokens;
    stats.outputTokens += completionTokens;
    stats.totalResponseMs += record.durationMs;

    this.recalculateCostAndLatency(stats);
  }

  getMetrics(clientId: string): CostMetrics {
    const stats = this.getOrCreateStats(clientId);
    this.rotateRpmWindow(stats);
    this.recalculateCostAndLatency(stats);
    return { ...stats };
  }

  clearClient(clientId: string): void {
    this.stats.delete(clientId);
  }

  private rotateRpmWindow(stats: ClientCostStats): void {
    const now = Date.now();
    if (now - stats.windowStart >= WINDOW_MS) {
      stats.windowStart = now;
      stats.rpm = 0;
    }
  }

  private recalculateCostAndLatency(stats: ClientCostStats): void {
    stats.estimatedCostCny = (stats.totalTokens / 1000) * COST_PER_1K_TOKENS;
    stats.avgResponseMs =
      stats.apiCalls > 0
        ? Math.round(stats.totalResponseMs / stats.apiCalls)
        : 0;
  }
}
