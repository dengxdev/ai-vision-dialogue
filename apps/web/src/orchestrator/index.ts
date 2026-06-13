import type { ASREngine, TTSEngine } from '@ai-vision/audio-utils';
import type { DialogueResult } from '@ai-vision/shared';
import type { MediaCaptureEngine } from '../hooks/useMediaCapture';
import type { WSClient } from '../services/ws-client';
import type { CostTracker } from '../services/cost-tracker';

export type DialogueState = 'idle' | 'listening' | 'capturing' | 'processing' | 'speaking';

export interface OrchestratorEventMap {
  statechange: CustomEvent<{ state: DialogueState }>;
  transcript: CustomEvent<{ text: string }>;
  reply: CustomEvent<{ reply: string }>;
  error: CustomEvent<{ message: string }>;
}

export interface OrchestratorOptions {
  media: MediaCaptureEngine;
  asr: ASREngine;
  tts: TTSEngine;
  ws: WSClient;
  costTracker: CostTracker;
}

const DIALOGUE_TIMEOUT_MS = 15_000;

export class Orchestrator extends EventTarget {
  private state: DialogueState = 'idle';
  private readonly media: MediaCaptureEngine;
  private readonly asr: ASREngine;
  private readonly tts: TTSEngine;
  private readonly ws: WSClient;
  private readonly costTracker: CostTracker;

  private abortController: AbortController | null = null;
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly handleASRResult: (event: Event) => void;
  private readonly handleASREnd: () => void;
  private readonly handleWSDisconnected: (reason: string) => void;

  constructor(options: OrchestratorOptions) {
    super();
    this.media = options.media;
    this.asr = options.asr;
    this.tts = options.tts;
    this.ws = options.ws;
    this.costTracker = options.costTracker;

    this.handleASRResult = (event: Event) => {
      const result = (event as CustomEvent<{ transcript: string; isFinal: boolean }>).detail;
      if (result.isFinal && result.transcript.trim()) {
        void this.handleUserSpeech(result.transcript.trim());
      }
    };
    this.asr.addEventListener('result', this.handleASRResult);

    this.handleASREnd = () => {
      if (this.state === 'listening') {
        this.resetToIdle();
      }
    };
    this.asr.addEventListener('end', this.handleASREnd);

    this.handleWSDisconnected = (_reason) => {
      if (this.state === 'idle') {
        return;
      }
      this.notifyError('与服务器连接断开');
      this.stop(true);
    };
    this.ws.on('disconnected', this.handleWSDisconnected);
  }

  get currentState(): DialogueState {
    return this.state;
  }

  startConversation(): void {
    if (this.state !== 'idle') {
      return;
    }

    this.ws.connect();
    this.transitionTo('listening');

    try {
      this.asr.start();
    } catch (err) {
      this.notifyError(err instanceof Error ? err.message : '启动语音识别失败');
      this.resetToIdle();
    }
  }

