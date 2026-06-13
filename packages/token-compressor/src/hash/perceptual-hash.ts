import type { HashStrategy } from './hash-strategy';

/**
 * sharp 构造函数类型
 */
type Sharp = typeof import('sharp').default;

/**
 * 8x8 感知哈希（pHash）策略
 *
 * 实现经典的平均哈希（aHash）算法：
 * 1. 将图像缩放为 8x8 像素
 * 2. 转灰度
 * 3. 计算 64 个灰度像素的平均值
 * 4. 每个像素 >= 平均值记为 '1'，否则记为 '0'
 * 5. 返回 64 位二进制字符串作为感知哈希
 *
 * 该策略对轻微压缩、缩放、颜色抖动具有一定鲁棒性，
 * 适合在 BFF 侧做帧间相似度去重。
 *
 * 使用动态加载 sharp，避免浏览器侧静态打包 Node-only 依赖。
 */
export class PerceptualHashStrategy implements HashStrategy {
  /**
   * 对 base64 图像计算 8x8 感知哈希
   * @param imageBase64 图像 base64 字符串（可包含 data URI 前缀）
   * @returns 64 位二进制哈希字符串
   */
  async hash(imageBase64: string): Promise<string> {
    const sharp = await this.loadSharp();
    const buffer = this.base64ToBuffer(imageBase64);
    const { data } = await sharp(buffer)
      .resize(8, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(data);
    const total = pixels.reduce((sum, value) => sum + value, 0);
    const average = total / pixels.length;

    let hash = '';
    for (const pixel of pixels) {
      hash += pixel >= average ? '1' : '0';
    }
    return hash;
  }

  /**
   * 计算两个哈希之间的相似度
   * 使用汉明距离归一化到 [0, 1]
   * @returns 1 表示完全一致，0 表示完全不同
   */
  similarity(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      return 0;
    }
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++;
      }
    }
    return 1 - distance / hash1.length;
  }

  /**
   * 判断两个哈希是否相似
   * @param threshold 相似度阈值，默认为 0.9
   */
  isSimilar(hash1: string, hash2: string, threshold = 0.9): boolean {
    return this.similarity(hash1, hash2) >= threshold;
  }

  /**
   * 动态加载 sharp 模块
   */
  private async loadSharp(): Promise<Sharp> {
    const sharpModule = await import('sharp');
    const sharpInstance = sharpModule.default;
    if (typeof sharpInstance !== 'function') {
      throw new Error(
        'PerceptualHashStrategy: sharp 模块加载失败，无法计算感知哈希',
      );
    }
    return sharpInstance;
  }

  /**
   * 将 base64 字符串（支持 data URI）转换为 Buffer
   */
  private base64ToBuffer(base64: string): Buffer {
    const payload = this.stripDataUri(base64);
    return Buffer.from(payload, 'base64');
  }

  /**
   * 去除 data URI 前缀，仅保留 base64 payload
   */
  private stripDataUri(base64: string): string {
    const commaIndex = base64.indexOf(',');
    return commaIndex >= 0 ? base64.slice(commaIndex + 1) : base64;
  }
}
