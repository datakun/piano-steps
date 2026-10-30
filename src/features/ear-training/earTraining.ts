import type { NoteName } from '../../types/music';
import { midiToPitch, noteDisplay, noteToSemitone } from '../../lib/music/noteUtils';

/**
 * 청음 연습 순수 로직: 조 정보, 음 표기, 문제 생성, 판정.
 * 모든 음은 MIDI 번호로 다룬다.
 */

export type ExerciseKind = 'step' | 'interval' | 'compare' | 'chord' | 'melody' | 'voices';

export const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const SYLLABLES = ['도', '레', '미', '파', '솔', '라', '시'];

/** 건반 범위 C3~C6 */
export const KEYBOARD_LOW = 48;
export const KEYBOARD_HIGH = 84;

const mod = (n: number, m: number) => ((n % m) + m) % m;
const randInt = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(arr: readonly T[]): T => arr[randInt(arr.length)];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── 조 ─────────────────────────────────────────────

export interface KeyContext {
  key: NoteName;
  /** 1~8도 테두리의 시작 으뜸음 */
  tonic: number;
  /** 출제 하한: 으뜸음 아래 라 */
  low: number;
  /** 출제 상한: 으뜸음 위 10도(미) */
  high: number;
}

/** C~A♭ 조는 4옥타브, A·B♭·B 조는 3옥타브에 으뜸음을 둔다 */
export function keyContext(key: NoteName): KeyContext {
  const pc = noteToSemitone(key);
  const octave = pc >= 9 ? 3 : 4;
  const tonic = (octave + 1) * 12 + pc;
  return { key, tonic, low: tonic - 3, high: tonic + 16 };
}

export function degreeOf(ctx: KeyContext, midi: number): number {
  return mod(midi - ctx.tonic, 12);
}

export function inScale(ctx: KeyContext, midi: number): boolean {
  return MAJOR_STEPS.includes(degreeOf(ctx, midi));
}

function rangeNotes(ctx: KeyContext, scaleOnly: boolean): number[] {
  const notes: number[] = [];
  for (let m = ctx.low; m <= ctx.high; m++) {
    if (!scaleOnly || inScale(ctx, m)) notes.push(m);
  }
  return notes;
}

// ── 표기 ───────────────────────────────────────────

const INTERVAL_TABLE: [string, number][] = [
  ['완전', 1], ['단', 2], ['장', 2], ['단', 3], ['장', 3], ['완전', 4],
  ['감', 5], ['완전', 5], ['단', 6], ['장', 6], ['단', 7], ['장', 7],
];

/** 반음 수 → 음정 이름. 트라이톤은 감5도로 적는다. */
export function intervalName(semitones: number): string {
  const s = Math.abs(semitones);
  if (s === 12) return '완전8도';
  const [quality, number] = INTERVAL_TABLE[s % 12];
  const octaves = Math.floor(s / 12);
  return `${quality}${number + octaves * 7}도`;
}

export interface Spelling {
  /** 음 이름 (옥타브 포함), 예: "F♯4" */
  name: string;
  /** 옥타브 없는 음 이름 */
  pcName: string;
  /** 계이름(이동도). 음계 밖 음은 위 계이름에 ♭ */
  syllable: string;
  /** 으뜸음에서의 음정 이름 */
  fromTonic: string;
}

export function spell(ctx: KeyContext, midi: number): Spelling {
  const d = degreeOf(ctx, midi);
  let step = MAJOR_STEPS.indexOf(d);
  let lowered = false;
  if (step < 0) {
    step = MAJOR_STEPS.indexOf(d + 1);
    lowered = true;
  }
  const letterIdx = (LETTERS.indexOf(ctx.key[0]) + step) % 7;
  let acc = mod(midi - LETTER_PC[letterIdx], 12);
  if (acc > 6) acc -= 12;

  let pcName: string;
  let octave: number;
  if (Math.abs(acc) <= 1) {
    pcName = LETTERS[letterIdx] + (acc === 1 ? '♯' : acc === -1 ? '♭' : '');
    octave = Math.floor((midi - acc) / 12) - 1;
  } else {
    const p = midiToPitch(midi, true);
    pcName = noteDisplay(p.name);
    octave = p.octave;
  }
  return {
    name: `${pcName}${octave}`,
    pcName,
    syllable: SYLLABLES[step] + (lowered ? '♭' : ''),
    fromTonic: intervalName(d),
  };
}

