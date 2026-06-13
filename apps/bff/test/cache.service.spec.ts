import { Test } from '@nestjs/testing';
import { CacheService } from '../src/cache/cache.service';

jest.mock('@ai-vision/token-compressor', () => {
  class MockPerceptualHashStrategy {
    async hash(): Promise<string> {
      return '0'.repeat(64);
    }

    similarity(): number {
      return 1;
    }

    isSimilar(): boolean {
      return true;
    }
  }

  return {
    PerceptualHashStrategy: MockPerceptualHashStrategy,
  };
});

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CacheService],
    }).compile();

    service = moduleRef.get(CacheService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('set / get', () => {
    it('正常存取字符串值', () => {
      service.set('key1', 'value1');
      expect(service.get('key1')).toBe('value1');
    });

    it('正常存取对象值', () => {
      const value = { foo: 'bar', count: 42 };
      service.set('key2', value);
      expect(service.get('key2')).toEqual(value);
    });

    it('未设置的 key 返回 undefined', () => {
      expect(service.get('not-exist')).toBeUndefined();
    });
  });

  describe('TTL', () => {
    it('TTL 过期后 get 返回 undefined', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      service.set('expire-key', 'expire-value');
      expect(service.get('expire-key')).toBe('expire-value');

      // 5 分钟 TTL 刚过期
      jest.spyOn(Date, 'now').mockReturnValue(now + 5 * 60 * 1000 + 1);
      expect(service.get('expire-key')).toBeUndefined();
    });
  });

  describe('LRU 顺序', () => {
    it('最近访问的条目会被移到 Map 末尾', () => {
      service.set('a', 1);
      service.set('b', 2);
      service.set('c', 3);

      // 访问 a，a 应该被移到末尾
      service.get('a');

      // 通过内部 Map 的 keys 迭代顺序验证
      const keys = Array.from((service as unknown as { cache: Map<string, unknown> }).cache.keys());
      expect(keys).toEqual(['b', 'c', 'a']);
    });

    it('set 已存在的 key 会更新其 LRU 顺序', () => {
      service.set('a', 1);
      service.set('b', 2);
      service.set('c', 3);

      // 覆盖 b，b 应该被移到末尾
      service.set('b', 20);

      const keys = Array.from((service as unknown as { cache: Map<string, unknown> }).cache.keys());
      expect(keys).toEqual(['a', 'c', 'b']);
    });
  });
});
