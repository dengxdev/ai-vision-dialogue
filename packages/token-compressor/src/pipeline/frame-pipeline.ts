import { AdaptiveCompressor } from '../compress/adaptive-compressor';
import { ChangeDetector } from '../detect/change-detector';
import { Djb2HashStrategy } from '../hash/djb2-hash';
import { PerceptualHashStrategy } from '../hash/perceptual-hash';
import type { HashStrategy } from '../hash/hash-strategy';
import { TokenOptimizer } from '../optimize/token-optimizer';
import type {
  CompressionParams,
  CompressionResult,
  FramePipelineOptions,
  FramePipelineResult,
} from '../types';

/**
 * 帧管道编排器
 *
 * 将图像采集 → 自适应压缩 → 变化检测 → 感知哈希 → Token 优化决策
 * 串联成一条完整流水线，是 token-compressor 包对外暴露的核心入口。
 */
export class FramePipeline {
  private readonly compressor: AdaptiveCompressor;
  private readonly changeDetector: ChangeDetector;
  private readonly hasher: HashStrategy;
  private readonly optimizer: TokenOptimizer;
  private readonly options: Required<
    Pick<
      FramePipelineOptions,
      | 'maxWidth'
      | 'quality'
      | 'changeThreshold'
      | 'sampleStep'
      | 'currentRPM'
      | 'rpmLimit'
    >
  > &
    FramePipelineOptions;

  constructor(options: FramePipelineOptions = {}) {
    this.options = {
      maxWidth: 512,
      quality: 0.7,
      changeThreshold: 0.15,
      sampleStep: 16,
      currentRPM: 0,
      rpmLimit: 60,
      ...options,
    };

    this.compressor = new AdaptiveCompressor(this.options);
    this.changeDetector = new ChangeDetector({
      threshold: this.options.changeThreshold,
      sampleStep: this.options.sampleStep,
    });
    this.hasher = options.hashStrategy ?? new PerceptualHashStrategy();
    this.optimizer = new TokenOptimizer(this.options);
  }

  /**
   * 处理单帧：压缩 → 变化检测 → 哈希 → 优化决策
   *
   * @param source HTMLVideoElement 或 base64 图像字符串
   * @returns 帧管道处理结果
   */
  async process(
    source: HTMLVideoElement | string,
  ): Promise<FramePipelineResult> {
    // Step 1: 自适应压缩
    const compressed = await this.compressor.compress(source);

    // Step 2: 帧间变化检测
    const changeResult = this.changeDetector.detect(
      compressed.imageData,
      compressed.lastImageData,
    );

    // Step 3: 感知哈希
    const perceptualHash = await this.hasher.hash(compressed.base64);

    // Step 4: Token 优化决策
    const shouldSend = this.optimizer.shouldSend({
      changeScore: changeResult.score,
      changeThreshold: this.options.changeThreshold,
      currentRPM: this.options.currentRPM,
      rpmLimit: this.options.rpmLimit,
    });

    // Step 5: 组装结果
    return this.assembleResult(
      compressed,
      changeResult.score,
      changeResult.hasChange,
      perceptualHash,
      shouldSend,
      compressed.params,
    );
  }

  /**
   * 仅压缩，不执行变化检测与哈希
   *
   * @param source HTMLVideoElement 或 base64 图像字符串
   * @returns 压缩结果
   */
  async compressOnly(
    source: HTMLVideoElement | string,
  ): Promise<CompressionResult> {
    return this.compressor.compress(source);
  }

  /**
   * 仅计算 base64 图像的感知哈希
   *
   * @param base64 图像 base64 字符串
   * @returns 哈希字符串
   */
  async hashOnly(base64: string): Promise<string> {
    return this.hasher.hash(base64);
  }

  /**
   * 比较两个哈希的相似度
   *
   * @param hash1 第一个哈希
   * @param hash2 第二个哈希
   * @returns [0, 1] 之间的相似度，1 表示完全一致
   */
  compareHashes(hash1: string, hash2: string): number {
    return this.hasher.similarity(hash1, hash2);
  }

  /**
   * 获取当前 RPM 负载下的最优压缩参数
   *
   * @returns 推荐的压缩参数
   */
  getOptimalParams(): CompressionParams {
    return this.optimizer.getOptimalCompressionParams({
      currentRPM: this.options.currentRPM,
      rpmLimit: this.options.rpmLimit,
    });
  }

  /**
   * 动态更新压缩参数
   *
   * 用于 BFF 推送 RPM 档位更新后，前端无需重建整个流水线即可调整输出质量。
   */
  updateCompressionParams(params: Partial<CompressionParams>): void {
    if (params.maxWidth !== undefined) {
      this.options.maxWidth = params.maxWidth;
    }
    if (params.quality !== undefined) {
      this.options.quality = params.quality;
    }
    this.compressor.updateCompressionParams(params);
  }

  /**
   * 组装帧管道最终结果
   */
  private assembleResult(
    compressed: CompressionResult,
    changeScore: number,
    hasSignificantChange: boolean,
    perceptualHash: string,
    shouldSend: boolean,
    compressionParams: CompressionParams,
  ): FramePipelineResult {
    return {
      base64: compressed.base64,
      width: compressed.width,
      height: compressed.height,
      compressionRatio: compressed.ratio,
      changeScore,
      hasSignificantChange,
      perceptualHash,
      shouldSend,
      compressionParams,
    };
  }
}
