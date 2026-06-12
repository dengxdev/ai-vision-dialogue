import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { CameraPreview } from './components/CameraPreview';
import { VoiceButton } from './components/VoiceButton';
import { useMediaCapture, FrameCaptureResult } from './hooks/useMediaCapture';
import { useTTS } from './hooks/useTTS';
import { config, runtimeStrategy } from './config';
import { WSClient } from './services/ws-client';

type ToastType = 'success' | 'info' | 'error';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

function randomBase64(length: number): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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
  const [recognizedText, setRecognizedText] = useState('');
  const [ttsInput, setTtsInput] = useState('你好，这是语音合成测试。');
  const { speak: speakTTS, stop: stopTTS, isSpeaking } = useTTS();
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

  // WebSocket connectivity test.
  useEffect(() => {
    const wsUrl = (import.meta.env.VITE_BFF_WS_URL as string | undefined)
      ?? 'ws://localhost:3000';
    const ws = new WSClient(wsUrl, 'video');

    const unsubscribeConnected = ws.on('connected', () => {
      console.log('WebSocket connected');
      ws.sendFrame({
        frameId: `test-${Date.now()}`,
        imageBase64: randomBase64(2048),
        timestamp: Date.now(),
      });
    });

    const unsubscribeFrameResult = ws.on('frame:result', (result) => {
      console.log('frame:result', result);
    });

    const unsubscribeError = ws.on('error', (error) => {
      console.error('WebSocket error:', error.message);
    });

    ws.connect();

    return () => {
      unsubscribeConnected();
      unsubscribeFrameResult();
      unsubscribeError();
      ws.disconnect();
    };
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

  const handleTranscript = useCallback((text: string) => {
    setRecognizedText((prev) => prev + text);
  }, []);

  const handleSpeak = useCallback(() => {
    if (!ttsInput.trim()) {
      showToast('请输入要播报的文本', 'info');
      return;
    }
    speakTTS(ttsInput).then(() => {
      showToast('播报完成', 'success');
    });
  }, [ttsInput, speakTTS, showToast]);

  const handleStopTTS = useCallback(() => {
    stopTTS();
  }, [stopTTS]);

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

        {recognizedText && (
          <div className="voice-result-chip">
            <span className="voice-result-chip__label">语音</span>
            <span className="voice-result-chip__text">{recognizedText}</span>
          </div>
        )}

        <div className="tts-panel">
          <input
            type="text"
            className="tts-input"
            value={ttsInput}
            onChange={(e) => setTtsInput(e.target.value)}
            placeholder="输入要播报的文本"
            aria-label="语音合成输入"
          />
          <button
            type="button"
            className="tts-button tts-button--primary"
            onClick={handleSpeak}
            disabled={isSpeaking}
            aria-label="播报"
          >
            {isSpeaking ? (
              <span className="sound-wave" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            ) : (
              '播报'
            )}
          </button>
          <button
            type="button"
            className="tts-button tts-button--danger"
            onClick={handleStopTTS}
            disabled={!isSpeaking}
            aria-label="打断"
          >
            打断
          </button>
        </div>

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

          <VoiceButton onTranscript={handleTranscript} />
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
