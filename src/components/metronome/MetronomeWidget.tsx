import { useState, useCallback } from 'react';
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

/** Editable BPM input that looks like plain text until focused */
function BpmInput({ bpm, setBpm, className }: {
  bpm: number;
  setBpm: (v: number) => void;
  className: string;
}) {
  const [draft, setDraft] = useState(String(bpm));
  const [editing, setEditing] = useState(false);

  const commit = useCallback(() => {
    setEditing(false);
    const n = Number(draft);
    if (!draft || isNaN(n)) {
      setDraft(String(bpm));
      return;
    }
    setBpm(n); // store handles clamping 40-200
    setDraft(String(Math.max(40, Math.min(200, n))));
  }, [draft, bpm, setBpm]);

  // Sync external bpm changes (slider, ±buttons) when not editing
  if (!editing && String(bpm) !== draft) {
    setDraft(String(bpm));
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={40}
      max={200}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onFocus={e => { setEditing(true); e.target.select(); }}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className={`${className} ${SPIN_BUTTON_HIDE} bg-transparent border-0 outline-none text-center focus:bg-blue-50 focus:rounded-lg transition-colors`}
    />
  );
}

interface MetronomeWidgetProps {
  compact?: boolean;
}

export default function MetronomeWidget({ compact = false }: MetronomeWidgetProps) {
  const { bpm, timeSignature, isPlaying, currentBeat, accentBeat1, setBpm, setTimeSignature, toggleAccent, toggle } =
    useMetronomeStore();

  const totalBeats = getBeatsForSignature(timeSignature);

  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
        <button
          onClick={toggle}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${
            isPlaying ? 'bg-red-500' : 'bg-blue-600'
          }`}
        >
          {isPlaying ? '■' : '▶'}
        </button>
        <BpmInput
          bpm={bpm}
          setBpm={setBpm}
          className="text-sm font-mono font-medium w-12 text-gray-800"
        />
        <input
          type="range"
          min={40}
          max={200}
          value={bpm}
          onChange={e => setBpm(Number(e.target.value))}
          className="w-24 accent-blue-600"
        />
        <BeatIndicator totalBeats={totalBeats} currentBeat={currentBeat} isPlaying={isPlaying} />
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      {/* BPM display + slider */}
      <div className="text-center">
        <BpmInput
          bpm={bpm}
          setBpm={setBpm}
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
