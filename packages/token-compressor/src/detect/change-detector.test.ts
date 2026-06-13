import { describe, expect, it } from 'vitest';
import { ChangeDetector } from './change-detector';

function createImageData(
  width: number,
  height: number,
  color: [number, number, number],
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = color[0];
    data[i * 4 + 1] = color[1];
    data[i * 4 + 2] = color[2];
    data[i * 4 + 3] = 255;
  }
  return new ImageData(data, width, height);
}

describe('ChangeDetector', () => {
  it('previous 不存在时视为首帧，分数为 1', () => {
    const detector = new ChangeDetector();
    const current = createImageData(8, 8, [255, 255, 255]);
    const result = detector.detect(current);
    expect(result.score).toBe(1);
    expect(result.hasChange).toBe(true);
  });

  it('完全相同帧应判定为无变化', () => {
    const detector = new ChangeDetector({ threshold: 0.15, sampleStep: 4 });
    const current = createImageData(16, 16, [128, 128, 128]);
    const result = detector.detect(current, current);
    expect(result.score).toBe(0);
    expect(result.hasChange).toBe(false);
  });

  it('差异超过阈值时判定为有变化', () => {
    const detector = new ChangeDetector({ threshold: 0.15, sampleStep: 4 });
    const current = createImageData(16, 16, [255, 255, 255]);
    const previous = createImageData(16, 16, [0, 0, 0]);
    const result = detector.detect(current, previous);
    expect(result.score).toBeGreaterThan(0.9);
    expect(result.hasChange).toBe(true);
  });

  it('轻微差异未超过阈值时判定为无变化', () => {
    const detector = new ChangeDetector({ threshold: 0.99, sampleStep: 4 });
    const current = createImageData(16, 16, [255, 255, 255]);
    const previous = createImageData(16, 16, [250, 250, 250]);
    const result = detector.detect(current, previous);
    expect(result.score).toBeLessThan(0.99);
    expect(result.hasChange).toBe(false);
  });
});
