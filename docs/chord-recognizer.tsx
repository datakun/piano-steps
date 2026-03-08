import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Instrument = "guitar" | "piano";

export interface ChordPattern {
  name: string;
  intervals: number[];
  display: string;
}

export interface DetectedNote {
  freq: number;
  db: number;
  bin: number;
  noteName: string;
  midi: number;
  noteClass: number; // 0–11, chromatic pitch class
  hps?: number;      // only populated in HPS mode
}

export interface ChordResult {
  root: string;
  pattern: ChordPattern;
  confidence: number; // 0.0–1.0
}

export interface HistoryEntry {
  name: string;
  time: string;
}

interface SpectrumCanvasProps {
  analyserRef: React.RefObject<AnalyserNode | null>;
  isListening: boolean;
  instrument: Instrument;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTE_NAMES: readonly string[] = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

/**
 * Chord pattern library.
 * `intervals` are semitone offsets from the root (mod 12).
 * Values > 11 are octave-extended tones (e.g. 9th = 14).
 */
const CHORD_PATTERNS: ChordPattern[] = [
  { name: "maj",    intervals: [0, 4, 7],        display: "" },
  { name: "min",    intervals: [0, 3, 7],        display: "m" },
  { name: "dim",    intervals: [0, 3, 6],        display: "dim" },
  { name: "aug",    intervals: [0, 4, 8],        display: "aug" },
  { name: "sus2",   intervals: [0, 2, 7],        display: "sus2" },
  { name: "sus4",   intervals: [0, 5, 7],        display: "sus4" },
  { name: "maj7",   intervals: [0, 4, 7, 11],    display: "maj7" },
  { name: "min7",   intervals: [0, 3, 7, 10],    display: "m7" },
  { name: "dom7",   intervals: [0, 4, 7, 10],    display: "7" },
  { name: "dim7",   intervals: [0, 3, 6, 9],     display: "dim7" },
  { name: "min7b5", intervals: [0, 3, 6, 10],    display: "m7♭5" },
  { name: "add9",   intervals: [0, 4, 7, 14],    display: "add9" },
  { name: "min9",   intervals: [0, 3, 7, 10, 14], display: "m9" },
  { name: "maj9",   intervals: [0, 4, 7, 11, 14], display: "maj9" },
];

// ─── Music Theory Utilities ───────────────────────────────────────────────────

/** Convert frequency (Hz) to MIDI note number (float). A4 = 440Hz = MIDI 69. */
function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

/** Convert MIDI note number to chromatic note name string (e.g. 60 → "C"). */
function midiToNoteName(midi: number): string {
  return NOTE_NAMES[((Math.round(midi) % 12) + 12) % 12];
}

/**
 * Match a set of pitch classes (0–11) against all chord patterns.
 * Uses a scoring system: reward matched intervals, penalise missing ones.
 * Requires at least 3 matched notes (or all required notes if pattern < 3).
 */
export function recognizeChord(noteSet: Set<number>): ChordResult | null {
  if (noteSet.size < 2) return null;

  const notes = [...noteSet].sort((a, b) => a - b);
  let best: ChordResult | null = null;
  let bestScore = -1;

  for (let root = 0; root < 12; root++) {
    for (const pattern of CHORD_PATTERNS) {
      const required = pattern.intervals.map((i) => (root + i) % 12);
      const matched = required.filter((n) => notes.includes(n)).length;
      const score =
        matched / pattern.intervals.length -
        (required.length - matched) * 0.3;

      if (matched >= Math.min(3, required.length) && score > bestScore) {
        bestScore = score;
        best = {
          root: NOTE_NAMES[root],
          pattern,
          confidence: matched / required.length,
        };
      }
    }
  }

  return best;
}

// ─── Pitch Detection: Guitar (FFT peak picking + harmonic suppression) ────────

/**
 * Guitar mode: detect multiple simultaneous pitches using FFT peak-picking.
 *
 * Algorithm:
 * 1. Find local magnitude peaks above a dB threshold in [60Hz, 1200Hz].
 * 2. Sort by amplitude, take top 12.
 * 3. Map each peak to a pitch class and keep the loudest per class.
 * 4. Walk descending by amplitude: for each accepted fundamental, suppress
 *    its 2nd–5th harmonics so they don't register as separate notes.
 *
 * Why not HPS for guitar?
 * Guitar has pronounced odd harmonics and strong string-body resonances that
 * confuse the HPS product — it tends to double or halve fundamental
 * estimates. Peak-picking with explicit harmonic suppression is more robust.
 *
 * Production upgrade path: replace with CREPE (pitch confidence model).
 * @see https://github.com/marl/crepe
 */
export function detectPitchesFFT(
  analyser: AnalyserNode,
  sampleRate: number
): DetectedNote[] {
  const bufLen = analyser.frequencyBinCount;
  const dataArray = new Float32Array(bufLen);
  analyser.getFloatFrequencyData(dataArray);

  const fftSize = analyser.fftSize;
  const freqPerBin = sampleRate / fftSize;
  const minBin = Math.floor(60 / freqPerBin);
  const maxBin = Math.min(Math.ceil(1200 / freqPerBin), bufLen - 1);
  const threshold = -55; // dBFS

  // Step 1: local peak candidates
  const peaks: Array<{ freq: number; db: number; bin: number }> = [];
  for (let i = minBin + 1; i < maxBin - 1; i++) {
    const v = dataArray[i];
    if (v > threshold && v > dataArray[i - 1] && v > dataArray[i + 1]) {
      peaks.push({ freq: (i * sampleRate) / fftSize, db: v, bin: i });
    }
  }

  // Step 2: keep loudest representative per pitch class
  peaks.sort((a, b) => b.db - a.db);
  const fundamentals = new Map<number, DetectedNote>();
  for (const peak of peaks.slice(0, 12)) {
    const midi = freqToMidi(peak.freq);
    const noteClass = ((Math.round(midi) % 12) + 12) % 12;
    const existing = fundamentals.get(noteClass);
    if (!existing || existing.db < peak.db) {
      fundamentals.set(noteClass, {
        ...peak,
        noteName: midiToNoteName(midi),
        midi: Math.round(midi),
        noteClass,
      });
    }
  }

  // Step 3: harmonic suppression walk
  const result: DetectedNote[] = [];
  const suppressed = new Set<number>();
  const sorted = [...fundamentals.values()].sort((a, b) => b.db - a.db);

  for (const f of sorted) {
    if (suppressed.has(f.noteClass)) continue;
    for (let h = 2; h <= 5; h++) {
      const harmMidi = f.midi + Math.round(12 * Math.log2(h));
      suppressed.add(((harmMidi % 12) + 12) % 12);
    }
    result.push(f);
  }

  return result.filter((n) => n.db > threshold).slice(0, 6);
}

// ─── Pitch Detection: Piano (HPS — Harmonic Product Spectrum) ─────────────────

/**
 * Piano mode: detect pitches using Harmonic Product Spectrum (HPS).
 *
 * Algorithm:
 * 1. Convert dB spectrum to linear amplitude.
 * 2. Compute HPS by multiplying downsampled copies (harmonics 2–4).
 *    HPS[i] = linear[i] * linear[2i] * linear[3i] * linear[4i]
 *    Peaks in the product spectrum correspond to fundamental frequencies
 *    whose harmonic series are all simultaneously strong.
 * 3. Find local HPS peaks; deduplicate by pitch class.
 *
 * Why HPS works well for piano:
 * Piano tones have a very regular harmonic series. The product amplifies
 * bins where all harmonics are present, making the fundamental stand out
 * even when higher partials dominate in raw dB.
 *
 * Production upgrade path: replace with Magenta OnsetsAndFrames (small,
 * ~17 MB). Provides note-level onset/offset events rather than frame
 * estimates.
 * @see https://magenta.tensorflow.org/onsets-frames
 */
export function detectPitchesHPS(
  analyser: AnalyserNode,
  sampleRate: number
): DetectedNote[] {
  const bufLen = analyser.frequencyBinCount;
  const dataArray = new Float32Array(bufLen);
  analyser.getFloatFrequencyData(dataArray);

  const fftSize = analyser.fftSize;
  const freqPerBin = sampleRate / fftSize;

  // dB → linear amplitude
  const linear = new Float32Array(bufLen);
  for (let i = 0; i < bufLen; i++) {
    linear[i] = Math.pow(10, dataArray[i] / 20);
  }

  // HPS product (4 harmonics)
  const hps = new Float32Array(bufLen);
  for (let i = 0; i < bufLen; i++) {
    hps[i] = linear[i];
    for (let h = 2; h <= 4; h++) {
      const j = Math.round(i * h);
      if (j < bufLen) hps[i] *= linear[j];
    }
  }

  const minBin = Math.floor(27.5 / freqPerBin);   // A0 (lowest piano key)
  const maxBin = Math.min(Math.ceil(4186 / freqPerBin), bufLen - 1); // C8
  const threshold = -50; // dBFS gate on raw spectrum

  const peaks: Array<{ freq: number; db: number; bin: number; hps: number }> =
    [];
  for (let i = minBin + 1; i < maxBin - 1; i++) {
    if (
      hps[i] > hps[i - 1] &&
      hps[i] > hps[i + 1] &&
      dataArray[i] > threshold
    ) {
      peaks.push({
        freq: (i * sampleRate) / fftSize,
        db: dataArray[i],
        bin: i,
        hps: hps[i],
      });
    }
  }

  peaks.sort((a, b) => b.hps - a.hps);
  const notes = new Map<number, DetectedNote>();
  for (const p of peaks.slice(0, 16)) {
    const midi = freqToMidi(p.freq);
    const nc = ((Math.round(midi) % 12) + 12) % 12;
    if (!notes.has(nc)) {
      notes.set(nc, {
        ...p,
        noteName: midiToNoteName(midi),
        midi: Math.round(midi),
        noteClass: nc,
      });
    }
  }

  return [...notes.values()].sort((a, b) => b.hps! - a.hps!).slice(0, 8);
}

// ─── Temporal Smoothing ───────────────────────────────────────────────────────

/**
 * Accumulates frame-level note detections over a rolling time window and
 * returns only pitch classes that appear in > 40% of frames.
 * This suppresses transient noise and pitch-detection jitter.
 */
class NoteAccumulator {
  private readonly windowMs: number;
  private history: Array<{ notes: DetectedNote[]; time: number }> = [];

