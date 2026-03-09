import { useMemo } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KEYBOARD_WIDTH = 48;

const BLACK_KEY_PCS = new Set([1, 3, 6, 8, 10]); // C#, D#, F#, G#, A#

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToLabel(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function isBlackKey(midi: number): boolean {
  return BLACK_KEY_PCS.has(midi % 12);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface VerticalPianoKeyboardProps {
  minMidi: number;
  maxMidi: number;
  rowHeight: number;
  activeNotes?: number[];
}

export default function VerticalPianoKeyboard({
  minMidi,
  maxMidi,
  rowHeight,
  activeNotes = [],
}: VerticalPianoKeyboardProps) {
  const activeSet = useMemo(() => new Set(activeNotes), [activeNotes]);

  const totalRows = maxMidi - minMidi + 1;
  const svgHeight = totalRows * rowHeight;

  const rows = useMemo(() => {
    const result: { midi: number; y: number; black: boolean; label: string }[] = [];
    for (let midi = maxMidi; midi >= minMidi; midi--) {
      const rowIndex = maxMidi - midi; // 0 = top
      result.push({
        midi,
        y: rowIndex * rowHeight,
        black: isBlackKey(midi),
        label: midiToLabel(midi),
      });
    }
    return result;
  }, [minMidi, maxMidi, rowHeight]);

  return (
    <svg
      width={KEYBOARD_WIDTH}
      height={svgHeight}
      className="shrink-0 select-none"
      style={{ display: 'block' }}
    >
      {rows.map((row) => {
        const isActive = activeSet.has(row.midi);
        const isC = row.midi % 12 === 0;

        return (
          <g key={row.midi}>
            {/* Row background */}
            <rect
              x={0}
              y={row.y}
              width={KEYBOARD_WIDTH}
              height={rowHeight}
              fill={
                isActive
                  ? '#93c5fd' // blue-300
                  : row.black
                    ? '#e5e7eb' // gray-200
                    : '#ffffff'
              }
              stroke="#d1d5db" // gray-300
              strokeWidth={0.5}
            />

            {/* Black key indicator */}
            {row.black && (
              <rect
                x={0}
                y={row.y}
                width={KEYBOARD_WIDTH * 0.6}
                height={rowHeight}
                fill={isActive ? '#60a5fa' : '#374151'} // blue-400 : gray-700
                rx={1}
              />
            )}

            {/* Label for C notes */}
            {isC && (
              <text
                x={row.black ? KEYBOARD_WIDTH * 0.65 + 4 : KEYBOARD_WIDTH - 4}
                y={row.y + rowHeight / 2}
                dominantBaseline="central"
                textAnchor="end"
                fontSize={9}
                fontWeight={600}
                fill={isActive ? '#1d4ed8' : '#6b7280'} // blue-700 : gray-500
                className="select-none"
              >
                {row.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export { KEYBOARD_WIDTH };
