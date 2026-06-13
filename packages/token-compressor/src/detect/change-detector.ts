import type { ChangeDetectionResult } from '../types';
import { PixelDiffDetector } from './pixel-diff';

/**
 * 变化检测器选项
 */
export interface ChangeDetectorOptions {
  /**
   * 变化分数阈值，超过该值视为有显著变化
   * @default 0.15
   */
  threshold?: number;

  /**
   * 像素采样步长，默认每 16 个像素采样 1 个
   * @default 16
   */
  sampleStep?: number;
}

/**
 * 综合变化检测器
 *
 * 双层变化检测的整合器。当前实现基于像素采样差异（PixelDiff），
 * 后续可扩展为结合哈希差异的混合策略。
 */
export class ChangeDetector {
  private readonly threshold: number;
  private readonly sampleStep: number;

  constructor(private readonly options: ChangeDetectorOptions = {}) {
    this.threshold = options.threshold ?? 0.15;
    this.sampleStep = options.sampleStep ?? 16;
  }

  /**
   * 检测当前帧是否与上一帧存在显著变化
   *
   * @param current 当前帧图像数据
   * @param previous 上一帧图像数据，不存在时视为首帧
   * @returns 变化检测结果
   */
  detect(current: ImageData, previous?: ImageData): ChangeDetectionResult {
    if (!previous) {
      // 首帧或没有历史帧时，强制视为有变化
      return { score: 1, hasChange: true };
    }

    const result = PixelDiffDetector.calculate(
      current,
      previous,
      this.sampleStep,
    );

    return {
      score: result.score,
      hasChange: result.score > this.threshold,
    };
  }
}
