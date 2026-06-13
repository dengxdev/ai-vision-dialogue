import type {
  CompressionParams,
  FramePipelineOptions,
  OptimizationDecision,
} from '../types.js';

/**
 * Token 优化器综合决策输入
 */
export interface TokenOptimizerDecisionInput {
  changeScore: number;
  changeThreshold: number;
  currentRPM: number;
  rpmLimit: number;
}

/**
 * Token 优化器
 *
 * 综合决策器：根据帧间变化分数与 RPM 负载决定是否发送当前帧，
 * 并返回推荐的压缩参数，从而在视觉 API 调用层面实现成本控制。
 */
export class TokenOptimizer {
  constructor(private readonly options: FramePipelineOptions = {}) {}

  /**
   * 综合判断是否应当发送当前帧
   *
   * 决策规则：
   * 1. 变化分数低于阈值 → 不发送（画面无明显变化）
   * 2. RPM 超过 90% 且变化分数低于阈值 1.5 倍 → 不发送（高压严格模式）
   * 3. 其他情况 → 发送
   *
   * @param input 决策输入
   * @returns 是否发送
   */
  shouldSend(input: TokenOptimizerDecisionInput): boolean {
    const { changeScore, changeThreshold, currentRPM, rpmLimit } = input;

    if (changeScore < changeThreshold) {
      return false;
    }

    const rpmRatio = rpmLimit > 0 ? currentRPM / rpmLimit : 0;
    if (rpmRatio > 0.9 && changeScore < changeThreshold * 1.5) {
      return false;
    }

    return true;
  }

  /**
   * 根据 RPM 负载获取最优压缩参数
   *
   * @param input 包含 currentRPM 与 rpmLimit 的输入
   * @returns 推荐的压缩参数
   */
  getOptimalCompressionParams(input: {
    currentRPM: number;
    rpmLimit: number;
  }): CompressionParams {
    const { currentRPM, rpmLimit } = input;
    const ratio = rpmLimit > 0 ? currentRPM / rpmLimit : 0;

    if (ratio > 0.8) {
      return { maxWidth: 256, quality: 0.5, reason: 'rpm-emergency' };
    }

    if (ratio > 0.5) {
      return { maxWidth: 384, quality: 0.6, reason: 'rpm-high' };
    }

    return {
      maxWidth: this.options.maxWidth ?? 512,
      quality: this.options.quality ?? 0.7,
      reason: 'default',
    };
  }

  /**
   * 兼容旧接口的综合决策方法
   *
   * @param input 包含变化分数与历史哈希的输入
   * @returns 优化决策结果
   */
  decide(input: {
    changeScore: number;
    hasSignificantChange: boolean;
    currentHash?: string;
    previousHash?: string;
  }): OptimizationDecision {
    const currentRPM = this.options.currentRPM ?? 0;
    const rpmLimit = this.options.rpmLimit ?? 60;
    const changeThreshold = this.options.changeThreshold ?? 0.15;

    const shouldSend = this.shouldSend({
      changeScore: input.changeScore,
      changeThreshold,
      currentRPM,
      rpmLimit,
    });

    const recommendedParams = this.getOptimalCompressionParams({
      currentRPM,
      rpmLimit,
    });

    let reason: string;
    if (!input.hasSignificantChange) {
      reason = 'no-significant-change';
    } else if (!shouldSend) {
      reason = 'rpm-throttled';
    } else {
      reason = recommendedParams.reason;
    }

    return {
      shouldSend: shouldSend && input.hasSignificantChange,
      reason,
      recommendedParams,
    };
  }
}
