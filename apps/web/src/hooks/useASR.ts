import { useCallback, useEffect, useRef, useState } from 'react';
import { ASREngine, ASRResult } from '@ai-vision/audio-utils';

export interface UseASRResult {
  start: () => void;
  stop: () => void;
  transcript: string;
  isListening: boolean;
  isFinal: boolean;
}

export function useASR(): UseASRResult {
  const engineRef = useRef<ASREngine | null>(null);
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isFinal, setIsFinal] = useState(false);

  useEffect(() => {
    const engine = new ASREngine();
    engineRef.current = engine;

    const handleResult = (event: Event) => {
      const result = (event as CustomEvent<ASRResult>).detail;
      setTranscript(result.transcript);
      setIsFinal(result.isFinal);
    };

    const handleEnd = () => {
      setIsListening(false);
    };

    const handleError = (event: Event) => {
      const error = (event as CustomEvent<Error>).detail;
      // eslint-disable-next-line no-console
      console.error('ASR error:', error);
      setIsListening(false);
    };

    engine.addEventListener('result', handleResult);
    engine.addEventListener('end', handleEnd);
    engine.addEventListener('error', handleError);

    return () => {
      engine.removeEventListener('result', handleResult);
      engine.removeEventListener('end', handleEnd);
      engine.removeEventListener('error', handleError);
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    setTranscript('');
    setIsFinal(false);
    setIsListening(true);
    engineRef.current?.start();
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  return { start, stop, transcript, isListening, isFinal };
}
