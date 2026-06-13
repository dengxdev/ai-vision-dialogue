import { describe, expect, it } from 'vitest';
import { Djb2HashStrategy } from '../hash/djb2-hash';
import { FramePipeline } from './frame-pipeline';

/**
 * 1x1 红色 PNG base64
 */
const RED_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/**
 * 1x1 蓝色 PNG base64
 */
const BLUE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

describe('FramePipeline', () => {
  it('应完成完整处理流程', async () => {
    const pipeline = new FramePipeline({
      maxWidth: 64,
      quality: 0.7,
      changeThreshold: 0.15,
      sampleStep: 1,
      hashStrategy: new Djb2HashStrategy(),
      currentRPM: 10,
      rpmLimit: 60,
    });

    const result = await pipeline.process(RED_PNG);

    expect(result.base64.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(result.width).toBeLessThanOrEqual(64);
    expect(result.height).toBeLessThanOrEqual(64);
    expect(result.compressionRatio).toBeGreaterThanOrEqual(1);
    expect(result.changeScore).toBe(1);
    expect(result.hasSignificantChange).toBe(true);
    expect(result.perceptualHash).toBeTruthy();
    expect(result.shouldSend).toBe(true);
    expect(result.compressionParams.reason).toBe('default');
  });

  it('连续相同帧应判定为不发送', async () => {
    const pipeline = new FramePipeline({
      maxWidth: 64,
      quality: 0.7,
      changeThreshold: 0.15,
      sampleStep: 1,
      hashStrategy: new Djb2HashStrategy(),
      currentRPM: 10,
      rpmLimit: 60,
    });

    const first = await pipeline.process(RED_PNG);
    expect(first.shouldSend).toBe(true);

    const second = await pipeline.process(RED_PNG);
    expect(second.changeScore).toBe(0);
    expect(second.hasSignificantChange).toBe(false);
    expect(second.shouldSend).toBe(false);
  });

  it('compressOnly 只压缩不检测', async () => {
    const pipeline = new FramePipeline({
      maxWidth: 64,
      quality: 0.7,
      hashStrategy: new Djb2HashStrategy(),
    });

    const result = await pipeline.compressOnly(RED_PNG);
    expect(result.base64.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(result.params).toBeDefined();
  });

  it('hashOnly 只计算哈希', async () => {
    const pipeline = new FramePipeline({
      hashStrategy: new Djb2HashStrategy(),
    });

    const hash = await pipeline.hashOnly(RED_PNG);
    expect(hash.startsWith('djb2-')).toBe(true);
  });

  it('compareHashes 应返回相似度', async () => {
    const pipeline = new FramePipeline({
      hashStrategy: new Djb2HashStrategy(),
    });

    const h1 = await pipeline.hashOnly(RED_PNG);
    const h2 = await pipeline.hashOnly(RED_PNG);
    const h3 = await pipeline.hashOnly(BLUE_PNG);

    expect(pipeline.compareHashes(h1, h2)).toBe(1);
    expect(pipeline.compareHashes(h1, h3)).toBe(0);
  });

  it('getOptimalParams 应根据 RPM 返回参数', () => {
    const pipeline = new FramePipeline({
      currentRPM: 55,
      rpmLimit: 60,
    });

    const params = pipeline.getOptimalParams();
    expect(params.maxWidth).toBe(256);
    expect(params.quality).toBe(0.5);
    expect(params.reason).toBe('rpm-emergency');
  });
});