  constructor(windowMs = 300) {
    this.windowMs = windowMs;
  }

  push(notes: DetectedNote[]): void {
    const now = Date.now();
    this.history.push({ notes, time: now });
    this.history = this.history.filter((h) => now - h.time < this.windowMs);
  }

  /** Returns pitch classes (0–11) stable across ≥ 40% of recent frames. */
  getStable(): number[] {
    const counts = new Map<number, number>();
    for (const h of this.history) {
      for (const n of h.notes) {
        counts.set(n.noteClass, (counts.get(n.noteClass) ?? 0) + 1);
      }
    }
    const total = this.history.length;
    if (total === 0) return [];

    const stable: number[] = [];
    for (const [nc, cnt] of counts.entries()) {
      if (cnt / total > 0.4) stable.push(nc);
    }
    return stable;
  }
}

// ─── Spectrum Visualizer ──────────────────────────────────────────────────────

function SpectrumCanvas({
  analyserRef,
  isListening,
  instrument,
}: SpectrumCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;

    const draw = (): void => {
      rafRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, W, H);

      if (!analyserRef.current || !isListening) {
        ctx.strokeStyle = "rgba(100,100,140,0.3)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x < W; x++) {
          const y = H / 2 + Math.sin(x * 0.05 + Date.now() * 0.001) * 8;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        return;
      }

      const analyser = analyserRef.current;
      const bufLen = analyser.frequencyBinCount;
      const data = new Float32Array(bufLen);
      analyser.getFloatFrequencyData(data);

      const accentColor =
        instrument === "piano" ? "#60a5fa" : "#34d399";
      const accentGlow =
        instrument === "piano"
          ? "rgba(96,165,250,0.3)"
          : "rgba(52,211,153,0.3)";

      const barW = W / 160;
      const maxBin = Math.min(bufLen, 800);

      for (let i = 0; i < 160; i++) {
        const binIdx = Math.floor((i / 160) * maxBin);
        const val = Math.max(0, (data[binIdx] + 90) / 90);
        const barH = val * H * 0.85;
        const x = i * barW;
        const y = H - barH;
        const grad = ctx.createLinearGradient(0, y, 0, H);
        grad.addColorStop(0, accentColor);
        grad.addColorStop(1, accentGlow);
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y, barW - 2, barH);
      }

