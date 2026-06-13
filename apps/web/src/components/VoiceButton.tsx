interface VoiceButtonProps {
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  isListening?: boolean;
  transcript?: string;
  disabled?: boolean;
}

export function VoiceButton({
  onPointerDown,
  onPointerUp,
  isListening = false,
  transcript = '',
  disabled = false,
}: VoiceButtonProps) {
  return (
    <div className="voice-button-container">
      <button
        type="button"
        className={`voice-button ${isListening ? 'listening' : ''}`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        disabled={disabled}
        aria-label="按住说话"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </button>
      <div className="transcript-display">
        {transcript ? (
          <span className="transcript-final">{transcript}</span>
        ) : (
          <span className="transcript-placeholder">
            {isListening ? '聆听中…' : '按住麦克风说话'}
          </span>
        )}
      </div>
    </div>
  );
}
