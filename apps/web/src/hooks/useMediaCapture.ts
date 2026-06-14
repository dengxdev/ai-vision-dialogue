import { useState } from 'react';
import {
  Djb2HashStrategy,
  FramePipeline,
  type CompressionParams,
  type FramePipelineResult,
} from '@ai-vision/token-compressor';

export interface FrameCaptureOptions {
  maxWidth: number;
  quality: number;
  enableChangeDetection: boolean;
  changeThreshold: number;
  sampleStep: number;
}

export type FrameCaptureResult = FramePipelineResult;

export class MediaCaptureEngine {
  private videoStream: MediaStream | null = null;
  private audioStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private readonly pipeline: FramePipeline;
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

    this.pipeline = new FramePipeline({
      ...this.options,
      hashStrategy: new Djb2HashStrategy(),
    });
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
   * 捕获当前视频帧，通过 FramePipeline 完成压缩、变化检测与发送决策
   * 若画面静止（shouldSend 为 false）则返回 null，跳过后续 WebSocket 发送
   */
  async captureFrame(): Promise<FramePipelineResult | null> {
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

    const result = await this.pipeline.process(video);

    if (!result.shouldSend) {
      return null;
    }

    return result;
  }

  /**
   * 强制捕获当前视频帧，跳过前端变化检测，用于用户主动发起的对话场景。
   * 画面是否重复由 BFF 的缓存层判断。
   */
  async forceCaptureFrame(): Promise<FramePipelineResult | null> {
    if (!this.videoElement || !this.videoStream) {
      console.warn('[MediaCaptureEngine] 摄像头未就绪，跳过强制捕获');
      return null;
    }

    const video = this.videoElement;
    const { videoWidth, videoHeight } = video;

    if (!videoWidth || !videoHeight || video.readyState < 2) {
      console.warn('[MediaCaptureEngine] 视频流未就绪，跳过强制捕获');
      return null;
    }

    return this.pipeline.forceProcess(video);
  }

  /**
   * 动态更新压缩参数，用于 BFF 推送 RPM 档位后调整前端输出质量
   */
  updateCompressionParams(params: CompressionParams): void {
    this.pipeline.updateCompressionParams(params);
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
  }
}

/**
 * React Hook：提供单例 MediaCaptureEngine
 */
export function useMediaCapture(options: Partial<FrameCaptureOptions> = {}) {
  const [engine] = useState(() => new MediaCaptureEngine(options));
  return engine;
}
