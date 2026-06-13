import type { CompressionParams, CompressionResult } from '../types';

export interface CanvasCompressorOptions {
  mimeType?: string;
}

/**
 * Canvas JPEG 压缩器具体实现
 */
export class CanvasCompressor {
  constructor(private readonly options: CanvasCompressorOptions = {}) {}

  async compress(
    _imageData: ImageData,
    _params: CompressionParams,
  ): Promise<CompressionResult> {
    throw new Error('Not implemented');
  }
}
