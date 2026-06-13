import { describe, expect, it } from 'vitest';
import { PerceptualHashStrategy } from './perceptual-hash';

/**
 * 8x8 左红右蓝 PNG
 */
const RED_BLUE_HORIZONTAL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFUlEQVQImWP4z8AAR0jM/8jMISABAOkwP8E7S65XAAAAAElFTkSuQmCC';

/**
 * 8x8 上红下蓝 PNG
 */
const RED_BLUE_VERTICAL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAF0lEQVQImWP4z8CAFWEXJU+CqoZhlwAA6TA/wYYgiG8AAAAASUVORK5CYII=';

describe('PerceptualHashStrategy', () => {
  const hasher = new PerceptualHashStrategy();

  it('应为相同图像生成 64 位哈希', async () => {
    const h = await hasher.hash(RED_BLUE_HORIZONTAL);
    expect(h).toHaveLength(64);
    expect(/^[01]+$/.test(h)).toBe(true);
  });

  it('相同图像哈希相似度为 1', async () => {
    const h1 = await hasher.hash(RED_BLUE_HORIZONTAL);
    const h2 = await hasher.hash(RED_BLUE_HORIZONTAL);
    expect(hasher.similarity(h1, h2)).toBe(1);
    expect(hasher.isSimilar(h1, h2)).toBe(true);
  });

  it('不同图像哈希相似度应低于 1', async () => {
    const h1 = await hasher.hash(RED_BLUE_HORIZONTAL);
    const h2 = await hasher.hash(RED_BLUE_VERTICAL);
    expect(hasher.similarity(h1, h2)).toBeLessThan(1);
  });

  it('不同长度哈希相似度为 0', () => {
    expect(hasher.similarity('1010', '101')).toBe(0);
  });

  it('isSimilar 阈值可自定义', () => {
    expect(hasher.isSimilar('11110000', '11110000', 0.9)).toBe(true);
    expect(hasher.isSimilar('11110000', '00001111', 0.9)).toBe(false);
  });
});