/** "E4 미(장3도)" 형태. 으뜸음은 음정 이름을 붙이지 않는다. */
export function noteLabel(ctx: KeyContext, midi: number): string {
  const s = spell(ctx, midi);
  return degreeOf(ctx, midi) === 0 ? `${s.name} ${s.syllable}` : `${s.name} ${s.syllable}(${s.fromTonic})`;
}

// ── 화음 종류 ──────────────────────────────────────

export interface ChordType {
  id: string;
  label: string;
  intervals: number[];
}

export const TRIAD_TYPES: ChordType[] = [
  { id: 'M', label: '메이저', intervals: [0, 4, 7] },
  { id: 'm', label: '마이너', intervals: [0, 3, 7] },
  { id: 'dim', label: 'dim', intervals: [0, 3, 6] },
  { id: 'aug', label: 'aug', intervals: [0, 4, 8] },
];

export const SEVENTH_TYPES: ChordType[] = [
  { id: 'maj7', label: 'maj7', intervals: [0, 4, 7, 11] },
  { id: '7', label: '7', intervals: [0, 4, 7, 10] },
  { id: 'm7', label: 'm7', intervals: [0, 3, 7, 10] },
  { id: 'm7b5', label: 'm7♭5', intervals: [0, 3, 6, 10] },
  { id: 'dim7', label: 'dim7', intervals: [0, 3, 6, 9] },
];

/** 4음 텐션 화음: 3화음 + 텐션, 또는 7화음에서 5음 대신 텐션 */
export const TENSION_TYPES: ChordType[] = [
  { id: 'add9', label: 'add9', intervals: [0, 4, 7, 14] },
  { id: 'addb9', label: 'add♭9', intervals: [0, 4, 7, 13] },
  { id: 'adds9', label: 'add♯9', intervals: [0, 4, 7, 15] },
  { id: 'add11', label: 'add11', intervals: [0, 4, 7, 17] },
  { id: 'adds11', label: 'add♯11', intervals: [0, 4, 7, 18] },
  { id: 'madd9', label: 'm(add9)', intervals: [0, 3, 7, 14] },
  { id: 'madd11', label: 'm(add11)', intervals: [0, 3, 7, 17] },
  { id: 'maj79', label: 'maj7(9)', intervals: [0, 4, 11, 14] },
  { id: 'maj7s11', label: 'maj7(♯11)', intervals: [0, 4, 11, 18] },
  { id: '79', label: '7(9)', intervals: [0, 4, 10, 14] },
  { id: '7b9', label: '7(♭9)', intervals: [0, 4, 10, 13] },
  { id: '7s9', label: '7(♯9)', intervals: [0, 4, 10, 15] },
  { id: '7s11', label: '7(♯11)', intervals: [0, 4, 10, 18] },
  { id: 'm79', label: 'm7(9)', intervals: [0, 3, 10, 14] },
  { id: 'm711', label: 'm7(11)', intervals: [0, 3, 10, 17] },
];

export type ChordSetId = 'triad2' | 'triad3' | 'triad4' | 'seventh' | 'tension';

export const CHORD_SETS: { id: ChordSetId; label: string; types: ChordType[] }[] = [
  { id: 'triad2', label: '3화음: 메이저·마이너', types: TRIAD_TYPES.slice(0, 2) },
  { id: 'triad3', label: '3화음: + dim', types: TRIAD_TYPES.slice(0, 3) },
  { id: 'triad4', label: '3화음: 4종', types: TRIAD_TYPES },
  { id: 'seventh', label: '7화음', types: SEVENTH_TYPES },
  { id: 'tension', label: '텐션', types: TENSION_TYPES },
];

