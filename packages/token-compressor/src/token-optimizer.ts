export function estimateImageTokens(width: number, height: number): number {
  // 近似估算：按像素数 / 750 计算 token 数量
  return Math.ceil((width * height) / 750);
}

export function clamp<T extends number>(value: T, min: T, max: T): T {
  return (Math.max(min, Math.min(value, max)) as T);
}
