import { useMemo } from 'react';
import { KEYBOARD_HIGH, KEYBOARD_LOW } from './earTraining';

interface EarKeyboardProps {
  /** 1~8도 테두리 시작 음 */
  tonic: number;
  /** MIDI → 채움 색 */
  colors: Map<number, string>;
  onPress: (midi: number) => void;
}

interface KeyRect {
  midi: number;
  x: number;
  isBlack: boolean;
}

const WHITE_KEY_WIDTH = 28;
const WHITE_KEY_HEIGHT = 100;
const BLACK_KEY_WIDTH = 18;
const BLACK_KEY_HEIGHT = 62;
const BLACK_PCS = [1, 3, 6, 8, 10];

/** 청음 연습용 C3~C6 건반. 누를 수 있고, 음계 범위 테두리와 으뜸음 "1"을 표시한다. */
export default function EarKeyboard({ tonic, colors, onPress }: EarKeyboardProps) {
  const { whiteKeys, blackKeys, totalWidth } = useMemo(() => {
    const white: KeyRect[] = [];
    const black: KeyRect[] = [];
    let whiteIdx = 0;
    for (let midi = KEYBOARD_LOW; midi <= KEYBOARD_HIGH; midi++) {
      if (BLACK_PCS.includes(midi % 12)) {
        black.push({ midi, x: whiteIdx * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2, isBlack: true });
      } else {
        white.push({ midi, x: whiteIdx * WHITE_KEY_WIDTH, isBlack: false });
        whiteIdx++;
      }
    }
    return { whiteKeys: white, blackKeys: black, totalWidth: whiteIdx * WHITE_KEY_WIDTH };
  }, []);

  const frame = useMemo(() => {
    const all = [...whiteKeys, ...blackKeys];
    const start = all.find(k => k.midi === tonic);
    const end = all.find(k => k.midi === tonic + 12);
    if (!start || !end) return null;
    const right = end.x + (end.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH);
    return { x: start.x, width: right - start.x };
  }, [whiteKeys, blackKeys, tonic]);

  const tonicPc = tonic % 12;

  const renderKey = (k: KeyRect) => {
    const w = k.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH;
    const h = k.isBlack ? BLACK_KEY_HEIGHT : WHITE_KEY_HEIGHT;
    const fill = colors.get(k.midi) ?? (k.isBlack ? '#1e293b' : 'white');
    return (
      <g key={k.midi} onPointerDown={() => onPress(k.midi)} className="cursor-pointer">
        <rect
          x={k.x + (k.isBlack ? 0 : 0.5)}
          y={0.5}
          width={k.isBlack ? w : w - 1}
          height={h}
          rx={2}
          fill={fill}
          stroke={k.isBlack ? '#0f172a' : '#94a3b8'}
          strokeWidth={k.isBlack ? 0.5 : 0.8}
        />
        {k.midi % 12 === tonicPc && (
          <text
            x={k.x + w / 2}
            y={h - 8}
            textAnchor="middle"
            fontSize={9}
            fontWeight="bold"
            fill={k.isBlack ? '#bfdbfe' : '#2563eb'}
            pointerEvents="none"
          >
            1
          </text>
        )}
      </g>
    );
  };

  return (
    <svg
      viewBox={`-1 -1 ${totalWidth + 2} ${WHITE_KEY_HEIGHT + 4}`}
      width="100%"
      className="select-none touch-none"
    >
      {whiteKeys.map(renderKey)}
      {blackKeys.map(renderKey)}
      {frame && (
        <rect
          x={frame.x}
          y={0}
          width={frame.width}
          height={WHITE_KEY_HEIGHT + 2}
          fill="none"
          stroke="#ea580c"
          strokeWidth={2.5}
          rx={2}
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
