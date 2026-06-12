/// <reference types="dom-speech-recognition" />

export interface ASRResult {
  transcript: string;
  isFinal: boolean;
}

export class ASREngine extends EventTarget {
  private recognition: SpeechRecognition | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private _isListening = false;

  get isListening(): boolean {
    return this._isListening;
  }

  async initialize(): Promise<void> {
    const api = this.getSpeechRecognitionAPI();
    if (!api) {
      throw new Error('当前浏览器不支持 Web Speech API，请使用 Chrome / Edge / Safari');
    }
  }

  start(): void {
    if (this._isListening) {
      return;
    }

    const SpeechRecognitionAPI = this.getSpeechRecognitionAPI();
    if (!SpeechRecognitionAPI) {
      this.dispatchEvent(
        new CustomEvent('error', {
          detail: new Error('当前浏览器不支持 Web Speech API'),
        }),
      );
      return;
    }

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.lang = 'zh-CN';
    this.recognition.interimResults = true;
    this.recognition.continuous = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this._isListening = true;
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.dispatchEvent(
          new CustomEvent<ASRResult>('result', {
            detail: { transcript: finalTranscript, isFinal: true },
          }),
        );
      }

      if (interimTranscript) {
        this.dispatchEvent(
          new CustomEvent<ASRResult>('result', {
            detail: { transcript: interimTranscript, isFinal: false },
          }),
        );
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const message = `语音识别错误: ${event.error}`;
      this.dispatchEvent(new CustomEvent('error', { detail: new Error(message) }));
    };

    this.recognition.onend = () => {
      this._isListening = false;
      this.clearTimeout();
      this.dispatchEvent(new Event('end'));
    };

    this.timeoutId = setTimeout(() => {
      this.stop();
    }, 30000);

    try {
      this.recognition.start();
    } catch (err) {
      this._isListening = false;
      this.clearTimeout();
      this.dispatchEvent(
        new CustomEvent('error', { detail: err instanceof Error ? err : new Error(String(err)) }),
      );
    }
  }

  stop(): void {
    if (!this.recognition || !this._isListening) {
      return;
    }
    this.clearTimeout();
    try {
      this.recognition.stop();
    } catch (err) {
      this.dispatchEvent(
        new CustomEvent('error', { detail: err instanceof Error ? err : new Error(String(err)) }),
      );
    }
  }

  private getSpeechRecognitionAPI(): typeof SpeechRecognition | undefined {
    return (
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    );
  }

  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
