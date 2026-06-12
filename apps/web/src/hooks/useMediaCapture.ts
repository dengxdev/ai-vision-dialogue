import { useState } from 'react';

export interface FrameCaptureOptions {
  maxWidth: number;
  quality: number;
  enableChangeDetection: boolean;
  changeThreshold: number;
  sampleStep: number;
}

export interface FrameCaptureResult {
  base64: string;
  width: number;
  height: number;
  changeScore: number;
  hasSignificantChange: boolean;
}

export class MediaCaptureEngine {
  private videoStream: MediaStream | null = null;
  private audioStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private lastFrameData: ImageData | null = null;
  private readonly options: Required<FrameCaptureOptions>;

  constructor(options: Partial<FrameCaptureOptions> = {}) {
    this.options = {
      maxWidth: 512,
      quality: 0.7,
      enableChangeDetection: true,
      changeThreshold: 0.15,
      sampleStep: 16,
      ...options,
    };
  }

  /**
   * 初始化摄像头（需在 localhost 或 HTTPS 下运行）
   */
  async initialize(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前浏览器不支持摄像头访问，请在 HTTPS/localhost 环境下运行');
    }

    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`摄像头授权失败: ${message}`);
    }
  }

  /**
   * 将视频流绑定到 video 元素
   */
  bindPreview(videoElement: HTMLVideoElement): void {
    if (!this.videoStream) {
      throw new Error('摄像头未初始化，请先调用 initialize()');
    }

    this.videoElement = videoElement;
    videoElement.srcObject = this.videoStream;
    videoElement.playsInline = true;
    videoElement.muted = true;
    void videoElement.play();
  }

  /**
   * 获取麦克风音频流（按需初始化）
   */
  async getAudioStream(): Promise<MediaStream> {
    if (this.audioStream) {
      return this.audioStream;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前浏览器不支持麦克风访问，请在 HTTPS/localhost 环境下运行');
    }

    this.audioStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    return this.audioStream;
  }

  /**
   * 捕获当前视频帧，进行 Canvas 压缩与帧间变化检测
   * 若画面静止（变化分数 <= 阈值）则返回 null，跳过后续 WebSocket 发送
   */
  captureFrame(): FrameCaptureResult | null {
    if (!this.videoElement || !this.videoStream) {
      console.warn('[MediaCaptureEngine] 摄像头未就绪，跳过捕获');
      return null;
    }

    const video = this.videoElement;
    const { videoWidth, videoHeight } = video;

    if (!videoWidth || !videoHeight || video.readyState < 2) {
      console.warn('[MediaCaptureEngine] 视频流未就绪，跳过捕获');
      return null;
    }

    const { maxWidth, quality, enableChangeDetection, changeThreshold, sampleStep } =
      this.options;

    // 等比缩放，保证长边不超过 maxWidth
    const scale = Math.min(1, maxWidth / Math.max(videoWidth, videoHeight));
    const width = Math.round(videoWidth * scale);
    const height = Math.round(videoHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('[MediaCaptureEngine] 无法创建 2D 上下文');
      return null;
    }

    ctx.drawImage(video, 0, 0, width, height);
    const currentFrameData = ctx.getImageData(0, 0, width, height);

    // 默认首帧或变化检测关闭时视为显著变化
    let changeScore = 1;
    let hasSignificantChange = true;

    if (enableChangeDetection && this.lastFrameData) {
      changeScore = this.computeChangeScore(this.lastFrameData, currentFrameData, sampleStep);
      hasSignificantChange = changeScore > changeThreshold;
    }

    this.lastFrameData = currentFrameData;

    console.log('[MediaCaptureEngine] 压缩后尺寸:', width, 'x', height);
    console.log('[MediaCaptureEngine] changeScore:', changeScore.toFixed(4));
    console.log('[MediaCaptureEngine] hasSignificantChange:', hasSignificantChange);

    if (!hasSignificantChange) {
      console.log('[MediaCaptureEngine] 画面静止，跳过后续 WebSocket 发送');
      return null;
    }

    const base64 = canvas.toDataURL('image/jpeg', quality);

    return {
      base64,
      width,
      height,
      changeScore,
      hasSignificantChange,
    };
  }

  /**
   * 每 sampleStep 像素采样，计算变化像素占比
   */
  private computeChangeScore(prev: ImageData, curr: ImageData, step: number): number {
    const { width, height, data: prevData } = prev;
    const { data: currData } = curr;

    const pixelDiffThreshold = 30;
    let changedSamples = 0;
    let totalSamples = 0;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const rDiff = Math.abs(prevData[idx] - currData[idx]);
        const gDiff = Math.abs(prevData[idx + 1] - currData[idx + 1]);
        const bDiff = Math.abs(prevData[idx + 2] - currData[idx + 2]);

        if (rDiff + gDiff + bDiff > pixelDiffThreshold * 3) {
          changedSamples += 1;
        }
        totalSamples += 1;
      }
    }

    return totalSamples > 0 ? changedSamples / totalSamples : 0;
  }

  /**
   * 释放所有媒体轨道
   */
  dispose(): void {
    this.videoStream?.getTracks().forEach((track) => track.stop());
    this.audioStream?.getTracks().forEach((track) => track.stop());
    this.videoStream = null;
    this.audioStream = null;
    this.videoElement = null;
    this.lastFrameData = null;
  }
}

/**
 * React Hook：提供单例 MediaCaptureEngine
 */
export function useMediaCapture(options: Partial<FrameCaptureOptions> = {}) {
  const [engine] = useState(() => new MediaCaptureEngine(options));
  return engine;
}
