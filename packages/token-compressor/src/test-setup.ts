/**
 * Vitest 测试环境增强
 *
 * jsdom 未实现 ImageData 与完整的 Canvas 2D API，
 * 本文件提供最小可用的 polyfill/mock，使像素差异检测与
 * Canvas 压缩相关单元测试可在 Node 环境中运行。
 */

class ImageDataPolyfill implements ImageData {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
  readonly colorSpace: PredefinedColorSpace;

  constructor(
    dataOrWidth: Uint8ClampedArray | number,
    widthOrHeight: number,
    heightOrOptions?: number | ImageDataSettings,
    options?: ImageDataSettings,
  ) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
      this.colorSpace =
        (heightOrOptions as ImageDataSettings | undefined)?.colorSpace ??
        'srgb';
    } else {
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height =
        typeof heightOrOptions === 'number'
          ? heightOrOptions
          : Math.floor(this.data.length / 4 / this.width);
      this.colorSpace = options?.colorSpace ?? 'srgb';
    }
  }
}

Object.defineProperty(globalThis, 'ImageData', {
  value: ImageDataPolyfill,
  writable: true,
  configurable: true,
});

class MockCanvasRenderingContext2D {
  private canvasWidth = 0;
  private canvasHeight = 0;
  private fillColor: [number, number, number] = [128, 128, 128];

  drawImage(
    source: unknown,
    _dx: number,
    _dy: number,
    dw: number,
    dh: number,
  ): void {
    this.canvasWidth = dw;
    this.canvasHeight = dh;
    this.fillColor = this.inferColor(source);
  }

  getImageData(
    _sx: number,
    _sy: number,
    sw: number,
    sh: number,
  ): ImageData {
    const data = new Uint8ClampedArray(sw * sh * 4);
    const [r, g, b] = this.fillColor;
    for (let i = 0; i < sw * sh; i++) {
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }
    return new ImageData(data, sw, sh);
  }

  fillRect(): void {}

  private inferColor(source: unknown): [number, number, number] {
    const str = String(source);
    if (str.includes('red')) return [255, 0, 0];
    if (str.includes('blue')) return [0, 0, 255];
    if (str.includes('white')) return [255, 255, 255];
    if (str.includes('black')) return [0, 0, 0];
    return [128, 128, 128];
  }
}

class MockCanvas {
  width = 0;
  height = 0;

  getContext(contextId: string) {
    if (contextId === '2d') {
      return new MockCanvasRenderingContext2D() as unknown as CanvasRenderingContext2D;
    }
    return null;
  }

  toDataURL(mimeType?: string, _quality?: unknown): string {
    const type = mimeType ?? 'image/png';
    return `data:${type};base64,bW9jaw==`;
  }

  toBlob(
    callback: (blob: Blob | null) => void,
    mimeType?: string,
    _quality?: unknown,
  ): void {
    const type = mimeType ?? 'image/png';
    callback(new Blob(['mock'], { type }));
  }
}

const originalCreateElement =
  globalThis.document?.createElement.bind(globalThis.document);

Object.defineProperty(globalThis, 'document', {
  value: {
    ...(globalThis.document ?? {}),
    createElement: (tagName: string) => {
      if (tagName === 'canvas') {
        return new MockCanvas() as unknown as HTMLCanvasElement;
      }
      if (originalCreateElement) {
        return originalCreateElement(tagName);
      }
      return {} as HTMLElement;
    },
  },
  writable: true,
  configurable: true,
});

class MockImage {
  crossOrigin = '';
  naturalWidth = 4;
  naturalHeight = 4;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }

  get src(): string {
    return this._src;
  }

  private _src = '';
}

Object.defineProperty(globalThis, 'Image', {
  value: MockImage,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, 'FileReader', {
  value: class MockFileReader {
    result: string | ArrayBuffer | null = null;
    onloadend: (() => void) | null = null;
    onerror: (() => void) | null = null;

    readAsDataURL(blob: Blob): void {
      queueMicrotask(() => {
        this.result = `data:${blob.type};base64,bW9jaw==`;
        this.onloadend?.();
      });
    }
  },
  writable: true,
  configurable: true,
});
