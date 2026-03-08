import type { PlaybackStatus } from '../../types/playback';

interface PlaybackControlsProps {
  status: PlaybackStatus;
  currentMeasure: number;
  totalMeasures: number;
  isRepeating: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRepeatToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function PlaybackControls({
  status,
  currentMeasure,
  totalMeasures,
  isRepeating,
  onPlay,
  onPause,
  onStop,
  onRepeatToggle,
  onPrev,
  onNext,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
      {/* Previous */}
      <button
        onClick={onPrev}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 active:bg-gray-200"
        title="Previous measure"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
        </svg>
      </button>

      {/* Stop */}
      <button
        onClick={onStop}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 active:bg-gray-200"
        title="Stop"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h12v12H6z" />
        </svg>
      </button>

      {/* Play/Pause */}
      <button
        onClick={status === 'playing' ? onPause : onPlay}
        className="p-2.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
        title={status === 'playing' ? 'Pause' : 'Play'}
      >
        {status === 'playing' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Next */}
      <button
        onClick={onNext}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 active:bg-gray-200"
        title="Next measure"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>

      {/* Repeat */}
      <button
        onClick={onRepeatToggle}
        className={`p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 ${
          isRepeating ? 'text-blue-600' : 'text-gray-400'
        }`}
        title="Repeat"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
        </svg>
      </button>

      {/* Measure indicator */}
      <span className="text-xs text-gray-400 ml-2 tabular-nums">
        {currentMeasure + 1} / {totalMeasures}
      </span>
    </div>
  );
}
