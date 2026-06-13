import type { HashStrategy } from './hash/hash-strategy.js';

/**
 * 压缩参数：描述最终输出图像的尺寸、质量与决策原因
 */
export interface CompressionParams {
  maxWidth: number;
  quality: number;
  reason: 'default' | 'rpm-high' | 'rpm-emergency' | 'scene-degraded';
}

/**
 * 帧管道处理选项
 */
export interface FramePipelineOptions {
  maxWidth?: number;
  quality?: number;
  enableChangeDetection?: boolean;
  changeThreshold?: number;
  sampleStep?: number;
  hashStrategy?: HashStrategy;
  currentRPM?: number;
  rpmLimit?: number;
}

/**
 * 帧管道输出结果
 */
export interface FramePipelineResult {
  base64: string;
  width: number;
  height: number;
  compressionRatio: number;
  changeScore: number;
  hasSignificantChange: boolean;
  perceptualHash: string;
  shouldSend: boolean;
  compressionParams: CompressionParams;
}

/**
 * Canvas 压缩器输出结果
 */
export interface CompressionResult {
  base64: string;
  width: number;
  height: number;
  ratio: number;
  imageData: ImageData;
  lastImageData?: ImageData;
  params: CompressionParams;
}

/**
 * 变化检测结果
 */
export interface ChangeDetectionResult {
  score: number;
  hasChange: boolean;
}

/**
 * Token 优化器综合决策
 */
export interface OptimizationDecision {
  shouldSend: boolean;
  reason: string;
  recommendedParams: CompressionParams;
}
