import { describe, expect, it } from 'vitest';
import { PixelDiffDetector } from './pixel-diff';

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

describe('PixelDiffDetector', () => {
  it('完全相同图像差异分数为 0', () => {
    const frame = createImageData(16, 16, [128, 128, 128]);
    const result = PixelDiffDetector.calculate(frame, frame, 4);
    expect(result.score).toBe(0);
    expect(result.hasChange).toBe(false);
  });

  it('尺寸不一致时视为完全变化', () => {
    const current = createImageData(16, 16, [0, 0, 0]);
    const previous = createImageData(8, 8, [255, 255, 255]);
    const result = PixelDiffDetector.calculate(current, previous, 4);
    expect(result.score).toBe(1);
    expect(result.hasChange).toBe(true);
  });

  it('全黑与全白图像差异分数接近 1', () => {
    const current = createImageData(16, 16, [255, 255, 255]);
    const previous = createImageData(16, 16, [0, 0, 0]);
    const result = PixelDiffDetector.calculate(current, previous, 4);
    expect(result.score).toBeCloseTo(1, 2);
    expect(result.hasChange).toBe(true);
  });

  it('instance detect 应用阈值', () => {
    const detector = new PixelDiffDetector({ threshold: 0.1, sampleStep: 4 });
    const current = createImageData(16, 16, [255, 255, 255]);
    const previous = createImageData(16, 16, [0, 0, 0]);
    const result = detector.detect(current, previous);
    expect(result.score).toBeCloseTo(1, 2);
    expect(result.hasChange).toBe(true);
  });

  it('instance detect 低于阈值时 hasChange 为 false', () => {
    const detector = new PixelDiffDetector({ threshold: 0.99, sampleStep: 4 });
    const current = createImageData(16, 16, [255, 255, 255]);
    const previous = createImageData(16, 16, [250, 250, 250]);
    const result = detector.detect(current, previous);
    expect(result.hasChange).toBe(false);
  });
});
