export interface TTSConfig {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice;
}

export interface TTSInitOptions extends TTSConfig {
  /**
   * 是否在首次 speak 前尝试自动 resume 被暂停的 speechSynthesis。
   * 某些浏览器会把 speechSynthesis 置为 paused 状态，需要用户交互后才能恢复。
   */
  autoResumeOnUserInteraction?: boolean;
}

export class TTSEngine extends EventTarget {
  private synth: SpeechSynthesis | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private pendingPromise: {
    resolve: () => void;
    reject: (reason: Error) => void;
  } | null = null;
  private _isSpeaking = false;
  private config: Required<Pick<TTSInitOptions, 'lang' | 'rate' | 'pitch' | 'volume'>> &
    Pick<TTSInitOptions, 'voice' | 'autoResumeOnUserInteraction'>;

  get isSpeaking(): boolean {
    return this._isSpeaking;
  }

  constructor(options: TTSInitOptions = {}) {
    super();
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.config = {
      lang: options.lang ?? 'zh-CN',
      rate: options.rate ?? 1.0,
      pitch: options.pitch ?? 1.0,
      volume: options.volume ?? 1.0,
      voice: options.voice,
      autoResumeOnUserInteraction: options.autoResumeOnUserInteraction ?? true,
    };
  }

  async initialize(): Promise<void> {
    if (!this.synth) {
      throw new Error('当前浏览器不支持语音合成（Web Speech API）');
    }
    await this.loadVoices();
  }

  async speak(text: string): Promise<void> {
    if (!this.synth) {
      throw new Error('当前浏览器不支持语音合成（Web Speech API）');
    }

    if (!text.trim()) {
      return;
    }

    // 浏览器通常会限制首次播放必须由用户交互触发；如果当前处于 paused 状态则尝试恢复。
    if (this.config.autoResumeOnUserInteraction && this.synth.paused) {
      this.synth.resume();
    }

    // 取消当前正在播放的内容，避免重叠。
    this.stop();

    await this.loadVoices();

    return new Promise<void>((resolve, reject) => {
      this.pendingPromise = { resolve, reject };

      const utterance = new SpeechSynthesisUtterance(text);
      this.utterance = utterance;

      utterance.lang = this.config.lang;
      utterance.rate = this.config.rate;
      utterance.pitch = this.config.pitch;
      utterance.volume = this.config.volume;

      if (this.config.voice) {
        utterance.voice = this.config.voice;
      } else {
        const voice = this.findBestVoice(this.config.lang);
        if (voice) {
          utterance.voice = voice;
        }
      }

      utterance.onstart = () => {
        this._isSpeaking = true;
        this.dispatchStateChange();
      };

      utterance.onend = () => {
        this.finish();
        resolve();
      };

      utterance.onerror = (event) => {
        const error = new Error(`语音合成错误: ${event.error}`);
        this.finish(error);
        reject(error);
      };

      utterance.onpause = () => {
        this._isSpeaking = false;
        this.dispatchStateChange();
      };

      utterance.onresume = () => {
        this._isSpeaking = true;
        this.dispatchStateChange();
      };

      this.synth!.speak(utterance);
    });
  }

  stop(): void {
    if (!this.synth || !this._isSpeaking) {
      return;
    }
    try {
      this.synth.cancel();
    } catch (err) {
      // ignore
    }
    this.finish();
  }

  private finish(error?: Error): void {
    this._isSpeaking = false;
    this.utterance = null;
    this.dispatchStateChange();

    if (this.pendingPromise) {
      const { resolve, reject } = this.pendingPromise;
      this.pendingPromise = null;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    }
  }

  private dispatchStateChange(): void {
    this.dispatchEvent(new CustomEvent('statechange', { detail: { isSpeaking: this._isSpeaking } }));
  }

  private async loadVoices(): Promise<SpeechSynthesisVoice[]> {
    if (!this.synth) {
      return [];
    }

    let voices = this.synth.getVoices();
    if (voices.length > 0) {
      return voices;
    }

    return new Promise<SpeechSynthesisVoice[]>((resolve) => {
      const handler = () => {
        this.synth?.removeEventListener('voiceschanged', handler);
        resolve(this.synth?.getVoices() ?? []);
      };
      this.synth?.addEventListener('voiceschanged', handler);
      // 部分浏览器不会触发 voiceschanged，兜底 1 秒后返回
      setTimeout(() => {
        this.synth?.removeEventListener('voiceschanged', handler);
        resolve(this.synth?.getVoices() ?? []);
      }, 1000);
    });
  }

  private findBestVoice(lang: string): SpeechSynthesisVoice | undefined {
    if (!this.synth) {
      return undefined;
    }
    const voices = this.synth.getVoices();
    return (
      voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase().split('-')[0])) ??
      voices[0]
    );
  }
}
