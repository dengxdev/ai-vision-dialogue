import './VoiceButton.css';

export type VoiceButtonState = 'idle' | 'listening' | 'processing' | 'speaking';

interface VoiceButtonProps {
  state?: VoiceButtonState;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  disabled?: boolean;
}

const STATE_LABEL: Record<VoiceButtonState, string> = {
  idle: '按住说话',
  listening: '聆听中…',
  processing: '思考中…',
  speaking: '播报中…',
};

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="voice-button__spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );
}

function SoundWaveIcon() {
  return (
    <span className="voice-button__wave" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function renderIcon(state: VoiceButtonState) {
  switch (state) {
    case 'listening':
      return <MicIcon />;
    case 'processing':
      return <SpinnerIcon />;
    case 'speaking':
      return <SoundWaveIcon />;
    case 'idle':
    default:
      return <MicIcon />;
  }
}

export function VoiceButton({
  state = 'idle',
  onPointerDown,
  onPointerUp,
  disabled = false,
}: VoiceButtonProps) {
  return (
    <div className="voice-button-container">
      <button
        type="button"
        className={`voice-button voice-button--${state}`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        disabled={disabled}
        aria-label={STATE_LABEL[state]}
      >
        {renderIcon(state)}
      </button>
      <span className="voice-button__label">{STATE_LABEL[state]}</span>
    </div>
  );
}
