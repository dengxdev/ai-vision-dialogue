import type { CompressionParams, CompressionResult } from '../types';

/**
 * Canvas 压缩器选项
 */
export interface CanvasCompressorOptions {
  /**
   * 输出 MIME 类型，默认 image/jpeg
   * @default 'image/jpeg'
   */
  mimeType?: string;
}

/**
 * 可绘制到 Canvas 的图像源
 */
export type ImageSource = HTMLVideoElement | HTMLImageElement | string;

/**
 * Canvas JPEG 压缩器
 *
 * 从 useMediaCapture.ts 迁移核心逻辑：
 * 1. 保持宽高比等比缩放
 * 2. 绘制到 Canvas
 * 3. 导出为 JPEG base64
 * 4. 获取 ImageData 用于后续帧间变化检测
 */
export class CanvasCompressor {
  private readonly mimeType: string;
  private lastImageData?: ImageData;

  constructor(private readonly options: CanvasCompressorOptions = {}) {
    this.mimeType = options.mimeType ?? 'image/jpeg';
  }

  /**
   * 压缩图像源
   *
   * @param source 视频元素、图片元素或 base64 图像字符串
   * @param params 压缩参数
   * @returns 压缩结果，包含 base64、尺寸、像素数据和压缩比
   */
  async compress(
    source: ImageSource,
    params: CompressionParams,
  ): Promise<CompressionResult> {
    const element = await this.resolveSource(source);
    const { naturalWidth, naturalHeight } = this.getSourceDimensions(element);

    const scale = Math.min(
      1,
      params.maxWidth / Math.max(naturalWidth, naturalHeight),
    );
    const width = Math.round(naturalWidth * scale);
    const height = Math.round(naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('CanvasCompressor: 无法创建 2D 渲染上下文');
    }

    ctx.drawImage(element, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const base64 = await this.canvasToBase64(canvas, params.quality);

    const originalPixels = naturalWidth * naturalHeight;
    const compressedPixels = width * height;
    const ratio =
      originalPixels > 0 ? originalPixels / compressedPixels : 1;

    const result: CompressionResult = {
      base64,
      width,
      height,
      ratio,
      imageData,
      lastImageData: this.lastImageData,
      params,
    };

    this.lastImageData = imageData;
    return result;
  }

  /**
   * 将图像源解析为可绘制元素
   */
  private async resolveSource(
    source: ImageSource,
  ): Promise<HTMLVideoElement | HTMLImageElement> {
    if (typeof source === 'string') {
      return this.loadImage(source);
    }
    return source;
  }

  /**
   * 加载 base64 或 URL 为 HTMLImageElement
   */
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error('CanvasCompressor: 图像加载失败'));
      image.src = src;
    });
  }

  /**
   * 获取源的原始尺寸
   */
  private getSourceDimensions(
    element: HTMLVideoElement | HTMLImageElement,
  ): { naturalWidth: number; naturalHeight: number } {
    if (element instanceof HTMLVideoElement) {
      return {
        naturalWidth: element.videoWidth,
        naturalHeight: element.videoHeight,
      };
    }
    return {
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
    };
  }

  /**
   * 将 Canvas 内容转换为 base64 JPEG
   *
   * 优先使用 toBlob 获得更小的输出，降级使用 toDataURL。
   */
  private canvasToBase64(
    canvas: HTMLCanvasElement,
    quality: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('CanvasCompressor: toBlob 返回空'));
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result;
              if (typeof result === 'string') {
                resolve(result);
              } else {
                reject(new Error('CanvasCompressor: FileReader 结果异常'));
              }
            };
            reader.onerror = () =>
              reject(new Error('CanvasCompressor: FileReader 读取失败'));
            reader.readAsDataURL(blob);
          },
          this.mimeType,
          quality,
        );
      } else {
        resolve(canvas.toDataURL(this.mimeType, quality));
      }
    });
  }
}
