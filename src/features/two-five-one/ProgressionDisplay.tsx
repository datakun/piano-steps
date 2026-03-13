import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { Progression } from '../../types/music';
import GrandStaff from '../../components/notation/GrandStaff';
import type { GrandStaffChord } from '../../components/notation/GrandStaff';
import PianoKeyboard from '../../components/piano/PianoKeyboard';
import type { NoteHighlight } from '../../components/piano/PianoKeyboard';
import { compactVoicing, pitch } from '../../lib/music/noteUtils';
import type { Pitch } from '../../types/music';

/** If the highest bass clef note is G4 (MIDI 67) or above, shift all notes down 1 octave */
function adjustBassOctave(notes: Pitch[]): Pitch[] {
  if (notes.length === 0) return notes;
  const highest = Math.max(...notes.map(n => n.midi));
  if (highest >= 67) { // G4
    return notes.map(n => pitch(n.name, n.octave - 1));
  }
  return notes;
}

interface ProgressionDisplayProps {
  progression: Progression;
  label: string;
  activeMeasureInProgression?: number; // 0-3 within the 4-bar block
  isCurrent?: boolean;
  activeChordIndex?: number; // 0=II, 1=V, 2=I — guide mode auto-select
}

export default function ProgressionDisplay({
  progression,
  label,
  activeMeasureInProgression,
  isCurrent = false,
  activeChordIndex,
}: ProgressionDisplayProps) {
  const [selectedChordIdx, setSelectedChordIdx] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container width for responsive notation
  useEffect(() => {
    if (!cardRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(w);
    });
    ro.observe(cardRef.current);
    return () => ro.disconnect();
  }, []);

  // Guide mode: auto-select chord when activeChordIndex changes
  useEffect(() => {
    if (activeChordIndex !== undefined) {
      setSelectedChordIdx(activeChordIndex);
    } else {
      setSelectedChordIdx(null);
    }
  }, [activeChordIndex]);

  // Dynamic stave width: container padding (p-3 = 12px × 2) + SVG internal padding (10px × 2)
  const dynamicStaveWidth = Math.max(200, containerWidth - 24 - 20);

  // 2-measure layout:
  // Measure 1: IIm7 (half note) + V7 (half note)
  // Measure 2: IM7 (whole note)
  const measures = useMemo<GrandStaffChord[][]>(() => {
    const [ii, v, i] = progression.chords;
    return [
      [
        { treble: compactVoicing(ii.rightHand), bass: adjustBassOctave(compactVoicing(ii.leftHand)), duration: 'h' },
        { treble: compactVoicing(v.rightHand), bass: adjustBassOctave(compactVoicing(v.leftHand)), duration: 'h' },
      ],
      [
        { treble: compactVoicing(i.rightHand), bass: adjustBassOctave(compactVoicing(i.leftHand)), duration: 'w' },
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
    const allNotes = [...adjustBassOctave(compactVoicing(voicing.leftHand)), ...compactVoicing(voicing.rightHand)];
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
      octaves: 3,
    };
  }, [selectedChordIdx, progression]);

  return (
    <div ref={cardRef} className={`rounded-xl border p-3 ${
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
      {containerWidth > 0 && (
        <GrandStaff
          measures={measures}
          keySignature={progression.key}
          measureLabels={measureLabels}
          onLabelClick={handleLabelClick}
          staveWidth={dynamicStaveWidth}
          height={200}
          activeChordIndex={activeChordIndex}
          activeMeasureIdx={activeChordIndex === undefined ? staffMeasureIdx : undefined}
        />
      )}

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
            width={containerWidth > 0 ? containerWidth - 24 : undefined}
          />
        </div>
      )}
    </div>
  );
}
