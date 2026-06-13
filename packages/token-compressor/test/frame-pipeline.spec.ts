import { jest } from '@jest/globals';
import type { CompressionParams, CompressionResult, HashStrategy } from '../src/types.js';

const mockCompress = jest.fn();
const mockUpdateParams = jest.fn();

jest.unstable_mockModule('../src/compress/adaptive-compressor.js', () => ({
  AdaptiveCompressor: class MockAdaptiveCompressor {
    async compress(source: unknown): Promise<CompressionResult> {
      return mockCompress(source) as CompressionResult;
    }
    updateCompressionParams(params: Partial<CompressionParams>): void {
      mockUpdateParams(params);
    }
  },
}));

const { FramePipeline } = await import('../src/pipeline/frame-pipeline.js');

describe('FramePipeline', () => {
  const fakeHash = '0'.repeat(64);
  const fakeHasher: HashStrategy = {
    hash: jest.fn().mockResolvedValue(fakeHash),
    similarity: jest.fn().mockReturnValue(1),
    isSimilar: jest.fn().mockReturnValue(true),
  };

  function createImageData(width: number, height: number): ImageData {
    return {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
      colorSpace: 'srgb',
    } as unknown as ImageData;
  }

  function createCompressionResult(): CompressionResult {
    const imageData = createImageData(64, 64);
    return {
      base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD',
      width: 64,
      height: 64,
      ratio: 4,
      imageData,
      lastImageData: imageData,
      params: {
        maxWidth: 512,
        quality: 0.7,
        reason: 'default',
      },
    };
  }

  beforeEach(() => {
    mockCompress.mockReset().mockResolvedValue(createCompressionResult());
    mockUpdateParams.mockReset();
  });

  describe('process', () => {
    it('应返回完整且类型正确的 FramePipelineResult', async () => {
      const pipeline = new FramePipeline({
        maxWidth: 512,
        quality: 0.7,
        changeThreshold: 0.15,
        currentRPM: 10,
        rpmLimit: 60,
        hashStrategy: fakeHasher,
      });

      const source = 'data:image/jpeg;base64,fake';
      const result = await pipeline.process(source);

      expect(result).toBeDefined();
      expect(typeof result.base64).toBe('string');
      expect(result.base64.length).toBeGreaterThan(0);
      expect(typeof result.width).toBe('number');
      expect(typeof result.height).toBe('number');
      expect(typeof result.compressionRatio).toBe('number');
      expect(typeof result.changeScore).toBe('number');
      expect(typeof result.hasSignificantChange).toBe('boolean');
      expect(typeof result.perceptualHash).toBe('string');
      expect(result.perceptualHash.length).toBe(64);
      expect(typeof result.shouldSend).toBe('boolean');
      expect(result.compressionParams).toMatchObject({
        maxWidth: expect.any(Number),
        quality: expect.any(Number),
        reason: expect.any(String),
      });

      expect(mockCompress).toHaveBeenCalledWith(source);
      expect(fakeHasher.hash).toHaveBeenCalled();
    });

    it('变化分数低于阈值时应设置 shouldSend 为 false', async () => {
      // 构造两张完全相同的 ImageData，使变化分数为 0
      const imageData = createImageData(64, 64);
      mockCompress.mockResolvedValue({
        base64: 'data:image/jpeg;base64,fake',
        width: 64,
        height: 64,
        ratio: 1,
        imageData,
        lastImageData: imageData,
        params: {
          maxWidth: 512,
          quality: 0.7,
          reason: 'default',
        },
      } as CompressionResult);

      const pipeline = new FramePipeline({
        changeThreshold: 0.15,
        currentRPM: 10,
        rpmLimit: 60,
        hashStrategy: fakeHasher,
      });

      const result = await pipeline.process('data:image/jpeg;base64,fake');
      expect(result.changeScore).toBe(0);
      expect(result.hasSignificantChange).toBe(false);
      expect(result.shouldSend).toBe(false);
    });
  });
});
