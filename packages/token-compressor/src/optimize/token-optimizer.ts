import type {
  CompressionParams,
  FramePipelineOptions,
  OptimizationDecision,
} from '../types';

/**
 * Token 优化器：综合决策器
 * 根据变化检测、RPM、场景分类结果决定是否发送以及使用何种压缩参数
 */
export class TokenOptimizer {
  constructor(private readonly options: FramePipelineOptions = {}) {}

  decide(
    _input: {
      changeScore: number;
      hasSignificantChange: boolean;
      currentHash?: string;
      previousHash?: string;
    },
  ): OptimizationDecision {
    throw new Error('Not implemented');
  }
}