export function chordSetTypes(id: ChordSetId): ChordType[] {
  return CHORD_SETS.find(s => s.id === id)!.types;
}

export interface VoicedChord {
  type: ChordType;
  /** 근음 MIDI (전위 전 기준) */
  root: number;
  /** 실제 소리 나는 음, 오름차순 */
  notes: number[];
}

function voice(type: ChordType, root: number, inversion: number): number[] {
  const notes = type.intervals.map(i => root + i);
  for (let k = 0; k < inversion; k++) {
    notes.sort((a, b) => a - b);
    notes[0] += 12;
  }
  return notes.sort((a, b) => a - b);
}

/** 출제 음역 안에 들어가는 모든 보이싱 */
function chordVoicings(ctx: KeyContext, type: ChordType, inversions: boolean): VoicedChord[] {
  const result: VoicedChord[] = [];
  const maxInv = inversions ? type.intervals.length - 1 : 0;
  for (let root = ctx.low - 12; root <= ctx.high; root++) {
    for (let inv = 0; inv <= maxInv; inv++) {
      const notes = voice(type, root, inv);
      if (notes[0] >= ctx.low && notes[notes.length - 1] <= ctx.high) {
        result.push({ type, root, notes });
      }
    }
  }
  return result;
}

export function chordSymbol(ctx: KeyContext, chord: VoicedChord): string {
  const root = spell(ctx, chord.root).pcName;
  if (chord.type.id === 'M') return root;
  if (chord.type.id === 'm') return `${root}m`;
  return `${root}${chord.type.label}`;
}

// ── 문제 ───────────────────────────────────────────

export interface MelodyEvent {
  /** null 이면 쉼표 */
  midi: number | null;
  /** 박 수 (4분음표 = 1) */
  beats: number;
}

export interface DurationOption {
  id: string;
  label: string;
  beats: number;
  rest: boolean;
}

export const DURATIONS: DurationOption[] = [
  { id: 'w', label: '온음표', beats: 4, rest: false },
  { id: 'h', label: '2분', beats: 2, rest: false },
  { id: 'q', label: '4분', beats: 1, rest: false },
  { id: 'e', label: '8분', beats: 0.5, rest: false },
  { id: 'hd', label: '점2분', beats: 3, rest: false },
  { id: 'qd', label: '점4분', beats: 1.5, rest: false },
  { id: 'qr', label: '4분쉼표', beats: 1, rest: true },
  { id: 'er', label: '8분쉼표', beats: 0.5, rest: true },
];

const RHYTHM_LEVEL_IDS: Record<number, string[]> = {
  1: ['w', 'h', 'q'],
  2: ['w', 'h', 'q', 'e', 'hd'],
  3: ['w', 'h', 'q', 'e', 'hd', 'qd', 'qr', 'er'],
};

export function rhythmDurations(level: number): DurationOption[] {
  const ids = RHYTHM_LEVEL_IDS[level] ?? [];
  return DURATIONS.filter(d => ids.includes(d.id));
}

/** 선율 음 진행 단계별 최대 도약(반음) */
const MOTION_LIMIT: Record<number, number> = { 1: 2, 2: 4, 3: 12 };

export type Question =
  | { kind: 'step'; notes: [number, number]; harmonic: boolean; answer: 'half' | 'whole' }
  | { kind: 'interval'; notes: [number, number]; harmonic: boolean }
  | { kind: 'compare'; a: [number, number]; b: [number, number]; answer: 'A' | 'B' | 'same' }
  | { kind: 'chord-same'; first: VoicedChord; second: VoicedChord; answer: 'same' | 'diff' }
  | { kind: 'chord'; chord: VoicedChord }
  | { kind: 'melody'; events: MelodyEvent[]; rhythm: boolean }
  | { kind: 'voices'; beats: number[][] };

