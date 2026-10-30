import { create } from 'zustand';
import type { NoteName } from '../../types/music';
import {
  generateQuestion,
  judge,
  keyContext,
  type AnswerInput,
  type ChordSetId,
  type ExerciseKind,
  type KeyContext,
  type MelodyEvent,
  type Question,
  type QuestionSettings,
} from './earTraining';

/** 2·3성부 박 수 */
export const VOICE_BEAT_COUNT = 6;

const EMPTY_INPUT: AnswerInput = { choice: null, notes: [], events: [], beats: [] };

interface EarTrainingState extends QuestionSettings {
  key: NoteName;
  ctx: KeyContext;
  keySound: boolean;
  showAnswer: boolean;

  question: Question | null;
  /** 조건에 맞는 문제가 없을 때 true */
  noQuestion: boolean;
  input: AnswerInput;
  /** 선율 리듬 입력에서 선택된 음표 길이(박) */
  duration: number;
  result: 'correct' | 'wrong' | null;

  setKey: (key: NoteName) => void;
  setKind: (kind: ExerciseKind) => void;
  updateSettings: (patch: Partial<QuestionSettings>) => void;
  setKeySound: (on: boolean) => void;
  setShowAnswer: (on: boolean) => void;
  setDuration: (beats: number) => void;

  newQuestion: () => Question | null;
  pressKey: (midi: number) => void;
  addRest: (beats: number) => void;
  choose: (choice: string) => void;
  nextBeat: () => void;
  backspace: () => void;
  submit: () => void;
}

export const useEarTrainingStore = create<EarTrainingState>((set, get) => ({
  key: 'C',
  ctx: keyContext('C'),
  kind: 'step',
  scaleOnly: false,
  keySound: true,
  showAnswer: false,

  stepPlay: 'seq',
  intervalStart: 'do',
  intervalHarmonic: false,
  intervals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  compareStart: 'same',
  compareIntervals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  chordStage: 'same',
  chordSet: 'triad2' as ChordSetId,
  chordInversions: false,
  melodyLength: 4,
  melodyMotion: 1,
  melodyRhythm: 0,
  voiceCount: 2,

  question: null,
  noQuestion: false,
  input: EMPTY_INPUT,
  duration: 1,
  result: null,

  setKey: (key) => set({ key, ctx: keyContext(key), question: null, input: EMPTY_INPUT, result: null }),
  setKind: (kind) => set({ kind, question: null, noQuestion: false, input: EMPTY_INPUT, result: null }),
  updateSettings: (patch) => set({ ...patch, question: null, noQuestion: false, input: EMPTY_INPUT, result: null }),
  setKeySound: (keySound) => set({ keySound }),
  setShowAnswer: (showAnswer) => set({ showAnswer }),
  setDuration: (duration) => set({ duration }),

  newQuestion: () => {
    const state = get();
    // 화음 종목에는 "음계 음만 출제"를 적용하지 않는다
    const settings: QuestionSettings = state.kind === 'chord' ? { ...state, scaleOnly: false } : state;
    const question = generateQuestion(state.ctx, settings);
    set({
      question,
      noQuestion: question === null,
      input: EMPTY_INPUT,
      result: null,
      showAnswer: false,
      duration: 1,
    });
    return question;
  },

  pressKey: (midi) => {
    const { question, input, result, duration } = get();
    if (!question || result) return;
    switch (question.kind) {
      case 'interval':
        if (input.notes.length < 2) set({ input: { ...input, notes: [...input.notes, midi] } });
        break;
      case 'chord':
      case 'voices': {
        const notes = input.notes.includes(midi)
          ? input.notes.filter(n => n !== midi)
          : [...input.notes, midi];
        set({ input: { ...input, notes } });
        break;
      }
      case 'melody': {
        const event: MelodyEvent = { midi, beats: question.rhythm ? duration : 1 };
        const noteCount = input.events.filter(e => e.midi !== null).length;
        const target = question.events.filter(e => e.midi !== null).length;
        if (noteCount < target) set({ input: { ...input, events: [...input.events, event] } });
        break;
      }
    }
  },

  addRest: (beats) => {
    const { question, input, result } = get();
    if (question?.kind !== 'melody' || result) return;
    set({ input: { ...input, events: [...input.events, { midi: null, beats }] } });
  },

  choose: (choice) => {
    const { question, input, result } = get();
    if (!question || result) return;
    set({ input: { ...input, choice } });
    // 버튼으로만 답하는 종목은 고르면 바로 판정
    if (question.kind === 'step' || question.kind === 'compare' || question.kind === 'chord-same') {
      get().submit();
    }
  },

  nextBeat: () => {
    const { question, input, result } = get();
    if (question?.kind !== 'voices' || result || input.notes.length === 0) return;
    const beats = [...input.beats, [...input.notes].sort((a, b) => a - b)];
    set({ input: { ...input, beats, notes: [] } });
    if (beats.length === VOICE_BEAT_COUNT) get().submit();
  },

  backspace: () => {
    const { question, input, result } = get();
    if (!question || result) return;
    if (question.kind === 'melody') {
      set({ input: { ...input, events: input.events.slice(0, -1) } });
    } else if (question.kind === 'voices' && input.notes.length === 0) {
      const last = input.beats[input.beats.length - 1];
      if (last) set({ input: { ...input, beats: input.beats.slice(0, -1), notes: last } });
    } else {
      set({ input: { ...input, notes: input.notes.slice(0, -1) } });
    }
  },

  submit: () => {
    const { question, input, result } = get();
    if (!question || result) return;
    set({ result: judge(question, input) ? 'correct' : 'wrong' });
  },
}));
