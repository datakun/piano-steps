import { useEffect, useRef, useCallback } from 'react';
import type { MelodyNote } from '../../lib/audio/melodyExtractor';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 14;
const PIXELS_PER_SECOND = 120;
const RULER_HEIGHT = 24;
const MIN_NOTE_WIDTH = 4;

const BLACK_KEY_PCS = new Set([1, 3, 6, 8, 10]);

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Colors
const COLOR_BG_WHITE = '#ffffff';
const COLOR_BG_BLACK = '#f3f4f6'; // gray-100
const COLOR_GRID_BEAT = 'rgba(209,213,219,0.5)'; // gray-300/50
const COLOR_GRID_BAR = 'rgba(156,163,175,0.6)'; // gray-400/60
const COLOR_NOTE = '#3b82f6'; // blue-500
const COLOR_NOTE_BORDER = '#2563eb'; // blue-600
const COLOR_NOTE_TEXT = '#ffffff';
const COLOR_PLAYHEAD = '#ef4444'; // red-500
const COLOR_RULER_BG = '#f9fafb'; // gray-50
const COLOR_RULER_TEXT = '#6b7280'; // gray-500
const COLOR_RULER_LINE = '#e5e7eb'; // gray-200

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PianoRollCanvasProps {
  notes: MelodyNote[];
  minMidi: number;
  maxMidi: number;
  bpm: number;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
}

export default function PianoRollCanvas({
  notes,
  minMidi,
  maxMidi,
  bpm,
  currentTime,
  isPlaying,
  onSeek,
}: PianoRollCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const scrollXRef = useRef(0);

  // Compute total duration
  const totalDuration = notes.reduce(
    (max, n) => Math.max(max, n.startTime + n.duration),
    0,
  );
  const totalRows = maxMidi - minMidi + 1;
  const canvasContentWidth = Math.max(
    totalDuration * PIXELS_PER_SECOND + 200, // extra padding at end
    400,
  );
  const canvasContentHeight = totalRows * ROW_HEIGHT + RULER_HEIGHT;

  // Auto-scroll during playback
  useEffect(() => {
    if (!isPlaying || !containerRef.current) return;

    const container = containerRef.current;
    const tick = () => {
      const playheadX = currentTime * PIXELS_PER_SECOND;
      const viewWidth = container.clientWidth;
      const targetScroll = Math.max(0, playheadX - viewWidth * 0.33);
      // Smooth lerp
      const current = container.scrollLeft;
      const next = current + (targetScroll - current) * 0.15;
      container.scrollLeft = next;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, currentTime]);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvasContentWidth;
    const H = canvasContentHeight;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    // --- Clear ---
    ctx.clearRect(0, 0, W, H);

    // --- Ruler background ---
    ctx.fillStyle = COLOR_RULER_BG;
    ctx.fillRect(0, 0, W, RULER_HEIGHT);
    ctx.strokeStyle = COLOR_RULER_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, RULER_HEIGHT);
    ctx.lineTo(W, RULER_HEIGHT);
    ctx.stroke();

    // --- Row backgrounds ---
    for (let midi = maxMidi; midi >= minMidi; midi--) {
      const rowIdx = maxMidi - midi;
      const y = RULER_HEIGHT + rowIdx * ROW_HEIGHT;
      const isBlack = BLACK_KEY_PCS.has(midi % 12);
      ctx.fillStyle = isBlack ? COLOR_BG_BLACK : COLOR_BG_WHITE;
      ctx.fillRect(0, y, W, ROW_HEIGHT);
    }

    // --- Grid lines (beats and bars) ---
    const secondsPerBeat = 60 / bpm;
    const secondsPerBar = secondsPerBeat * 4; // assume 4/4

    ctx.lineWidth = 0.5;
    // Beat lines
    for (let t = 0; t <= totalDuration + 5; t += secondsPerBeat) {
      const x = t * PIXELS_PER_SECOND;
      const isBar = Math.abs(t % secondsPerBar) < 0.001 ||
        Math.abs(t % secondsPerBar - secondsPerBar) < 0.001;
      ctx.strokeStyle = isBar ? COLOR_GRID_BAR : COLOR_GRID_BEAT;
      ctx.lineWidth = isBar ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();

      // Ruler text for bars
      if (isBar) {
        const barNum = Math.round(t / secondsPerBar) + 1;
        ctx.fillStyle = COLOR_RULER_TEXT;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${barNum}`, x + 3, 14);
      }
    }

    // Seconds markers in ruler
    ctx.fillStyle = COLOR_RULER_TEXT;
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let s = 1; s <= totalDuration + 2; s++) {
      const x = s * PIXELS_PER_SECOND;
      // Small tick
      ctx.strokeStyle = COLOR_RULER_LINE;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, RULER_HEIGHT - 4);
      ctx.lineTo(x, RULER_HEIGHT);
      ctx.stroke();
    }

    // --- Note blocks ---
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (const note of notes) {
      const x = note.startTime * PIXELS_PER_SECOND;
      const rowIdx = maxMidi - note.pitchMidi;
      const y = RULER_HEIGHT + rowIdx * ROW_HEIGHT;
      const w = Math.max(note.duration * PIXELS_PER_SECOND, MIN_NOTE_WIDTH);
      const h = ROW_HEIGHT - 1;

      // Note body
      const alpha = 0.5 + note.amplitude * 0.5;
      ctx.fillStyle = COLOR_NOTE;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.roundRect(x, y + 0.5, w, h, 2);
      ctx.fill();

      // Note border
      ctx.strokeStyle = COLOR_NOTE_BORDER;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Note name text (if block is wide enough)
      if (w > 24) {
        ctx.fillStyle = COLOR_NOTE_TEXT;
        ctx.fillText(note.name, x + 3, y + h / 2 + 0.5);
      }
    }

    // --- Playhead ---
    if (currentTime >= 0) {
      const px = currentTime * PIXELS_PER_SECOND;
      ctx.strokeStyle = COLOR_PLAYHEAD;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();

      // Playhead triangle on ruler
      ctx.fillStyle = COLOR_PLAYHEAD;
      ctx.beginPath();
      ctx.moveTo(px, RULER_HEIGHT);
      ctx.lineTo(px - 5, RULER_HEIGHT - 8);
      ctx.lineTo(px + 5, RULER_HEIGHT - 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [notes, minMidi, maxMidi, bpm, currentTime, totalDuration, canvasContentWidth, canvasContentHeight]);

  // Click to seek
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const time = clickX / PIXELS_PER_SECOND;
      onSeek(Math.max(0, Math.min(time, totalDuration)));
    },
    [onSeek, totalDuration],
  );

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto overflow-y-hidden"
      style={{ height: canvasContentHeight }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="cursor-pointer"
        style={{
          width: canvasContentWidth,
          height: canvasContentHeight,
          display: 'block',
        }}
      />
    </div>
  );
}

export { ROW_HEIGHT, PIXELS_PER_SECOND, RULER_HEIGHT };