export interface QuestionSettings {
  kind: ExerciseKind;
  scaleOnly: boolean;
  stepPlay: 'seq' | 'harm' | 'mix';
  intervalStart: 'any' | 'do';
  intervalHarmonic: boolean;
  intervals: number[];
  compareStart: 'same' | 'diff';
  compareIntervals: number[];
  chordStage: 'same' | 'identify';
  chordSet: ChordSetId;
  chordInversions: boolean;
  melodyLength: number;
  melodyMotion: number;
  melodyRhythm: number;
  voiceCount: 2 | 3;
}

/** 두 음 쌍 후보: 첫 음 → 둘째 음 */
function intervalPairs(ctx: KeyContext, scaleOnly: boolean, semitones: number[]): [number, number][] {
  const pool = rangeNotes(ctx, scaleOnly);
  const pairs: [number, number][] = [];
  for (const a of pool) {
    for (const b of pool) {
      if (semitones.includes(Math.abs(b - a))) pairs.push([a, b]);
    }
  }
  return pairs;
}

function genStep(ctx: KeyContext, s: QuestionSettings): Question | null {
  const pairs = intervalPairs(ctx, s.scaleOnly, [1, 2]);
  if (pairs.length === 0) return null;
  const notes = pick(pairs);
  const harmonic = s.stepPlay === 'harm' || (s.stepPlay === 'mix' && Math.random() < 0.5);
  return { kind: 'step', notes, harmonic, answer: Math.abs(notes[1] - notes[0]) === 1 ? 'half' : 'whole' };
}

function genInterval(ctx: KeyContext, s: QuestionSettings): Question | null {
  let pairs = intervalPairs(ctx, s.scaleOnly, s.intervals);
  if (s.intervalHarmonic) pairs = pairs.filter(([a, b]) => b > a);
  if (s.intervalStart === 'do') pairs = pairs.filter(([a]) => degreeOf(ctx, a) === 0);
  if (pairs.length === 0) return null;
  return { kind: 'interval', notes: pick(pairs), harmonic: s.intervalHarmonic };
}

function genCompare(ctx: KeyContext, s: QuestionSettings): Question | null {
  const pairs = intervalPairs(ctx, s.scaleOnly, s.compareIntervals).filter(([a, b]) => b > a);
  if (pairs.length === 0) return null;
  const widths = [...new Set(pairs.map(([a, b]) => b - a))];
  const wantSame = widths.length === 1 || Math.random() < 1 / 3;

  for (let attempt = 0; attempt < 200; attempt++) {
    const a = pick(pairs);
    const candidates = pairs.filter(([c, d]) => {
      const sameWidth = d - c === a[1] - a[0];
      if (wantSame !== sameWidth) return false;
      return s.compareStart === 'same' ? c === a[0] : c !== a[0];
    });
    if (candidates.length === 0) continue;
    const b = pick(candidates);
    const wa = a[1] - a[0];
    const wb = b[1] - b[0];
    return { kind: 'compare', a, b, answer: wa === wb ? 'same' : wa > wb ? 'A' : 'B' };
  }
  return null;
}

function genChord(ctx: KeyContext, s: QuestionSettings): Question | null {
  const types = chordSetTypes(s.chordSet);
  const type = pick(types);
  const voicings = chordVoicings(ctx, type, s.chordInversions);
  if (voicings.length === 0) return null;
  const first = pick(voicings);

  if (s.chordStage === 'identify') return { kind: 'chord', chord: first };

  // 같은지 다른지: 같은 근음에서 보이싱을 바꿔 들려준다
  const rootPc = mod(first.root, 12);
  const sameKey = first.notes.join(',');
  const wantSame = types.length === 1 || Math.random() < 0.5;
  const pool = wantSame
    ? chordVoicings(ctx, type, true).filter(v => mod(v.root, 12) === rootPc && v.notes.join(',') !== sameKey)
    : types
        .filter(t => t.id !== type.id)
        .flatMap(t => chordVoicings(ctx, t, true))
        .filter(v => mod(v.root, 12) === rootPc);
  const second = pool.length > 0 ? pick(pool) : first;
  const same = second.type.id === type.id;
  return { kind: 'chord-same', first, second, answer: same ? 'same' : 'diff' };
}

