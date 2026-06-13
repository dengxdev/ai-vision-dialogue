import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ASREngine, TTSEngine } from '@ai-vision/audio-utils';
import './App.css';
import { CameraPreview, type PermissionState } from './components/CameraPreview';
import { ChatPanel, type ChatMessage } from './components/ChatPanel';
import { CostPanel } from './components/CostPanel';
import { StatusBar } from './components/StatusBar';
import { VoiceButton } from './components/VoiceButton';
import { useMediaCapture } from './hooks/useMediaCapture';
import { config, runtimeStrategy } from './config';
import { WSClient } from './services/ws-client';
import { CostTracker } from './services/cost-tracker';
import { Orchestrator, type DialogueState } from './orchestrator';
import type { CostMetricsPayload } from '@ai-vision/contract';

type ToastType = 'success' | 'info' | 'error';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const STATUS_LABEL: Record<DialogueState, string> = {
  idle: '等待中…',
  listening: '聆听中…',
  capturing: '捕获画面中…',
  processing: '思考中…',
  speaking: '说话中…',
};

const EMPTY_METRICS: CostMetricsPayload = {
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
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function App() {
  const mediaEngine = useMediaCapture({
    maxWidth: runtimeStrategy.frameMaxWidth,
    quality: runtimeStrategy.quality,
    enableChangeDetection: config.ENABLE_CHANGE_DETECTION,
  });

  const [isReady, setIsReady] = useState(false);
  const [state, setState] = useState<DialogueState>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [panelVisible, setPanelVisible] = useState(false);
  const [bffOnline, setBffOnline] = useState(false);
  const [metrics, setMetrics] = useState<CostMetricsPayload>(EMPTY_METRICS);
  const [permission, setPermission] = useState<PermissionState>('prompt');
  const [cameraStarted, setCameraStarted] = useState(false);

  const orchestratorRef = useRef<Orchestrator | null>(null);
  const toastIdRef = useRef(0);
  const spacePressedRef = useRef(false);

  const statusText = useMemo(() => {
    if (!isReady) return '初始化中…';
    return STATUS_LABEL[state];
  }, [isReady, state]);

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

  const handlePermissionChange = useCallback((next: PermissionState) => {
    setPermission(next);
  }, []);

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
    };

    const handleTranscript = (event: Event) => {
      const text = (event as CustomEvent<{ text: string }>).detail.text;
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: 'user', content: text, timestamp: Date.now() },
      ]);
    };

    const handleReply = (event: Event) => {
      const { reply, visionUsage } = (event as CustomEvent<{ reply: string; visionUsage?: number }>).detail;
      const hasVisualContext = (visionUsage ?? 0) > 0;

      setMessages((prev) => {
        const next = [...prev];
        // 标记最近一次用户消息也使用了视觉上下文
        const lastUserIndex = next.map((m) => m.role).lastIndexOf('user');
        if (lastUserIndex >= 0) {
          next[lastUserIndex] = { ...next[lastUserIndex], hasVisualContext };
        }
        next.push({
          id: generateId(),
          role: 'assistant',
          content: reply,
          timestamp: Date.now(),
          hasVisualContext,
        });
        return next;
      });
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

    const handleMetrics = (next: CostMetricsPayload) => {
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

  // 键盘快捷键：Ctrl+Shift+D 切换成本面板
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setPanelVisible((prev) => !prev);
        return;
      }

      // 空格键：开始/停止对话（仅在非输入框中、摄像头已启动、且未按住时触发一次）
      if (
        event.code === 'Space' &&
        cameraStarted &&
        !event.repeat &&
        !spacePressedRef.current &&
        !['INPUT', 'TEXTAREA', 'BUTTON'].includes((event.target as HTMLElement)?.tagName || '')
      ) {
        event.preventDefault();
        spacePressedRef.current = true;
        orchestratorRef.current?.startConversation();
      }

      // ESC：打断当前播报
      if (event.code === 'Escape') {
        orchestratorRef.current?.stop(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' && spacePressedRef.current) {
        event.preventDefault();
        spacePressedRef.current = false;
        orchestratorRef.current?.stop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [cameraStarted]);

  const handlePointerDown = useCallback(() => {
    orchestratorRef.current?.startConversation();
  }, []);

  const handlePointerUp = useCallback(() => {
    orchestratorRef.current?.stop();
  }, []);

  const handleStartCamera = useCallback(() => {
    setCameraStarted(true);
  }, []);

  const voiceButtonState = useMemo(() => {
    if (state === 'listening') return 'listening';
    if (state === 'capturing' || state === 'processing') return 'processing';
    if (state === 'speaking') return 'speaking';
    return 'idle';
  }, [state]);

  return (
    <div className="app">
      <StatusBar statusText={statusText} online={bffOnline} />

      <main className="app-body">
        {permission === 'prompt' && !cameraStarted ? (
          <div className="onboarding-overlay">
            <div className="onboarding-card">
              <div className="onboarding-card__logo" aria-hidden="true" />
              <h2>AI 视觉对话助手</h2>
              <p>对准摄像头展示物体、场景或文字，按住麦克风语音提问，AI 将实时看懂画面并语音回答。</p>
              <ul className="onboarding-card__features">
                <li>🎯 物体识别</li>
                <li>📝 文字识别</li>
                <li>🖼️ 场景理解</li>
              </ul>
              <button
                type="button"
                className="onboarding-card__cta"
                onClick={handleStartCamera}
              >
                授权并开始
              </button>
              <p className="onboarding-card__hint">需要摄像头和麦克风权限</p>
            </div>
          </div>
        ) : (
          <div className="main-stage">
            <section className="camera-panel">
              <CameraPreview
                engine={mediaEngine}
                state={state}
                onReady={handleReady}
                onError={handleError}
                onPermissionChange={handlePermissionChange}
                autoInitialize
              />
            </section>

            <section className="chat-panel-wrapper">
              <ChatPanel messages={messages} />
            </section>
          </div>
        )}
      </main>

      <div className="voice-bar">
        <VoiceButton
          state={voiceButtonState}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          disabled={!cameraStarted || !isReady}
        />
      </div>

      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      <CostPanel visible={panelVisible} metrics={metrics} online={bffOnline} />

      <div className="hint-badge">Ctrl+Shift+D 成本面板 · 空格键对话 · ESC 打断</div>
    </div>
  );
}

export default App;
