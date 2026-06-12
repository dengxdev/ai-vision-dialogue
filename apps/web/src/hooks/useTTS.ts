import { useCallback, useEffect, useRef, useState } from 'react';
import { TTSEngine } from '@ai-vision/audio-utils';

export interface UseTTSResult {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
}

export function useTTS(): UseTTSResult {
  const engineRef = useRef<TTSEngine | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const engine = new TTSEngine({ autoResumeOnUserInteraction: true });
    engineRef.current = engine;

    const handleStateChange = (event: Event) => {
      const detail = (event as CustomEvent<{ isSpeaking: boolean }>).detail;
      setIsSpeaking(detail.isSpeaking);
    };

    engine.addEventListener('statechange', handleStateChange);

    return () => {
      engine.removeEventListener('statechange', handleStateChange);
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  const speak = useCallback(async (text: string): Promise<void> => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }
    try {
      await engine.speak(text);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('TTS error:', err);
    }
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  return { speak, stop, isSpeaking };
}
