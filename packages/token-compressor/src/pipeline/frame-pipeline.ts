import type { FramePipelineOptions, FramePipelineResult } from '../types';

/**
 * 帧管道编排器
 * 负责把图像采集 → 哈希 → 变化检测 → 自适应压缩 → Token 优化串联起来
 */
export class FramePipeline {
  constructor(private readonly options: FramePipelineOptions = {}) {}

  async process(_imageData: ImageData): Promise<FramePipelineResult> {
    throw new Error('Not implemented');
  }
}
