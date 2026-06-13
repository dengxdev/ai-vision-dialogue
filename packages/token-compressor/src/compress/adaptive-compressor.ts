import type { CompressionParams, FramePipelineOptions } from '../types';

export interface AdaptiveCompressorOptions {
  currentRPM?: number;
  rpmLimit?: number;
  defaultParams?: CompressionParams;
}

/**
 * RPM 驱动的自适应压缩器
 * 根据当前调用速率动态调整输出分辨率与质量
 */
export class AdaptiveCompressor {
  constructor(private readonly options: AdaptiveCompressorOptions = {}) {}

  decideParams(): CompressionParams {
    throw new Error('Not implemented');
  }
}