      const waveData = new Uint8Array(bufLen);
      analyser.getByteTimeDomainData(waveData);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const sliceW = W / bufLen;
      for (let i = 0; i < bufLen; i++) {
        const v = waveData[i] / 128 - 1;
        const y = v * H * 0.15 + H * 0.5;
        i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * sliceW, y);
      }
      ctx.stroke();
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isListening, instrument]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={120}
      style={{
        width: "100%",
        height: "120px",
        borderRadius: "8px",
        display: "block",
      }}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChordRecognizer(): JSX.Element {
  const [instrument, setInstrument] = useState<Instrument>("guitar");
  const [isListening, setIsListening] = useState(false);
  const [detectedNotes, setDetectedNotes] = useState<string[]>([]);
  const [chord, setChord] = useState<ChordResult | null>(null);
  const [chordHistory, setChordHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const accRef = useRef<NoteAccumulator>(new NoteAccumulator(350));

  const stopListening = useCallback((): void => {
    cancelAnimationFrame(rafRef.current);
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    setIsListening(false);
    setDetectedNotes([]);
    setChord(null);
    setVolume(0);
  }, []);

  const startListening = useCallback(async (): Promise<void> => {
    try {
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 44100 });
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      // Larger FFT for guitar (finer freq resolution at low freqs)
      // Piano benefits from smoothing to reduce transient spikes
      analyser.fftSize = 16384;
      analyser.smoothingTimeConstant = instrument === "piano" ? 0.7 : 0.6;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      setIsListening(true);
      accRef.current = new NoteAccumulator(350);

      const process = (): void => {
        rafRef.current = requestAnimationFrame(process);

        // Volume meter (RMS)
        const td = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(td);
        let rms = 0;
        for (const v of td) rms += (v / 128 - 1) ** 2;
        setVolume(Math.min(1, Math.sqrt(rms / td.length) * 8));

        const sampleRate = ctx.sampleRate;
        const rawNotes =
          instrument === "piano"
            ? detectPitchesHPS(analyser, sampleRate)
            : detectPitchesFFT(analyser, sampleRate);

        accRef.current.push(rawNotes);
        const stableClasses = accRef.current.getStable();
        setDetectedNotes(stableClasses.map((nc) => NOTE_NAMES[nc]));

        const result = recognizeChord(new Set(stableClasses));
        if (result) {
          setChord(result);
          setChordHistory((prev) => {
            const name = result.root + result.pattern.display;
            if (prev[0]?.name === name) return prev;
            return [
              { name, time: new Date().toLocaleTimeString() },
              ...prev,
            ].slice(0, 8);
          });
        } else {
          setChord(null);
        }
      };
      process();
    } catch (e: unknown) {
      const err = e as Error;
      setError(
        err.name === "NotAllowedError"
          ? "마이크 권한이 필요합니다."
          : `오류: ${err.message}`
      );
    }
  }, [instrument]);

  // Cleanup on unmount
  useEffect(() => () => stopListening(), [stopListening]);

  const chordDisplay = chord ? `${chord.root}${chord.pattern.display}` : "—";
  const confidence = chord ? Math.round(chord.confidence * 100) : 0;
  const accentColor = instrument === "piano" ? "#60a5fa" : "#34d399";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "#e2e2f0",
        fontFamily: "'Courier New', monospace",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .note-pill {
          display: inline-flex; align-items: center; justify-content: center;
          width: 40px; height: 40px; border-radius: 50%; font-weight: 700;
          font-size: 11px; border: 1.5px solid; transition: all 0.15s;
        }
        .note-pill.active  { background: var(--accent); border-color: var(--accent); color: #0a0a0f; }
        .note-pill.inactive { background: transparent; border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.25); }
        .inst-btn {
          padding: 8px 24px; border-radius: 4px; border: 1.5px solid;
          font-family: 'Space Mono', monospace; font-size: 12px;
          letter-spacing: 0.1em; cursor: pointer; transition: all 0.2s;
          text-transform: uppercase;
        }
        .inst-btn.active  { color: #0a0a0f; }
        .inst-btn.inactive { background: transparent; color: rgba(255,255,255,0.4); }
        .listen-btn {
          padding: 14px 48px; border-radius: 6px; font-family: 'Space Mono', monospace;
          font-size: 13px; letter-spacing: 0.12em; cursor: pointer;
          border: none; text-transform: uppercase; transition: all 0.2s; font-weight: 700;
        }
        .hist-item {
          padding: 6px 12px; border-radius: 4px; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07); display: flex;
          justify-content: space-between; align-items: center; font-size: 12px;
        }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h1
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "clamp(36px, 8vw, 60px)",
            letterSpacing: "0.15em",
            color: accentColor,
            lineHeight: 1,
            marginBottom: "4px",
            textShadow: `0 0 40px ${accentColor}55`,
          }}
        >
          CHORD SENSE
        </h1>
        <p
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Real-time chord recognition
        </p>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "620px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Instrument selector */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          {(
            [
              { id: "guitar" as Instrument, label: "Guitar", color: "#34d399" },
              { id: "piano"  as Instrument, label: "Piano",  color: "#60a5fa" },
            ] as const
          ).map(({ id, label, color }) => (
            <button
              key={id}
              className={`inst-btn ${instrument === id ? "active" : "inactive"}`}
              onClick={() => {
                if (isListening) stopListening();
                setInstrument(id);
              }}
              style={{
                borderColor: color,
                background: instrument === id ? color : "transparent",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Spectrum visualizer */}
        <div
          style={{
            borderRadius: "10px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <SpectrumCanvas
            analyserRef={analyserRef}
            isListening={isListening}
            instrument={instrument}
          />
        </div>

        {/* Chord display */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "10px",
            padding: "28px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {chord && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(ellipse at center, ${accentColor}08 0%, transparent 70%)`,
                pointerEvents: "none",
              }}
            />
          )}
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "clamp(56px, 14vw, 96px)",
              lineHeight: 1,
              color: chord ? accentColor : "rgba(255,255,255,0.1)",
              textShadow: chord ? `0 0 60px ${accentColor}66` : "none",
              transition: "all 0.2s",
              letterSpacing: "0.05em",
            }}
          >
            {chordDisplay}
          </div>
          {chord && (
            <div
              style={{
                marginTop: "8px",
                fontSize: "11px",
                color: "rgba(255,255,255,0.35)",
                letterSpacing: "0.15em",
              }}
            >
              CONFIDENCE {confidence}%
              <div
                style={{
                  width: "80px",
                  height: "2px",
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: "1px",
                  margin: "6px auto 0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${confidence}%`,
                    height: "100%",
                    background: accentColor,
                    transition: "width 0.3s",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Note pills */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {NOTE_NAMES.map((n) => (
            <span
              key={n}
              className={`note-pill ${
                detectedNotes.includes(n) ? "active" : "inactive"
              }`}
              style={{ "--accent": accentColor } as React.CSSProperties}
            >
              {n}
            </span>
          ))}
        </div>

        {/* Volume bar + Listen button */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "3px",
              background: "rgba(255,255,255,0.07)",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${volume * 100}%`,
                height: "100%",
                background: accentColor,
                transition: "width 0.05s",
                borderRadius: "2px",
              }}
            />
          </div>
          <button
            className="listen-btn"
            onClick={isListening ? stopListening : startListening}
            style={{
              background: isListening ? "rgba(255,70,70,0.15)" : accentColor,
              color: isListening ? "#ff6b6b" : "#0a0a0f",
              border: isListening ? "1.5px solid #ff6b6b" : "none",
            }}
          >
            {isListening ? "■  Stop" : "●  Start Listening"}
          </button>
          {error && (
            <p style={{ color: "#f87171", fontSize: "12px" }}>{error}</p>
          )}
        </div>

        {/* Chord history */}
        {chordHistory.length > 0 && (
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              paddingTop: "16px",
            }}
          >
            <p
              style={{
                fontSize: "10px",
                letterSpacing: "0.2em",
                color: "rgba(255,255,255,0.25)",
                marginBottom: "8px",
                textTransform: "uppercase",
              }}
            >
              History
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {chordHistory.map((h, i) => (
                <div key={i} className="hist-item">
                  <span
                    style={{
                      color:
                        i === 0 ? accentColor : "rgba(255,255,255,0.5)",
                      fontWeight: i === 0 ? 700 : 400,
                    }}
                  >
                    {h.name}
                  </span>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.2)",
                      fontSize: "11px",
                    }}
                  >
                    {h.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Algorithm info footer */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "8px",
            padding: "12px 16px",
            fontSize: "11px",
            color: "rgba(255,255,255,0.25)",
            lineHeight: "1.6",
          }}
        >
          <span style={{ color: accentColor, fontWeight: 700 }}>
            {instrument === "piano" ? "Piano mode" : "Guitar mode"}
          </span>
          {instrument === "piano"
            ? " — HPS(Harmonic Product Spectrum). 피아노의 규칙적인 배음 구조에 최적화."
            : " — FFT 피크 감지 + 배음 억제. 기타의 복잡한 overtone 처리에 최적화."}
          <br />
          Production: Magenta onset_frame (piano) / CREPE (guitar) 모델 교체 시 정확도 대폭 향상.
        </div>
      </div>
    </div>
  );
}
