import * as Tone from 'tone';
import { getPianoSampler, midiToNoteName } from '../../lib/audio/pianoSampler';
import { MAJOR_STEPS, type KeyContext, type Question } from './earTraining';

/** 청음 연습 소리 재생. 공용 피아노 샘플러를 쓴다. */

interface SoundEvent {
  midis: number[];
  /** 시작 시각(초) */
  at: number;
  /** 길이(초) */
  dur: number;
}

/** 리듬이 있는 선율의 4분음표 길이(초) */
const BEAT_SEC = 0.6;

async function playEvents(events: SoundEvent[]) {
  await Tone.start();
  const sampler = await getPianoSampler();
  sampler.releaseAll();
  const now = Tone.now() + 0.05;
  for (const e of events) {
    sampler.triggerAttackRelease(e.midis.map(midiToNoteName), e.dur, now + e.at, 0.7);
  }
}

function twoNotes(notes: [number, number], harmonic: boolean, offset = 0): SoundEvent[] {
  return harmonic
    ? [{ midis: notes, at: offset, dur: 1.5 }]
    : [
        { midis: [notes[0]], at: offset, dur: 0.75 },
        { midis: [notes[1]], at: offset + 0.8, dur: 0.9 },
      ];
}

function questionEvents(q: Question): SoundEvent[] {
  switch (q.kind) {
    case 'step':
    case 'interval':
      return twoNotes(q.notes, q.harmonic);
    case 'compare':
      return [...twoNotes(q.a, false), ...twoNotes(q.b, false, 2.4)];
    case 'chord':
      return [{ midis: q.chord.notes, at: 0, dur: 2 }];
    case 'chord-same':
      return [
        { midis: q.first.notes, at: 0, dur: 1.6 },
        { midis: q.second.notes, at: 2, dur: 1.8 },
      ];
    case 'melody': {
      const events: SoundEvent[] = [];
      let t = 0;
      for (const e of q.events) {
        const len = q.rhythm ? e.beats * BEAT_SEC : 0.7;
        if (e.midi !== null) events.push({ midis: [e.midi], at: t, dur: len * 0.95 });
        t += len;
      }
      return events;
    }
    case 'voices':
      return q.beats.map((beat, i) => ({ midis: beat, at: i * 1.0, dur: 0.95 }));
  }
}

export function playQuestion(q: Question) {
  return playEvents(questionEvents(q));
}

/** 1~8도 음계 */
export function playScale(ctx: KeyContext) {
  const degrees = [...MAJOR_STEPS, 12];
  return playEvents(degrees.map((d, i) => ({ midis: [ctx.tonic + d], at: i * 0.4, dur: 0.45 })));
}

/** 건반을 누를 때 한 음 */
export async function playKey(midi: number) {
  await Tone.start();
  const sampler = await getPianoSampler();
  sampler.triggerAttackRelease(midiToNoteName(midi), 0.6, Tone.now(), 0.7);
}
