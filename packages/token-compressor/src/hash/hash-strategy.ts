/**
 * 图像哈希策略接口
 * 用于帧间相似度比较与去重
 */
export interface HashStrategy {
  /**
   * 对 base64 图像计算哈希
   */
  hash(base64: string): Promise<string>;

  /**
   * 计算两个哈希之间的相似度，返回 [0, 1] 之间的数值
   * 1 表示完全一致，0 表示完全不同
   */
  similarity(hash1: string, hash2: string): number;

  /**
   * 判断两个哈希是否相似
   * @param threshold 相似度阈值，默认由策略内部决定
   */
  isSimilar(hash1: string, hash2: string, threshold?: number): boolean;
}
