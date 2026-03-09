import type { PlayStatus } from './usePianoRollPlayback';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PianoRollTransportProps {
  status: PlayStatus;
  currentTime: number;
  totalDuration: number;
  audioEnabled: boolean;
  midiEnabled: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onToggleAudio: () => void;
  onToggleMidi: () => void;
}

export default function PianoRollTransport({
  status,
  currentTime,
  totalDuration,
  audioEnabled,
  midiEnabled,
  onPlay,
  onPause,
  onStop,
  onToggleAudio,
  onToggleMidi,
}: PianoRollTransportProps) {
  const isPlaying = status === 'playing';

  return (
    <div className="flex items-center gap-2 py-2">
      {/* Play / Pause */}
      <button
        onClick={isPlaying ? onPause : onPlay}
        className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-sm transition-colors"
      >
        {isPlaying ? (
          /* Pause icon */
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          /* Play icon */
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6,4 20,12 6,20" />
          </svg>
        )}
      </button>

      {/* Stop */}
      <button
        onClick={onStop}
        disabled={status === 'stopped'}
        className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 flex items-center justify-center transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
      </button>

      {/* Time display */}
      <span className="text-xs font-mono text-gray-500 tabular-nums min-w-[5rem] text-center">
        {fmtTime(currentTime)} / {fmtTime(totalDuration)}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Audio toggle */}
      <button
        onClick={onToggleAudio}
        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
          audioEnabled
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-gray-50 text-gray-400 border border-gray-200'
        }`}
        title={audioEnabled ? 'Mute recorded audio' : 'Unmute recorded audio'}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          {audioEnabled ? (
            <>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </>
          ) : (
            <line x1="23" y1="9" x2="17" y2="15" />
          )}
        </svg>
        Mic
      </button>

      {/* MIDI toggle */}
      <button
        onClick={onToggleMidi}
        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
          midiEnabled
            ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : 'bg-gray-50 text-gray-400 border border-gray-200'
        }`}
        title={midiEnabled ? 'Mute MIDI synth' : 'Unmute MIDI synth'}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        MIDI
      </button>
    </div>
  );
}
