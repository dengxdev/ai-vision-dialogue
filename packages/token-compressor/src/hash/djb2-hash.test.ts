import { describe, expect, it } from 'vitest';
import { Djb2HashStrategy } from './djb2-hash';

describe('Djb2HashStrategy', () => {
  const hasher = new Djb2HashStrategy();

  it('应为相同 base64 生成一致哈希', async () => {
    const h1 = await hasher.hash('data:image/png;base64,abc');
    const h2 = await hasher.hash('data:image/png;base64,abc');
    expect(h1).toBe(h2);
    expect(h1.startsWith('djb2-')).toBe(true);
  });

  it('不同 base64 应生成不同哈希', async () => {
    const h1 = await hasher.hash('data:image/png;base64,abc');
    const h2 = await hasher.hash('data:image/png;base64,def');
    expect(h1).not.toBe(h2);
  });

  it('相似度：相同哈希为 1，不同为 0', async () => {
    const h1 = await hasher.hash('data:image/png;base64,abc');
    const h2 = await hasher.hash('data:image/png;base64,abc');
    const h3 = await hasher.hash('data:image/png;base64,def');
    expect(hasher.similarity(h1, h2)).toBe(1);
    expect(hasher.similarity(h1, h3)).toBe(0);
  });

  it('isSimilar 默认阈值为 1', async () => {
    const h1 = await hasher.hash('data:image/png;base64,abc');
    const h2 = await hasher.hash('data:image/png;base64,abc');
    const h3 = await hasher.hash('data:image/png;base64,def');
    expect(hasher.isSimilar(h1, h2)).toBe(true);
    expect(hasher.isSimilar(h1, h3)).toBe(false);
  });

  it('应正确剥离 data URI 前缀', async () => {
    const h1 = await hasher.hash('data:image/png;base64,abc');
    const h2 = await hasher.hash('data:image/png;base64,xyz');
    expect(h1).not.toBe(h2);
  });
});
