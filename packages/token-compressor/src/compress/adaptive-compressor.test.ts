import { describe, expect, it } from 'vitest';
import { AdaptiveCompressor } from './adaptive-compressor';

class TestAdaptiveCompressor extends AdaptiveCompressor {
  getStrategy() {
    return this.selectStrategy();
  }
}

describe('AdaptiveCompressor', () => {
  it('默认 RPM 返回默认参数', () => {
    const compressor = new TestAdaptiveCompressor({
      maxWidth: 512,
      quality: 0.7,
      currentRPM: 10,
      rpmLimit: 60,
    });
    expect(compressor.getStrategy()).toEqual({
      maxWidth: 512,
      quality: 0.7,
      reason: 'default',
    });
  });

  it('RPM 比率 > 0.5 返回高压参数', () => {
    const compressor = new TestAdaptiveCompressor({
      currentRPM: 40,
      rpmLimit: 60,
    });
    expect(compressor.getStrategy()).toEqual({
      maxWidth: 384,
      quality: 0.6,
      reason: 'rpm-high',
    });
  });

  it('RPM 比率 > 0.8 返回紧急参数', () => {
    const compressor = new TestAdaptiveCompressor({
      currentRPM: 55,
      rpmLimit: 60,
    });
    expect(compressor.getStrategy()).toEqual({
      maxWidth: 256,
      quality: 0.5,
      reason: 'rpm-emergency',
    });
  });

  it('RPM 比率为 0 时返回默认参数', () => {
    const compressor = new TestAdaptiveCompressor({
      currentRPM: 0,
      rpmLimit: 0,
    });
    expect(compressor.getStrategy().reason).toBe('default');
  });
});
