import { useEffect, useState } from 'react';
import { useASR } from '../hooks/useASR';

interface VoiceButtonProps {
  onTranscript?: (text: string) => void;
}

export function VoiceButton({ onTranscript }: VoiceButtonProps) {
  const { start, stop, transcript, isListening, isFinal } = useASR();
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');

  useEffect(() => {
    if (isFinal) {
      setFinalText((prev) => prev + transcript);
      setInterimText('');
      onTranscript?.(transcript);
    } else {
      setInterimText(transcript);
    }
  }, [transcript, isFinal, onTranscript]);

  const handlePointerDown = () => {
    setFinalText('');
    setInterimText('');
    start();
  };

  const handlePointerUp = () => {
    stop();
  };

  const handlePointerLeave = () => {
    stop();
  };

  return (
    <div className="voice-button-container">
      <button
        type="button"
        className={`voice-button ${isListening ? 'listening' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        aria-label="按住说话"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </button>
      <div className="transcript-display">
        {finalText && <span className="transcript-final">{finalText}</span>}
        {interimText && <span className="transcript-interim">{interimText}</span>}
        {!finalText && !interimText && (
          <span className="transcript-placeholder">按住麦克风说话</span>
        )}
      </div>
    </div>
  );
}