function genMelody(ctx: KeyContext, s: QuestionSettings): Question | null {
  const pool = rangeNotes(ctx, s.scaleOnly);
  const limit = MOTION_LIMIT[s.melodyMotion] ?? 2;
  const pitches: number[] = [pick(pool)];
  while (pitches.length < s.melodyLength) {
    const prev = pitches[pitches.length - 1];
    const next = pool.filter(m => m !== prev && Math.abs(m - prev) <= limit);
    if (next.length === 0) return null;
    pitches.push(pick(next));
  }

  const rhythm = s.melodyRhythm > 0;
  if (!rhythm) return { kind: 'melody', events: pitches.map(midi => ({ midi, beats: 1 })), rhythm };

  const durations = rhythmDurations(s.melodyRhythm);
  const noteDurs = durations.filter(d => !d.rest);
  const restDurs = durations.filter(d => d.rest);
  // 4분음표가 더 자주 나오도록 가중
  const weighted = [...noteDurs, ...noteDurs.filter(d => d.id === 'q' || d.id === 'e')];
  const events: MelodyEvent[] = [];
  pitches.forEach((midi, i) => {
    if (i > 0 && restDurs.length > 0 && Math.random() < 0.15) {
      events.push({ midi: null, beats: pick(restDurs).beats });
    }
    events.push({ midi, beats: pick(weighted).beats });
  });
  return { kind: 'melody', events, rhythm };
}

// ── 2·3성부 ────────────────────────────────────────

const VOICE_BEATS = 6;
/** 2성 세로 음정(반음): 3도, 6도, 완전5도, 옥타브 */
const TWO_VOICE_VERTICAL = [3, 4, 7, 8, 9, 12];

function diatonicTriads(ctx: KeyContext): number[][] {
  // I, ii, iii, IV, V, vi
  return [0, 1, 2, 3, 4, 5].map(i =>
    [i, i + 2, i + 4].map(k => mod(ctx.tonic + MAJOR_STEPS[k % 7], 12)),
  );
}

function combos(pool: number[], size: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, acc: number[]) => {
    if (acc.length === size) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < pool.length; i++) rec(i + 1, [...acc, pool[i]]);
  };
  rec(0, []);
  return out;
}

function beatCandidates(ctx: KeyContext, count: 2 | 3, beat: number): number[][] {
  const pool = rangeNotes(ctx, true);
  const tonicPc = mod(ctx.tonic, 12);
  const triads = diatonicTriads(ctx);
  const tonicTriad = triads[0];
  const isEdge = beat === 0 || beat === VOICE_BEATS - 1;
  const isLast = beat === VOICE_BEATS - 1;

  const base = combos(pool, count);
  // 같은 음(완전1도)은 처음과 끝 박에만
  if (count === 2 && isEdge) base.push(...pool.map(m => [m, m]));

  return base.filter(chord => {
    for (let i = 1; i < chord.length; i++) {
      if (chord[i] - chord[i - 1] > 12) return false;
    }
    const pcs = chord.map(m => mod(m, 12));
    if (isLast && (pcs[0] !== tonicPc || pcs[pcs.length - 1] !== tonicPc)) return false;
    if (beat === 0 && !pcs.every(pc => tonicTriad.includes(pc))) return false;

    if (count === 2) {
      const diff = chord[1] - chord[0];
      return diff === 0 ? isEdge : TWO_VOICE_VERTICAL.includes(diff);
    }
    if (isLast) return tonicTriad.includes(pcs[1]);
    return triads.some(t => pcs.every(pc => t.includes(pc))) && new Set(pcs).size >= 2;
  });
}

