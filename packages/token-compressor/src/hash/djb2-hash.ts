import type { HashStrategy } from './hash-strategy.js';

/**
 * djb2 哈希策略（fallback）
 *
 * 基于 djb2 算法对 base64 图像字符串生成哈希，相似度计算退化为
 * 简单的字符串相等比较。适用于不支持图像解码的环境或作为兜底策略。
 */
export class Djb2HashStrategy implements HashStrategy {
  /**
   * 使用 djb2 算法对 base64 字符串计算哈希
   * @param base64 图像 base64 字符串（可包含 data URI 前缀）
   * @returns 十六进制哈希字符串
   */
  async hash(base64: string): Promise<string> {
    const payload = this.stripDataUri(base64);
    let hash = 5381;
    for (let i = 0; i < payload.length; i++) {
      hash = ((hash << 5) + hash + payload.charCodeAt(i)) | 0;
    }
    return `djb2-${(hash >>> 0).toString(16)}`;
  }

  /**
   * 计算两个哈希之间的相似度
   * @returns 完全相同时为 1，否则为 0
   */
  similarity(hash1: string, hash2: string): number {
    return hash1 === hash2 ? 1 : 0;
  }

  /**
   * 判断两个哈希是否相似
   * @param threshold 相似度阈值，默认为 1
   */
  isSimilar(hash1: string, hash2: string, threshold = 1): boolean {
    return this.similarity(hash1, hash2) >= threshold;
  }

  /**
   * 去除 data URI 前缀，仅保留 base64 payload
   */
  private stripDataUri(base64: string): string {
    const commaIndex = base64.indexOf(',');
    return commaIndex >= 0 ? base64.slice(commaIndex + 1) : base64;
  }
}
