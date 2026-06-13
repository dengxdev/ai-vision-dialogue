import { useEffect, useRef, useState } from 'react';
import type { DialogueState } from '../orchestrator';
import { MediaCaptureEngine } from '../hooks/useMediaCapture';
import './CameraPreview.css';

interface CameraPreviewProps {
  engine: MediaCaptureEngine;
  state?: DialogueState;
  onReady?: () => void;
  onError?: (message: string) => void;
  onPermissionChange?: (state: PermissionState) => void;
  autoInitialize?: boolean;
}

export type PermissionState = 'prompt' | 'granted' | 'denied';

type IndicatorColor = 'gray' | 'red' | 'yellow' | 'green';

function getIndicatorColor(permission: PermissionState, state?: DialogueState): IndicatorColor {
  if (permission === 'prompt') return 'gray';
  if (permission === 'denied') return 'red';
  // granted
  if (state === 'capturing' || state === 'processing') return 'yellow';
  return 'green';
}

export function CameraPreview({
  engine,
  state = 'idle',
  onReady,
  onError,
  onPermissionChange,
  autoInitialize = true,
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>(autoInitialize ? 'prompt' : 'prompt');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updatePermission = (next: PermissionState) => {
    setPermissionState(next);
    onPermissionChange?.(next);
  };

  useEffect(() => {
    if (!autoInitialize) {
      updatePermission('prompt');
      return;
    }

    let cancelled = false;

    engine
      .initialize()
      .then(() => {
        if (cancelled) return;
        updatePermission('granted');
        if (videoRef.current) {
          engine.bindPreview(videoRef.current);
        }
        onReady?.();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : '无法访问摄像头';
        updatePermission('denied');
        setErrorMessage(message);
        onError?.(message);
      });

    return () => {
      cancelled = true;
      engine.dispose();
    };
  }, [engine, onReady, onError, autoInitialize]);

  const handleRequest = async () => {
    try {
      await engine.initialize();
      updatePermission('granted');
      if (videoRef.current) {
        engine.bindPreview(videoRef.current);
      }
      onReady?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '无法访问摄像头';
      updatePermission('denied');
      setErrorMessage(message);
      onError?.(message);
    }
  };

  const indicatorColor = getIndicatorColor(permissionState, state);

  return (
    <div className="camera-preview">
      <div className={`camera-preview__indicator camera-preview__indicator--${indicatorColor}`} aria-hidden="true" />

      {permissionState === 'prompt' && (
        <div className="camera-preview__overlay">
          <div className="camera-preview__hint">
            <div className="camera-preview__spinner" />
            <h3>等待摄像头授权</h3>
            <p>首次访问请点击浏览器弹窗中的“允许”</p>
            {!autoInitialize && (
              <button type="button" className="camera-preview__cta" onClick={handleRequest}>
                授权并开始
              </button>
            )}
          </div>
        </div>
      )}

      {permissionState === 'denied' && (
        <div className="camera-preview__overlay camera-preview__overlay--error">
          <div className="camera-preview__hint">
            <h3>摄像头访问受限</h3>
            <p>{errorMessage}</p>
            <p className="camera-preview__sub">请在浏览器设置中开启摄像头权限后刷新页面</p>
            <button type="button" className="camera-preview__cta camera-preview__cta--secondary" onClick={handleRequest}>
              重试
            </button>
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