/** 아래 성부부터 위 성부 순서 */
function voiceTransitionOk(prev: number[], cur: number[], prevMoves: number[] | null): boolean {
  const top = cur.length - 1;
  for (let v = 0; v <= top; v++) {
    const move = cur[v] - prev[v];
    const limit = v === 0 ? 7 : 5;
    if (Math.abs(move) > limit) return false;
    if (prevMoves && Math.abs(prevMoves[v]) > 2) {
      if (move === 0 || Math.sign(move) === Math.sign(prevMoves[v])) return false;
    }
  }
  // 병행 완전5도·옥타브
  for (let i = 0; i < cur.length; i++) {
    for (let j = i + 1; j < cur.length; j++) {
      const before = mod(prev[j] - prev[i], 12);
      const after = mod(cur[j] - cur[i], 12);
      const moved = cur[i] !== prev[i] || cur[j] !== prev[j];
      if (moved && before === after && (after === 7 || after === 0)) return false;
    }
  }
  return true;
}

function genVoices(ctx: KeyContext, s: QuestionSettings): Question | null {
  const candidates = Array.from({ length: VOICE_BEATS }, (_, b) => beatCandidates(ctx, s.voiceCount, b));
  if (candidates.some(c => c.length === 0)) return null;

  let budget = 20000;
  const path: number[][] = [];
  const search = (beat: number, prevMoves: number[] | null): boolean => {
    if (beat === VOICE_BEATS) return true;
    for (const chord of shuffle(candidates[beat])) {
      if (--budget < 0) return false;
      const prev = path[beat - 1];
      if (prev && !voiceTransitionOk(prev, chord, prevMoves)) continue;
      path.push(chord);
      const moves = prev ? chord.map((m, v) => m - prev[v]) : null;
      if (search(beat + 1, moves)) return true;
      path.pop();
    }
    return false;
  };
  return search(0, null) ? { kind: 'voices', beats: path } : null;
}

export function generateQuestion(ctx: KeyContext, s: QuestionSettings): Question | null {
  switch (s.kind) {
    case 'step': return genStep(ctx, s);
    case 'interval': return genInterval(ctx, s);
    case 'compare': return genCompare(ctx, s);
    case 'chord': return genChord(ctx, s);
    case 'melody': return genMelody(ctx, s);
    case 'voices': return genVoices(ctx, s);
  }
}

// ── 판정 ───────────────────────────────────────────

export interface AnswerInput {
  choice: string | null;
  notes: number[];
  events: MelodyEvent[];
  beats: number[][];
}

const pcSet = (notes: number[]) => [...new Set(notes.map(m => mod(m, 12)))].sort((a, b) => a - b).join(',');
const pcSeq = (notes: number[]) => notes.map(m => mod(m, 12)).join(',');

/** 음 이름(피치 클래스)만 맞으면 정답 */
export function judge(q: Question, input: AnswerInput): boolean {
  switch (q.kind) {
    case 'step':
    case 'compare':
    case 'chord-same':
      return input.choice === q.answer;
    case 'interval':
      return q.harmonic
        ? input.notes.length === 2 && pcSet(input.notes) === pcSet(q.notes)
        : pcSeq(input.notes) === pcSeq(q.notes);
    case 'chord':
      return input.choice === q.chord.type.id && pcSet(input.notes) === pcSet(q.chord.notes);
    case 'melody': {
      if (input.events.length !== q.events.length) return false;
      return q.events.every((e, i) => {
        const a = input.events[i];
        if ((e.midi === null) !== (a.midi === null)) return false;
        if (e.midi !== null && a.midi !== null && mod(e.midi, 12) !== mod(a.midi, 12)) return false;
        return !q.rhythm || e.beats === a.beats;
      });
    }
    case 'voices':
      return input.beats.length === q.beats.length
        && q.beats.every((b, i) => pcSet(b) === pcSet(input.beats[i]));
  }
}

/** 문제의 정답 음 (건반 표시용) */
export function answerNotes(q: Question): number[] {
  switch (q.kind) {
    case 'step':
    case 'interval': return q.notes;
    case 'compare': return [...q.a, ...q.b];
    case 'chord-same': return q.second.notes;
    case 'chord': return q.chord.notes;
    case 'melody': return q.events.flatMap(e => (e.midi === null ? [] : [e.midi]));
    case 'voices': return q.beats.flat();
  }
}
