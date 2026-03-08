import { useMemo, useState, useCallback } from 'react';
import type { Progression } from '../../types/music';
import GrandStaff from '../../components/notation/GrandStaff';
import type { GrandStaffChord } from '../../components/notation/GrandStaff';
import PianoKeyboard from '../../components/piano/PianoKeyboard';
import type { NoteHighlight } from '../../components/piano/PianoKeyboard';

interface ProgressionDisplayProps {
  progression: Progression;
  label: string;
  activeMeasureInProgression?: number; // 0-3 within the 4-bar block
  isCurrent?: boolean;
}

export default function ProgressionDisplay({
  progression,
  label,
  activeMeasureInProgression,
  isCurrent = false,
}: ProgressionDisplayProps) {
  const [selectedChordIdx, setSelectedChordIdx] = useState<number | null>(null);

  // 2-measure layout:
  // Measure 1: IIm7 (half note) + V7 (half note)
  // Measure 2: IM7 (whole note)
  const measures = useMemo<GrandStaffChord[][]>(() => {
    const [ii, v, i] = progression.chords;
    return [
      [
        { treble: ii.rightHand, bass: ii.leftHand, duration: 'h' },
        { treble: v.rightHand, bass: v.leftHand, duration: 'h' },
      ],
      [
        { treble: i.rightHand, bass: i.leftHand, duration: 'w' },
      ],
    ];
  }, [progression]);

  // Chord labels per measure: [['Dm7','G7'], ['CM7']]
  const measureLabels = useMemo(() => {
    const [ii, v, i] = progression.chords;
    return [
      [ii.chord.symbol, v.chord.symbol],
      [i.chord.symbol],
    ];
  }, [progression]);

  // Map store measure (0-3) to staff measure (0 or 1)
  // 0,2 → measure 0 (II-V bar); 1,3 → measure 1 (I bar)
  const staffMeasureIdx = activeMeasureInProgression !== undefined
    ? activeMeasureInProgression % 2
    : undefined;

  // Convert (measureIdx, chordIdx) to global chord index (0=II, 1=V, 2=I)
  const handleLabelClick = useCallback((measureIdx: number, chordIdx: number) => {
    const globalIdx = measureIdx === 0 ? chordIdx : 2; // measure 0: [0,1], measure 1: [2]
    setSelectedChordIdx(prev => prev === globalIdx ? null : globalIdx);
  }, []);

  // Keyboard highlights for selected chord
  const keyboardData = useMemo(() => {
    if (selectedChordIdx === null) return null;
    const voicing = progression.chords[selectedChordIdx];
    const allNotes = [...voicing.leftHand, ...voicing.rightHand];
    const highlights: NoteHighlight[] = allNotes.map(p => ({
      note: p.name,
      octave: p.octave,
      color: '#3b82f6',
    }));
    const minOct = Math.min(...allNotes.map(p => p.octave));
    const maxOct = Math.max(...allNotes.map(p => p.octave));
    return {
      symbol: voicing.chord.symbol,
      highlights,
      startOctave: minOct,
      octaves: Math.max(2, maxOct - minOct + 1),
    };
  }, [selectedChordIdx, progression]);

  return (
    <div className={`rounded-xl border p-3 ${
      isCurrent ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
          isCurrent ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-500'
        }`}>
          {label}
        </span>
        <span className="text-sm font-medium text-gray-700">
          Key of {progression.key} ({progression.form === 'A' ? 'Open' : 'Close'})
        </span>
      </div>

      {/* Grand staff notation - 2 measures with key signature + chord labels */}
      <GrandStaff
        measures={measures}
        keySignature={progression.key}
        measureLabels={measureLabels}
        onLabelClick={handleLabelClick}
        staveWidth={380}
        height={200}
        activeMeasureIdx={staffMeasureIdx}
      />

      {/* Piano keyboard for selected chord */}
      {keyboardData && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono font-bold text-blue-600">
              {keyboardData.symbol}
            </span>
            <button
              onClick={() => setSelectedChordIdx(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <PianoKeyboard
            startOctave={keyboardData.startOctave}
            octaves={keyboardData.octaves}
            highlightedNotes={keyboardData.highlights}
          />
        </div>
      )}
    </div>
  );
}
