import { describe, expect, it } from 'vitest';
import { CanvasCompressor } from './canvas-compressor';

/**
 * 1x1 红色 PNG base64（mock Image 会忽略真实尺寸，固定为 4x4）
 */
const RED_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('CanvasCompressor', () => {
  it('应能压缩 base64 图像', async () => {
    const compressor = new CanvasCompressor();
    const result = await compressor.compress(RED_PNG, {
      maxWidth: 512,
      quality: 0.7,
      reason: 'default',
    });

    expect(result.base64.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.ratio).toBe(1);
    expect(result.imageData.width).toBe(4);
    expect(result.imageData.height).toBe(4);
    expect(result.params.maxWidth).toBe(512);
  });

  it('应按 maxWidth 等比缩放', async () => {
    const compressor = new CanvasCompressor();
    const result = await compressor.compress(RED_PNG, {
      maxWidth: 2,
      quality: 0.7,
      reason: 'default',
    });

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.ratio).toBe(4);
  });

  it('应维护 lastImageData', async () => {
    const compressor = new CanvasCompressor();
    const params = { maxWidth: 512, quality: 0.7, reason: 'default' as const };

    const first = await compressor.compress(RED_PNG, params);
    expect(first.lastImageData).toBeUndefined();

    const second = await compressor.compress(RED_PNG, params);
    expect(second.lastImageData).toBe(first.imageData);
  });

  it('应支持自定义 MIME 类型', async () => {
    const compressor = new CanvasCompressor({ mimeType: 'image/webp' });
    const result = await compressor.compress(RED_PNG, {
      maxWidth: 512,
      quality: 0.7,
      reason: 'default',
    });
    expect(result.base64.startsWith('data:image/webp;base64,')).toBe(true);
  });
});