  async handleUserSpeech(text: string): Promise<void> {
    if (this.state !== 'listening') {
      return;
    }

    this.dispatchEvent(new CustomEvent<{ text: string }>('transcript', { detail: { text } }));
    this.transitionTo('capturing');

    const abortController = new AbortController();
    this.abortController = abortController;

    try {
      const [frameResult] = await Promise.all([
        Promise.resolve().then(() => this.media.captureFrame()),
        Promise.resolve().then(() => this.asr.stop()),
      ]);

      if (abortController.signal.aborted) {
        return;
      }

      this.transitionTo('processing');

      // eslint-disable-next-line no-console
      console.log('[Orchestrator] sendDialogue', { message: text, hasFrame: !!frameResult?.base64 });

      // 先注册结果监听器，再发送消息，避免低延迟环境下结果事件早于监听器注册而丢失
      const replyPromise = this.waitForDialogueResult(abortController);

      this.ws.sendDialogue({
        message: text,
        frame: frameResult?.base64,
      });

      const reply = await replyPromise;

      if (abortController.signal.aborted) {
        return;
      }

      if (!reply || !reply.trim()) {
        throw new Error('服务器返回了空回复');
      }

      this.transitionTo('speaking');
      this.dispatchEvent(new CustomEvent<{ reply: string }>('reply', { detail: { reply } }));

      try {
        await this.tts.speak(reply);
      } catch (err) {
        this.notifyError('语音播报失败，已转为文字显示');
      }

      this.transitionTo('idle');
    } catch (err) {
      if (abortController.signal.aborted) {
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      if (message === '已中断') {
        // 用户主动中断，不弹提示
      } else if (message.startsWith('与服务器连接断开')) {
        // 全局断开监听器已提示
      } else {
        this.notifyError(message);
        if (message === '网络不太稳定') {
          this.dispatchReply('网络不太稳定，请稍后再试。');
        }
      }

      this.resetToIdle();
    } finally {
      this.clearAbortController(abortController);
      this.clearPendingTimeout();
    }
  }

  stop(force = false): void {
    if (this.state === 'idle') {
      return;
    }

    if (!force && this.state === 'listening') {
      // 松手：停止 ASR，让 final result 或 end 事件自然收尾
      this.asr.stop();
      return;
    }

    if (!force) {
      // 非 listening 状态（capturing/processing/speaking）时，普通松手不中断，
      // 避免用户在 AI 处理过程中松开按钮导致对话被静默取消
      return;
    }

    this.abortTurn();
    this.tts.stop();
    this.asr.stop();
    this.resetToIdle();
  }

  destroy(): void {
    this.stop();
    this.asr.removeEventListener('result', this.handleASRResult);
    this.asr.removeEventListener('end', this.handleASREnd);
    this.ws.off('disconnected', this.handleWSDisconnected);
  }

  private waitForDialogueResult(abortController: AbortController): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('网络不太稳定'));
      }, DIALOGUE_TIMEOUT_MS);
      this.pendingTimeout = timeout;

      const handleResult = (result: DialogueResult) => {
        // eslint-disable-next-line no-console
        console.log('[Orchestrator] received dialogue:result', result.reply?.slice(0, 30));
        cleanup();
        if (!result || typeof result.reply !== 'string') {
          reject(new Error('服务器返回了异常数据'));
          return;
        }
        this.costTracker.recordCall(result.usage ?? 0);
        resolve(result.reply);
      };

      const handleError = (error: { error: string }) => {
        // eslint-disable-next-line no-console
        console.error('[Orchestrator] received dialogue:error', error);
        cleanup();
        reject(new Error(error.error));
      };

      const handleAbort = () => {
        cleanup();
        reject(new Error('已中断'));
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.pendingTimeout = null;
        this.ws.off('dialogue:result', handleResult);
        this.ws.off('dialogue:error', handleError);
        abortController.signal.removeEventListener('abort', handleAbort);
      };

      this.ws.on('dialogue:result', handleResult);
      this.ws.on('dialogue:error', handleError);
      abortController.signal.addEventListener('abort', handleAbort);
    });
  }

  private abortTurn(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  private clearAbortController(controller: AbortController): void {
    if (this.abortController === controller) {
      this.abortController = null;
    }
  }

  private clearPendingTimeout(): void {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
  }

  private transitionTo(next: DialogueState): void {
    const prev = this.state;
    this.state = next;
    // eslint-disable-next-line no-console
    console.log(`[Orchestrator] ${prev} -> ${next}`);
    this.dispatchEvent(new CustomEvent<{ state: DialogueState }>('statechange', { detail: { state: next } }));
  }

  private dispatchReply(reply: string): void {
    this.dispatchEvent(new CustomEvent<{ reply: string }>('reply', { detail: { reply } }));
  }

  private resetToIdle(): void {
    this.transitionTo('idle');
  }

  private notifyError(message: string): void {
    this.dispatchEvent(new CustomEvent<{ message: string }>('error', { detail: { message } }));
  }
}
