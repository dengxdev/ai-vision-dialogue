import type { ChangeDetectionResult } from '../types';

/**
 * 像素采样差异检测器
 *
 * 通过每 sampleStep 个像素采样一次，计算两帧之间 RGB 差值的平均值，
 * 并将结果归一化到 [0, 1] 区间。该实现从 useMediaCapture.ts 的帧间
 * 变化检测逻辑迁移而来，保持行为一致。
 */
export class PixelDiffDetector {
  constructor(
    private readonly options: { threshold?: number; sampleStep?: number } = {},
  ) {}

  /**
   * 检测当前帧与上一帧之间的像素差异
   * @param current 当前帧图像数据
   * @param previous 上一帧图像数据
   * @returns 变化检测结果
   */
  detect(current: ImageData, previous: ImageData): ChangeDetectionResult {
    const sampleStep = this.options.sampleStep ?? 16;
    const threshold = this.options.threshold ?? 0.15;
    const result = PixelDiffDetector.calculate(current, previous, sampleStep);
    return {
      score: result.score,
      hasChange: result.hasChange && result.score > threshold,
    };
  }

  /**
   * 计算两帧图像的像素采样差异
   *
   * 每 sampleStep 个像素取 1 个样本，计算 RGB 差值的平均值并归一化到 0-1。
   *
   * @param current 当前帧图像数据
   * @param previous 上一帧图像数据
   * @param sampleStep 采样步长，默认 16
   * @returns 变化检测结果，score 为 [0, 1] 的差异分数
   */
  static calculate(
    current: ImageData,
    previous: ImageData,
    sampleStep = 16,
  ): ChangeDetectionResult {
    if (
      current.width !== previous.width ||
      current.height !== previous.height ||
      current.data.length !== previous.data.length
    ) {
      // 尺寸不一致时视为显著变化
      return { score: 1, hasChange: true };
    }

    const { width, height, data: currData } = current;
    const { data: prevData } = previous;

    let totalDiff = 0;
    let sampleCount = 0;

    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const idx = (y * width + x) * 4;
        const rDiff = Math.abs(currData[idx] - prevData[idx]);
        const gDiff = Math.abs(currData[idx + 1] - prevData[idx + 1]);
        const bDiff = Math.abs(currData[idx + 2] - prevData[idx + 2]);

        totalDiff += rDiff + gDiff + bDiff;
        sampleCount++;
      }
    }

    if (sampleCount === 0) {
      return { score: 0, hasChange: false };
    }

    // 每个像素 RGB 三个通道，每个通道最大差值 255
    const maxDiffPerPixel = 3 * 255;
    const score = Math.min(
      1,
      totalDiff / sampleCount / maxDiffPerPixel,
    );

    return { score, hasChange: score > 0 };
  }
}
