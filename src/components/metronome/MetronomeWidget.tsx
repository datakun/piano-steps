import { useState, useEffect } from 'react';
import { useMetronomeStore } from '../../features/metronome/metronomeStore';
import BeatIndicator from './BeatIndicator';
import type { TimeSignature } from '../../types/metronome';

function getBeatsForSignature(ts: TimeSignature): number {
  const map: Record<TimeSignature, number> = {
    '2/4': 2, '3/4': 3, '4/4': 4, '5/4': 5, '6/8': 6, '7/8': 7,
  };
  return map[ts] ?? 4;
}

const SPIN_BUTTON_HIDE = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

/**
 * Editable number input.
 * - Typing updates slider in real-time (only when value is in range)
 * - Out-of-range intermediate values (e.g. "5" while typing "50") are allowed in the input
 * - On blur, value is clamped to [min, max]
 */
function NumberInput({ value, setValue, min, max, className }: {
  value: number;
  setValue: (v: number) => void;
  min: number;
  max: number;
  className: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;

  // Sync draft when store value changes externally (slider, ±buttons)
  useEffect(() => {
    if (editing) setDraft(String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDraft(raw);
    const n = Number(raw);
    if (raw !== '' && !isNaN(n) && n >= min && n <= max) {
      setValue(n); // in range → update store & slider immediately
    }
  };

  const handleBlur = () => {
    if (draft !== null) {
      const n = Number(draft);
      if (draft !== '' && !isNaN(n)) {
        setValue(Math.max(min, Math.min(max, n))); // clamp on blur
      }
    }
    setDraft(null);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={editing ? draft : value}
      onChange={handleChange}
      onFocus={e => { setDraft(String(value)); e.target.select(); }}
      onBlur={handleBlur}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className={`${className} ${SPIN_BUTTON_HIDE} bg-transparent border-0 outline-none text-center focus:bg-blue-50 focus:rounded-lg transition-colors`}
    />
  );
}

interface MetronomeWidgetProps {
  compact?: boolean;
  /** Hide the standalone play/stop button (use when another playback controls the metronome) */
  hidePlayButton?: boolean;
  /** Remove card styling (border, background) — use when embedding in a larger card */
  unstyled?: boolean;
  /** Hide beat indicator dots — use when rendering them separately */
  hideBeatIndicator?: boolean;
}

export default function MetronomeWidget({ compact = false, hidePlayButton = false, unstyled = false, hideBeatIndicator = false }: MetronomeWidgetProps) {
  const { bpm, volume, timeSignature, isPlaying, currentBeat, accentBeat1, setBpm, setVolume, setTimeSignature, toggleAccent, toggle } =
    useMetronomeStore();

  const totalBeats = getBeatsForSignature(timeSignature);

  if (compact) {
    const wrapperClass = unstyled
      ? 'flex items-center gap-2 flex-1 min-w-0'
      : 'flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2';
    return (
      <div className={wrapperClass}>
        {!hidePlayButton && (
          <button
            onClick={toggle}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${
              isPlaying ? 'bg-red-500' : 'bg-blue-600'
            }`}
          >
            {isPlaying ? '■' : '▶'}
          </button>
        )}
        <NumberInput
          value={bpm}
          setValue={setBpm}
          min={40}
          max={200}
          className="text-xs font-mono font-medium w-7 text-gray-800"
        />
        <input
          type="range"
          min={40}
          max={200}
          value={bpm}
          onChange={e => setBpm(Number(e.target.value))}
          className="flex-1 min-w-0 accent-blue-600"
        />
        {!hideBeatIndicator && (
          <BeatIndicator totalBeats={totalBeats} currentBeat={currentBeat} isPlaying={isPlaying} />
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      {/* BPM display + slider */}
      <div className="text-center">
        <NumberInput
          value={bpm}
          setValue={setBpm}
          min={40}
          max={200}
          className="text-5xl font-bold tabular-nums text-gray-800 w-32"
        />
        <div className="text-sm text-gray-400 mt-1">BPM</div>
      </div>

      <input
        type="range"
        min={40}
        max={200}
        value={bpm}
        onChange={e => setBpm(Number(e.target.value))}
        className="w-full accent-blue-600"
      />

      <div className="flex justify-center gap-2">
        <button onClick={() => setBpm(bpm - 1)} className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200">-1</button>
        <button onClick={() => setBpm(bpm - 5)} className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200">-5</button>
        <button onClick={() => setBpm(bpm + 5)} className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200">+5</button>
        <button onClick={() => setBpm(bpm + 1)} className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200">+1</button>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2 px-2">
        <span className="text-gray-400 text-sm" title="Volume">
          {volume === 0 ? '🔇' : volume < 50 ? '🔈' : '🔊'}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={e => setVolume(Number(e.target.value))}
          className="flex-1 accent-blue-600"
        />
        <NumberInput
          value={volume}
          setValue={setVolume}
          min={0}
          max={100}
          className="text-xs text-gray-400 w-8 tabular-nums"
        />
      </div>

      {/* Beat indicator */}
      <BeatIndicator totalBeats={totalBeats} currentBeat={currentBeat} isPlaying={isPlaying} />

      {/* Settings row */}
      <div className="flex justify-center gap-3 flex-wrap">
        <select
          value={timeSignature}
          onChange={e => setTimeSignature(e.target.value as TimeSignature)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="2/4">2/4</option>
          <option value="3/4">3/4</option>
          <option value="4/4">4/4</option>
          <option value="5/4">5/4</option>
          <option value="6/8">6/8</option>
          <option value="7/8">7/8</option>
        </select>

        <button
          onClick={toggleAccent}
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            accentBeat1
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-gray-200 text-gray-500'
          }`}
        >
          Accent
        </button>
      </div>

      {/* Play/Stop button */}
      <div className="flex justify-center">
        <button
          onClick={toggle}
          className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl shadow-lg transition-colors ${
            isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isPlaying ? '■' : '▶'}
        </button>
      </div>
    </div>
  );
}
