import { TokenOptimizer } from '../src/optimize/token-optimizer.js';

describe('TokenOptimizer', () => {
  const optimizer = new TokenOptimizer({ rpmLimit: 60 });

  describe('shouldSend', () => {
    it('changeScore=0.05（低于阈值 0.15）时不应发送', () => {
      const result = optimizer.shouldSend({
        changeScore: 0.05,
        changeThreshold: 0.15,
        currentRPM: 0,
        rpmLimit: 60,
      });
      expect(result).toBe(false);
    });

    it('changeScore=0.3（高于阈值），RPM=30/60 时应发送', () => {
      const result = optimizer.shouldSend({
        changeScore: 0.3,
        changeThreshold: 0.15,
        currentRPM: 30,
        rpmLimit: 60,
      });
      expect(result).toBe(true);
    });

    it('changeScore=0.2，RPM=55/60（>90%）时不应发送（严格模式）', () => {
      const result = optimizer.shouldSend({
        changeScore: 0.2,
        changeThreshold: 0.15,
        currentRPM: 55,
        rpmLimit: 60,
      });
      expect(result).toBe(false);
    });
  });

  describe('getOptimalCompressionParams', () => {
    it('RPM=0 时返回 { maxWidth: 512, quality: 0.7, reason: "default" }', () => {
      const params = optimizer.getOptimalCompressionParams({
        currentRPM: 0,
        rpmLimit: 60,
      });
      expect(params).toEqual({
        maxWidth: 512,
        quality: 0.7,
        reason: 'default',
      });
    });

    it('RPM=40（66%）时返回 { maxWidth: 384, quality: 0.6, reason: "rpm-high" }', () => {
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

    it('RPM=55（92%）时返回 { maxWidth: 256, quality: 0.5, reason: "rpm-emergency" }', () => {
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
});
