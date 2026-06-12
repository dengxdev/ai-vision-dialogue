import { useEffect, useRef, useState } from 'react';
import { MediaCaptureEngine } from '../hooks/useMediaCapture';
import './CameraPreview.css';

interface CameraPreviewProps {
  engine: MediaCaptureEngine;
  onReady?: () => void;
  onError?: (message: string) => void;
}

type PermissionState = 'prompt' | 'granted' | 'denied';

export function CameraPreview({ engine, onReady, onError }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    engine
      .initialize()
      .then(() => {
        if (cancelled) return;
        setPermissionState('granted');
        if (videoRef.current) {
          engine.bindPreview(videoRef.current);
        }
        onReady?.();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : '无法访问摄像头';
        setPermissionState('denied');
        setErrorMessage(message);
        onError?.(message);
      });

    return () => {
      cancelled = true;
      engine.dispose();
    };
  }, [engine, onReady, onError]);

  return (
    <div className="camera-preview">
      {permissionState === 'prompt' && (
        <div className="camera-preview__overlay">
          <div className="camera-preview__hint">
            <div className="camera-preview__spinner" />
            <h3>等待摄像头授权</h3>
            <p>首次访问请点击浏览器弹窗中的“允许”</p>
          </div>
        </div>
      )}

      {permissionState === 'denied' && (
        <div className="camera-preview__overlay camera-preview__overlay--error">
          <div className="camera-preview__hint">
            <h3>摄像头访问受限</h3>
            <p>{errorMessage}</p>
            <p className="camera-preview__sub">请在浏览器设置中开启摄像头权限后刷新页面</p>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        className="camera-preview__video"
        autoPlay
        playsInline
        muted
        aria-label="摄像头预览"
      />
    </div>
  );
}
