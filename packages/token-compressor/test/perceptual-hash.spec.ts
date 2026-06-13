import sharp from 'sharp';
import { PerceptualHashStrategy } from '../src/hash/perceptual-hash.js';

describe('PerceptualHashStrategy', () => {
  const hasher = new PerceptualHashStrategy();

  function createRawBuffer(
    w: number,
    h: number,
    pixelFn: (x: number, y: number) => [number, number, number],
  ): Buffer {
    const data = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const [r, g, b] = pixelFn(x, y);
        const idx = (y * w + x) * 3;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
      }
    }
    return data;
  }

  async function patternToPngBase64(
    w: number,
    h: number,
    pixelFn: (x: number, y: number) => [number, number, number],
  ): Promise<string> {
    const buffer = await sharp(createRawBuffer(w, h, pixelFn), {
      raw: { width: w, height: h, channels: 3 },
    })
      .png()
      .toBuffer();
    return buffer.toString('base64');
  }

  describe('hash', () => {
    it('同一张图片两次 hash 的相似度应为 1.0', async () => {
      const base64 = await patternToPngBase64(64, 64, (x) => [
        Math.floor((x / 64) * 255),
        0,
        0,
      ]);
      const hash1 = await hasher.hash(base64);
      const hash2 = await hasher.hash(base64);
      expect(hash1.length).toBe(64);
      expect(hash2.length).toBe(64);
      expect(hasher.similarity(hash1, hash2)).toBe(1);
    });

    it('两张完全不同的图片相似度应小于 0.5', async () => {
      const gradient = await patternToPngBase64(64, 64, (x) => [
        Math.floor((x / 64) * 255),
        0,
        0,
      ]);
      const inverse = await patternToPngBase64(64, 64, (x) => [
        Math.floor(((63 - x) / 64) * 255),
        0,
        0,
      ]);
      const hashGradient = await hasher.hash(gradient);
      const hashInverse = await hasher.hash(inverse);
      expect(hasher.similarity(hashGradient, hashInverse)).toBeLessThan(0.5);
    });

    it('轻微缩放/裁剪后的相似图片相似度应大于 0.85', async () => {
      const originalBuffer = await sharp(
        createRawBuffer(128, 128, (x) => [
          Math.floor((x / 128) * 255),
          128,
          64,
        ]),
        { raw: { width: 128, height: 128, channels: 3 } },
      )
        .png()
        .toBuffer();

      const originalBase64 = originalBuffer.toString('base64');
      const croppedBuffer = await sharp(originalBuffer)
        .extract({ left: 8, top: 8, width: 112, height: 112 })
        .resize(128, 128)
        .png()
        .toBuffer();
      const croppedBase64 = croppedBuffer.toString('base64');

      const hashOriginal = await hasher.hash(originalBase64);
      const hashCropped = await hasher.hash(croppedBase64);
      expect(hasher.similarity(hashOriginal, hashCropped)).toBeGreaterThan(0.85);
    });

    it('生成的哈希长度应为 64 位', async () => {
      const base64 = await patternToPngBase64(32, 32, (x, y) =>
        (x + y) % 2 === 0 ? [0, 0, 0] : [255, 255, 255],
      );
      const hash = await hasher.hash(base64);
      expect(hash.length).toBe(64);
      expect(hash).toMatch(/^[01]{64}$/);
    });
  });

  describe('similarity', () => {
    it('长度不一致的哈希相似度为 0', () => {
      expect(hasher.similarity('0'.repeat(64), '0'.repeat(32))).toBe(0);
    });
  });
});
