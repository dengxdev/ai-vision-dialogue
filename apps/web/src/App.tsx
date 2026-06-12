import { useCallback, useRef, useState } from 'react';
import './App.css';
import { CameraPreview } from './components/CameraPreview';
import { useMediaCapture, FrameCaptureResult } from './hooks/useMediaCapture';
import { config, runtimeStrategy } from './config';

type ToastType = 'success' | 'info' | 'error';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

function App() {
  const engine = useMediaCapture({
    maxWidth: runtimeStrategy.frameMaxWidth,
    quality: runtimeStrategy.quality,
    enableChangeDetection: config.ENABLE_CHANGE_DETECTION,
  });

  const [isReady, setIsReady] = useState(false);
  const [lastResult, setLastResult] = useState<FrameCaptureResult | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const handleReady = useCallback(() => {
    setIsReady(true);
  }, []);

  const handleError = useCallback(
    (message: string) => {
      setIsReady(false);
      showToast(message, 'error');
    },
    [showToast],
  );

  const handleCapture = useCallback(() => {
    const result = engine.captureFrame();
    if (result) {
      setLastResult(result);
      showToast(`已捕获 ${result.width}x${result.height}`, 'success');
    } else {
      showToast('画面变化较小，跳过本次发送', 'info');
    }
  }, [engine, showToast]);

  return (
    <div className="app">
      <div className="camera-backdrop">
        <CameraPreview engine={engine} onReady={handleReady} onError={handleError} />
      </div>

      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-header__logo" aria-hidden="true" />
          <div>
            <h1>AI Vision Dialogue</h1>
            <p>AI 视觉对话助手</p>
          </div>
        </div>
        <div className="app-header__status">
          <span className={`status-dot ${isReady ? 'status-dot--online' : 'status-dot--offline'}`} />
          <span className="status-text">{isReady ? '摄像头就绪' : '初始化中…'}</span>
        </div>
      </header>

      <main className="app-body">
        <div className="hint-badge">Ctrl+Shift+D 成本面板</div>

        {lastResult && (
          <div className="result-chip">
            <div className="result-chip__item">
              <span className="result-chip__label">尺寸</span>
              <span className="result-chip__value">{lastResult.width}x{lastResult.height}</span>
            </div>
            <div className="result-chip__item">
              <span className="result-chip__label">变化</span>
              <span className="result-chip__value">{lastResult.changeScore.toFixed(3)}</span>
            </div>
            <div className="result-chip__item">
              <span className="result-chip__label">有效</span>
              <span className={`result-chip__value ${lastResult.hasSignificantChange ? 'result-chip__value--ok' : ''}`}>
                {lastResult.hasSignificantChange ? '是' : '否'}
              </span>
            </div>
            <div className="result-chip__item">
              <span className="result-chip__label">策略</span>
              <span className="result-chip__value">{runtimeStrategy.frameMaxWidth}px/q{runtimeStrategy.quality}</span>
            </div>
          </div>
        )}

        <div className="controls-bar">
          <button
            className="shutter-button"
            onClick={handleCapture}
            disabled={!isReady}
            title="捕获当前画面"
            aria-label="捕获当前画面"
          >
            <span className="shutter-button__inner" />
          </button>

          <button className="btn btn--secondary" disabled title="语音提问（即将支持）">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            按住说话
          </button>
        </div>
      </main>

      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
