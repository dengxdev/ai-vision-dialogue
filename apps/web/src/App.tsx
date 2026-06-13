import { useCallback, useEffect, useRef, useState } from 'react';
import { ASREngine, TTSEngine } from '@ai-vision/audio-utils';
import './App.css';
import { CameraPreview } from './components/CameraPreview';
import { CostPanel } from './components/CostPanel';
import { VoiceButton } from './components/VoiceButton';
import { useMediaCapture } from './hooks/useMediaCapture';
import { config, runtimeStrategy } from './config';
import { WSClient } from './services/ws-client';
import { CostTracker } from './services/cost-tracker';
import { Orchestrator, type DialogueState } from './orchestrator';
import type { CostMetrics } from '@ai-vision/shared';

type ToastType = 'success' | 'info' | 'error';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const STATE_LABEL: Record<DialogueState, string> = {
  idle: '就绪',
  listening: '聆听中',
  capturing: '捕获画面',
  processing: '思考中',
  speaking: '播报中',
};

function App() {
  const mediaEngine = useMediaCapture({
    maxWidth: runtimeStrategy.frameMaxWidth,
    quality: runtimeStrategy.quality,
    enableChangeDetection: config.ENABLE_CHANGE_DETECTION,
  });

  const [isReady, setIsReady] = useState(false);
  const [state, setState] = useState<DialogueState>('idle');
  const [recognizedText, setRecognizedText] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [panelVisible, setPanelVisible] = useState(false);
  const [bffOnline, setBffOnline] = useState(false);
  const [metrics, setMetrics] = useState<CostMetrics>({
    apiCalls: 0,
    visionCalls: 0,
    llmCalls: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostCny: 0,
    rpm: 0,
    windowStart: Date.now(),
    framesCaptured: 0,
    framesSkipped: 0,
    cacheHits: 0,
    avgResponseMs: 0,
  });

  const orchestratorRef = useRef<Orchestrator | null>(null);
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

  useEffect(() => {
    const asr = new ASREngine();
    const tts = new TTSEngine({ autoResumeOnUserInteraction: true });
    const costTracker = new CostTracker();
    const ws = new WSClient(config.BFF_WS_URL, config.WS_NAMESPACE);

    const orchestrator = new Orchestrator({
      media: mediaEngine,
      asr,
      tts,
      ws,
      costTracker,
    });
    orchestratorRef.current = orchestrator;

    const handleStateChange = (event: Event) => {
      const nextState = (event as CustomEvent<{ state: DialogueState }>).detail.state;
      setState(nextState);
      if (nextState === 'listening') {
        setRecognizedText('');
        setAiReply('');
      }
    };

    const handleTranscript = (event: Event) => {
      const text = (event as CustomEvent<{ text: string }>).detail.text;
      setRecognizedText(text);
    };

    const handleReply = (event: Event) => {
      const reply = (event as CustomEvent<{ reply: string }>).detail.reply;
      setAiReply(reply);
    };

    const handleErrorEvent = (event: Event) => {
      const message = (event as CustomEvent<{ message: string }>).detail.message;
      showToast(message, 'error');
    };

    orchestrator.addEventListener('statechange', handleStateChange);
    orchestrator.addEventListener('transcript', handleTranscript);
    orchestrator.addEventListener('reply', handleReply);
    orchestrator.addEventListener('error', handleErrorEvent);

    const handleWsError = (error: Error) => {
      showToast(`连接服务器失败: ${error.message}`, 'error');
    };
    ws.on('error', handleWsError);

    const handleWsConnected = () => setBffOnline(true);
    const handleWsDisconnected = () => setBffOnline(false);
    ws.on('connected', handleWsConnected);
    ws.on('disconnected', handleWsDisconnected);

    const handleMetrics = (next: CostMetrics) => {
      setMetrics(next);
    };
    ws.on('metrics:result', handleMetrics);

    ws.connect();

    // 连接后立即请求一次，并每 5 秒刷新成本数据
    const requestMetrics = () => ws.requestMetrics();
    requestMetrics();
    const metricsInterval = setInterval(requestMetrics, 5000);

    return () => {
      orchestrator.removeEventListener('statechange', handleStateChange);
      orchestrator.removeEventListener('transcript', handleTranscript);
      orchestrator.removeEventListener('reply', handleReply);
      orchestrator.removeEventListener('error', handleErrorEvent);
      ws.off('error', handleWsError);
      ws.off('connected', handleWsConnected);
      ws.off('disconnected', handleWsDisconnected);
      ws.off('metrics:result', handleMetrics);
      clearInterval(metricsInterval);
      orchestrator.destroy();
      orchestratorRef.current = null;
    };
  }, [mediaEngine, showToast]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setPanelVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePointerDown = useCallback(() => {
    orchestratorRef.current?.startConversation();
  }, []);

  const handlePointerUp = useCallback(() => {
    orchestratorRef.current?.stop();
  }, []);

  const handleStop = useCallback(() => {
    orchestratorRef.current?.stop(true);
  }, []);

  return (
    <div className="app">
      <div className="camera-backdrop">
        <CameraPreview engine={mediaEngine} onReady={handleReady} onError={handleError} />
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
          <span
            className={`status-dot ${isReady && state !== 'idle' ? 'status-dot--online' : 'status-dot--offline'}`}
          />
          <span className="status-text">{isReady ? STATE_LABEL[state] : '初始化中…'}</span>
        </div>
      </header>

      <main className="app-body">
        <div className="hint-badge">Ctrl+Shift+D 成本面板</div>

        <div className="dialogue-stack">
          <div className="result-chip">
            <div className="result-chip__item">
              <span className="result-chip__label">策略</span>
              <span className="result-chip__value">
                {runtimeStrategy.frameMaxWidth}px/q{runtimeStrategy.quality}
              </span>
            </div>
            <div className="result-chip__item">
              <span className="result-chip__label">状态</span>
              <span className="result-chip__value">{STATE_LABEL[state]}</span>
            </div>
          </div>

          {recognizedText && (
            <div className="voice-result-chip">
              <span className="voice-result-chip__label">你说</span>
              <span className="voice-result-chip__text">{recognizedText}</span>
            </div>
          )}

          {aiReply && (
            <div className="voice-result-chip voice-result-chip--reply">
              <span className="voice-result-chip__label">AI</span>
              <span className="voice-result-chip__text">{aiReply}</span>
            </div>
          )}
        </div>

        <div className="controls-bar">
          <VoiceButton
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            isListening={state === 'listening'}
            transcript={recognizedText}
            disabled={!isReady}
          />
          <button
            type="button"
            className="stop-button"
            onClick={handleStop}
            disabled={state === 'idle'}
            aria-label="打断"
          >
            打断
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

      <CostPanel visible={panelVisible} metrics={metrics} online={bffOnline} />
    </div>
  );
}

export default App;
