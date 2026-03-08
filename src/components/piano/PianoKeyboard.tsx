import { useMemo } from 'react';
import type { NoteName } from '../../types/music';
import { noteToSemitone } from '../../lib/music/noteUtils';

export interface NoteHighlight {
  note: NoteName;
  octave: number;
  color?: string;
  label?: string;
}

interface PianoKeyboardProps {
  startOctave?: number;
  octaves?: number;
  highlightedNotes?: NoteHighlight[];
  width?: number;
}

interface KeyInfo {
  note: NoteName;
  octave: number;
  isBlack: boolean;
  x: number;
}

const WHITE_NOTES: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_NOTE_MAP: Record<string, NoteName> = {
  C: 'C#', D: 'Eb', F: 'F#', G: 'Ab', A: 'Bb',
};

// Relative x offsets of black keys within a white key width
const BLACK_KEY_OFFSETS: Record<string, number> = {
  C: 0.6, D: 1.8, F: 3.6, G: 4.7, A: 5.8,
};

const WHITE_KEY_WIDTH = 28;
const WHITE_KEY_HEIGHT = 100;
const BLACK_KEY_WIDTH = 18;
const BLACK_KEY_HEIGHT = 62;

export default function PianoKeyboard({
  startOctave = 3,
  octaves = 2,
  highlightedNotes = [],
  width,
}: PianoKeyboardProps) {
  const keys = useMemo(() => {
    const whiteKeys: KeyInfo[] = [];
    const blackKeys: KeyInfo[] = [];
    let whiteIdx = 0;

    for (let oct = startOctave; oct < startOctave + octaves; oct++) {
      for (const note of WHITE_NOTES) {
        whiteKeys.push({
          note,
          octave: oct,
          isBlack: false,
          x: whiteIdx * WHITE_KEY_WIDTH,
        });

        if (note in BLACK_KEY_OFFSETS) {
          const blackNote = BLACK_NOTE_MAP[note];
          blackKeys.push({
            note: blackNote,
            octave: oct,
            isBlack: true,
            x: whiteIdx * WHITE_KEY_WIDTH + WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2,
          });
        }
        whiteIdx++;
      }
    }
    // Add final C
    whiteKeys.push({
      note: 'C',
      octave: startOctave + octaves,
      isBlack: false,
      x: whiteIdx * WHITE_KEY_WIDTH,
    });
    whiteIdx++;

    return { whiteKeys, blackKeys, totalWidth: whiteIdx * WHITE_KEY_WIDTH };
  }, [startOctave, octaves]);

  const highlightMap = useMemo(() => {
    const map = new Map<string, NoteHighlight>();
    for (const h of highlightedNotes) {
      const key = `${noteToSemitone(h.note)}-${h.octave}`;
      map.set(key, h);
    }
    return map;
  }, [highlightedNotes]);

  function getHighlight(note: NoteName, octave: number): NoteHighlight | undefined {
    const key = `${noteToSemitone(note)}-${octave}`;
    return highlightMap.get(key);
  }

  const svgWidth = width ?? keys.totalWidth;
  const scale = svgWidth / keys.totalWidth;

  return (
    <svg
      viewBox={`0 0 ${keys.totalWidth} ${WHITE_KEY_HEIGHT + 2}`}
      width={svgWidth}
      height={(WHITE_KEY_HEIGHT + 2) * scale}
      className="select-none"
    >
      {/* White keys */}
      {keys.whiteKeys.map((k, i) => {
        const hl = getHighlight(k.note, k.octave);
        return (
          <g key={`w-${i}`}>
            <rect
              x={k.x + 0.5}
              y={0.5}
              width={WHITE_KEY_WIDTH - 1}
              height={WHITE_KEY_HEIGHT}
              rx={2}
              fill={hl ? (hl.color ?? '#93c5fd') : 'white'}
              stroke="#94a3b8"
              strokeWidth={0.8}
            />
            {hl?.label && (
              <text
                x={k.x + WHITE_KEY_WIDTH / 2}
                y={WHITE_KEY_HEIGHT - 8}
                textAnchor="middle"
                fontSize={9}
                fontWeight="bold"
                fill={hl ? '#1e3a5f' : '#64748b'}
              >
                {hl.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Black keys */}
      {keys.blackKeys.map((k, i) => {
        const hl = getHighlight(k.note, k.octave);
        return (
          <g key={`b-${i}`}>
            <rect
              x={k.x}
              y={0}
              width={BLACK_KEY_WIDTH}
              height={BLACK_KEY_HEIGHT}
              rx={2}
              fill={hl ? (hl.color ?? '#60a5fa') : '#1e293b'}
              stroke="#0f172a"
              strokeWidth={0.5}
            />
            {hl?.label && (
              <text
                x={k.x + BLACK_KEY_WIDTH / 2}
                y={BLACK_KEY_HEIGHT - 6}
                textAnchor="middle"
                fontSize={8}
                fontWeight="bold"
                fill="white"
              >
                {hl.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
