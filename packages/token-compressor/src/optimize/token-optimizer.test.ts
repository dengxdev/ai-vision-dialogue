import { describe, expect, it } from 'vitest';
import { TokenOptimizer } from './token-optimizer';

describe('TokenOptimizer', () => {
  describe('shouldSend', () => {
    it('变化分数低于阈值时不发送', () => {
      const optimizer = new TokenOptimizer();
      const result = optimizer.shouldSend({
        changeScore: 0.1,
        changeThreshold: 0.15,
        currentRPM: 10,
        rpmLimit: 60,
      });
      expect(result).toBe(false);
    });

    it('变化分数高于阈值时发送', () => {
      const optimizer = new TokenOptimizer();
      const result = optimizer.shouldSend({
        changeScore: 0.2,
        changeThreshold: 0.15,
        currentRPM: 10,
        rpmLimit: 60,
      });
      expect(result).toBe(true);
    });

    it('RPM > 90% 且变化分数低于 threshold*1.5 时不发送', () => {
      const optimizer = new TokenOptimizer();
      const result = optimizer.shouldSend({
        changeScore: 0.2,
        changeThreshold: 0.15,
        currentRPM: 55,
        rpmLimit: 60,
      });
      expect(result).toBe(false);
    });

    it('RPM > 90% 但变化分数高于 threshold*1.5 时发送', () => {
      const optimizer = new TokenOptimizer();
      const result = optimizer.shouldSend({
        changeScore: 0.3,
        changeThreshold: 0.15,
        currentRPM: 55,
        rpmLimit: 60,
      });
      expect(result).toBe(true);
    });
  });

  describe('getOptimalCompressionParams', () => {
    it('默认 RPM 返回默认参数', () => {
      const optimizer = new TokenOptimizer({ maxWidth: 512, quality: 0.7 });
      const params = optimizer.getOptimalCompressionParams({
        currentRPM: 10,
        rpmLimit: 60,
      });
      expect(params).toEqual({
        maxWidth: 512,
        quality: 0.7,
        reason: 'default',
      });
    });

    it('RPM 比率 > 0.5 返回高压参数', () => {
      const optimizer = new TokenOptimizer();
      const params = optimizer.getOptimalCompressionParams({
        currentRPM: 40,
        rpmLimit: 60,
      });
      expect(params).toEqual({
        maxWidth: 384,
        quality: 0.6,
        reason: 'rpm-high',
      });
    });

    it('RPM 比率 > 0.8 返回紧急参数', () => {
      const optimizer = new TokenOptimizer();
      const params = optimizer.getOptimalCompressionParams({
        currentRPM: 55,
        rpmLimit: 60,
      });
      expect(params).toEqual({
        maxWidth: 256,
        quality: 0.5,
        reason: 'rpm-emergency',
      });
    });
  });

  describe('decide', () => {
    it('无显著变化时返回不发送', () => {
      const optimizer = new TokenOptimizer();
      const decision = optimizer.decide({
        changeScore: 0.05,
        hasSignificantChange: false,
      });
      expect(decision.shouldSend).toBe(false);
      expect(decision.reason).toBe('no-significant-change');
    });

    it('有显著变化且 RPM 正常时返回发送', () => {
      const optimizer = new TokenOptimizer({
        changeThreshold: 0.15,
        currentRPM: 10,
        rpmLimit: 60,
      });
      const decision = optimizer.decide({
        changeScore: 0.5,
        hasSignificantChange: true,
      });
      expect(decision.shouldSend).toBe(true);
      expect(decision.recommendedParams.reason).toBe('default');
    });
  });
});
