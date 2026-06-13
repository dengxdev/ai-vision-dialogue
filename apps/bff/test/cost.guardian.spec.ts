import { Test } from '@nestjs/testing';
import { SceneType } from '@ai-vision/shared';
import { CostGuardian } from '../src/cost/cost.guardian';

jest.mock('@ai-vision/token-compressor', () => {
  class MockTokenOptimizer {
    constructor(private readonly options: { rpmLimit?: number } = {}) {}

    getOptimalCompressionParams(input: { currentRPM: number; rpmLimit: number }) {
      const limit = input.rpmLimit || this.options.rpmLimit || 60;
      const ratio = limit > 0 ? input.currentRPM / limit : 0;

      if (ratio > 0.8) {
        return { maxWidth: 256, quality: 0.5, reason: 'rpm-emergency' };
      }
      if (ratio > 0.5) {
        return { maxWidth: 384, quality: 0.6, reason: 'rpm-high' };
      }
      return { maxWidth: 512, quality: 0.7, reason: 'default' };
    }
  }

  return {
    TokenOptimizer: MockTokenOptimizer,
  };
});

describe('CostGuardian', () => {
  let guardian: CostGuardian;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CostGuardian],
    }).compile();

    guardian = moduleRef.get(CostGuardian);
  });

  describe('classifyScene', () => {
    it('空字符串应被识别为 Blank 场景', () => {
      expect(guardian.classifyScene('')).toBe(SceneType.Blank);
    });

    it('小于 1000 字节的小图片应被识别为 Blank 场景', () => {
      expect(guardian.classifyScene('A'.repeat(999))).toBe(SceneType.Blank);
    });

    it('正常大小的图片应被识别为 Normal 场景', () => {
      expect(guardian.classifyScene('A'.repeat(1500))).toBe(SceneType.Normal);
    });
  });

  describe('shouldProceed', () => {
    it('Blank 场景不应继续处理', () => {
      expect(guardian.shouldProceed(SceneType.Blank)).toBe(false);
    });

    it('Static 场景不应继续处理', () => {
      expect(guardian.shouldProceed(SceneType.Static)).toBe(false);
    });

    it('Transition 场景不应继续处理', () => {
      expect(guardian.shouldProceed(SceneType.Transition)).toBe(false);
    });

    it('Normal 场景应继续处理', () => {
      expect(guardian.shouldProceed(SceneType.Normal)).toBe(true);
    });

    it('HighDetail 场景应继续处理', () => {
      expect(guardian.shouldProceed(SceneType.HighDetail)).toBe(true);
    });
  });

  describe('selectResolutionTier', () => {
    it('RPM 为 0 时返回默认参数 512x512 quality 0.7', () => {
      const params = guardian.selectResolutionTier();
      expect(params.maxWidth).toBe(512);
      expect(params.quality).toBe(0.7);
    });

    it('RPM 为 40（66%）时返回 384x384 quality 0.6', () => {
      for (let i = 0; i < 40; i++) {
        guardian.recordRequest('client-a');
      }
      const params = guardian.selectResolutionTier();
      expect(params.maxWidth).toBe(384);
      expect(params.quality).toBe(0.6);
    });

    it('RPM 为 55（92%）时返回 256x256 quality 0.5', () => {
      for (let i = 0; i < 55; i++) {
        guardian.recordRequest('client-b');
      }
      const params = guardian.selectResolutionTier();
      expect(params.maxWidth).toBe(256);
      expect(params.quality).toBe(0.5);
    });
  });

  describe('tryConsume / recordRequest', () => {
    it('同一客户端 60 次内请求应被允许', () => {
      const clientId = 'client-limit';
      let allowed = 0;
      for (let i = 0; i < 60; i++) {
        if (guardian.checkRateLimit(clientId)) {
          guardian.recordRequest(clientId);
          allowed++;
        }
      }
      expect(allowed).toBe(60);
    });

    it('同一客户端第 61 次请求应被拒绝', () => {
      const clientId = 'client-limit-61';
      for (let i = 0; i < 60; i++) {
        expect(guardian.checkRateLimit(clientId)).toBe(true);
        guardian.recordRequest(clientId);
      }
      expect(guardian.checkRateLimit(clientId)).toBe(false);
    });
  });
});
