import type { CompressionParams, CompressionResult, FramePipelineOptions } from '../types.js';
import { CanvasCompressor, type ImageSource } from './canvas-compressor.js';

/**
 * RPM 驱动的自适应压缩器
 *
 * 根据当前调用速率（RPM）动态调整输出分辨率与质量，
 * 在高负载时自动降级，降低 API Token 消耗与调用成本。
 */
export class AdaptiveCompressor {
  private maxWidth: number;
  private quality: number;
  private readonly currentRPM: number;
  private readonly rpmLimit: number;
  private readonly compressor: CanvasCompressor;

  constructor(private readonly options: FramePipelineOptions = {}) {
    this.maxWidth = options.maxWidth ?? 512;
    this.quality = options.quality ?? 0.7;
    this.currentRPM = options.currentRPM ?? 0;
    this.rpmLimit = options.rpmLimit ?? 60;
    this.compressor = new CanvasCompressor();
  }

  /**
   * 动态更新压缩参数（如 BFF 下发 RPM 降级后的档位）
   */
  updateCompressionParams(params: Partial<CompressionParams>): void {
    if (params.maxWidth !== undefined) {
      this.maxWidth = params.maxWidth;
    }
    if (params.quality !== undefined) {
      this.quality = params.quality;
    }
  }

  /**
   * 对图像源进行自适应压缩
   *
   * @param source 视频元素或 base64 图像字符串
   * @returns 压缩结果
   */
  async compress(source: ImageSource): Promise<CompressionResult> {
    const params = this.selectStrategy();
    return this.compressor.compress(source, params);
  }

  /**
   * 仅压缩，不更新历史帧数据
   *
   * @param source 视频元素或 base64 图像字符串
   * @returns 压缩结果
   */
  async compressOnly(source: ImageSource): Promise<CompressionResult> {
    return this.compress(source);
  }

  /**
   * 根据当前 RPM 比率选择压缩参数
   *
   * - ratio > 0.8：进入紧急模式，分辨率 256、质量 0.5
   * - ratio > 0.5：进入高压模式，分辨率 384、质量 0.6
   * - 其他：使用默认参数
   */
  protected selectStrategy(): CompressionParams {
    const ratio = this.rpmLimit > 0 ? this.currentRPM / this.rpmLimit : 0;

    if (ratio > 0.8) {
      return { maxWidth: 256, quality: 0.5, reason: 'rpm-emergency' };
    }

    if (ratio > 0.5) {
      return { maxWidth: 384, quality: 0.6, reason: 'rpm-high' };
    }

    return {
      maxWidth: this.maxWidth,
      quality: this.quality,
      reason: 'default',
    };
  }
}
