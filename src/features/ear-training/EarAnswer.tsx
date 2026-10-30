import { useMemo } from 'react';
import {
  DURATIONS,
  chordSetTypes,
  chordSymbol,
  intervalName,
  noteLabel,
  rhythmDurations,
  spell,
  type AnswerInput,
  type KeyContext,
  type MelodyEvent,
  type Question,
  type VoicedChord,
} from './earTraining';
import { VOICE_BEAT_COUNT, useEarTrainingStore } from './earTrainingStore';
import EarStaff, { type StaffItem } from './EarStaff';

function durationLabel(e: MelodyEvent): string {
  return DURATIONS.find(d => d.beats === e.beats && d.rest === (e.midi === null))?.label ?? `${e.beats}박`;
}

function ChoiceButton({ label, hotkey, active, onClick }: {
  label: string; hotkey?: string; active?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm border ${
        active ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
      }`}
    >
      {hotkey && <span className="text-xs text-gray-400 mr-1">{hotkey}</span>}
      {label}
    </button>
  );
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-sm text-gray-400">건반으로 입력</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t, i) => (
        <span key={i} className="px-2 py-0.5 rounded bg-gray-100 text-sm text-gray-700">{t}</span>
      ))}
    </div>
  );
}

/** 종목별 답 입력 영역 */
export function AnswerInputPanel() {
  const { question, input, ctx, duration, melodyRhythm, chordSet, choose, setDuration, addRest } =
    useEarTrainingStore();
  const inputItems = useMemo(() => (question ? inputStaffItems(question, input) : []), [question, input]);
  if (!question) return null;
  const name = (m: number) => spell(ctx, m).pcName;
  const staff = <EarStaff ctx={ctx} items={inputItems} />;

  switch (question.kind) {
    case 'step':
      return (
        <div className="flex gap-2">
          <ChoiceButton hotkey="1" label="반음" active={input.choice === 'half'} onClick={() => choose('half')} />
          <ChoiceButton hotkey="2" label="온음" active={input.choice === 'whole'} onClick={() => choose('whole')} />
        </div>
      );
    case 'compare':
      return (
        <div className="flex gap-2">
          <ChoiceButton hotkey="1" label="A가 넓음" active={input.choice === 'A'} onClick={() => choose('A')} />
          <ChoiceButton hotkey="2" label="B가 넓음" active={input.choice === 'B'} onClick={() => choose('B')} />
          <ChoiceButton hotkey="3" label="같음" active={input.choice === 'same'} onClick={() => choose('same')} />
        </div>
      );
    case 'chord-same':
      return (
        <div className="flex gap-2">
          <ChoiceButton hotkey="1" label="같음" active={input.choice === 'same'} onClick={() => choose('same')} />
          <ChoiceButton hotkey="2" label="다름" active={input.choice === 'diff'} onClick={() => choose('diff')} />
        </div>
      );
    case 'interval':
      return (
        <div className="space-y-2">
          {staff}
          <Chips items={input.notes.map(name)} />
        </div>
      );
    case 'chord':
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {chordSetTypes(chordSet).map((t, i) => (
              <ChoiceButton
                key={t.id}
                hotkey={i < 10 ? String((i + 1) % 10) : undefined}
                label={t.label}
                active={input.choice === t.id}
                onClick={() => choose(t.id)}
              />
            ))}
          </div>
          {staff}
          <Chips items={[...input.notes].sort((a, b) => a - b).map(name)} />
        </div>
      );
    case 'melody': {
      const durations = rhythmDurations(melodyRhythm);
      return (
        <div className="space-y-2">
          {question.rhythm && (
            <div className="flex flex-wrap gap-1.5">
              {durations.map((d, i) => (
                <ChoiceButton
                  key={d.id}
                  hotkey={String(i + 1)}
                  label={d.label}
                  active={!d.rest && duration === d.beats}
                  onClick={() => (d.rest ? addRest(d.beats) : setDuration(d.beats))}
                />
              ))}
            </div>
          )}
          {staff}
          <Chips
            items={input.events.map(e =>
              question.rhythm
                ? `${e.midi === null ? '쉼표' : name(e.midi)} ${durationLabel(e)}`
                : name(e.midi!),
            )}
          />
        </div>
      );
    }
    case 'voices':
      return (
        <div className="space-y-1 text-sm">
          <div className="text-gray-500">
            {input.beats.length + 1} / {VOICE_BEAT_COUNT} 박: 음을 누르고 Enter
          </div>
          {staff}
          <Chips items={[...input.notes].sort((a, b) => a - b).map(name)} />
          {input.beats.length > 0 && (
            <div className="text-gray-400">
              입력한 박: {input.beats.map(b => b.map(name).join('·')).join(' | ')}
            </div>
          )}
        </div>
      );
  }
}

function chordLine(ctx: KeyContext, c: VoicedChord): string {
  return `${chordSymbol(ctx, c)}: ${c.notes.map(m => noteLabel(ctx, m)).join(', ')}`;
}

const BEATS_TO_VEX: Record<number, { duration: string; dotted?: boolean }> = {
  4: { duration: 'w' },
  3: { duration: 'h', dotted: true },
  2: { duration: 'h' },
  1.5: { duration: 'q', dotted: true },
  1: { duration: 'q' },
  0.5: { duration: '8' },
};

/** 입력 중인 답을 악보로 옮긴 음표 목록 */
function inputStaffItems(q: Question, input: AnswerInput): StaffItem[] {
  switch (q.kind) {
    case 'interval':
      return q.harmonic
        ? (input.notes.length > 0 ? [{ midis: input.notes, duration: 'h' }] : [])
        : input.notes.map(m => ({ midis: [m], duration: 'q' }));
    case 'chord':
      return input.notes.length > 0 ? [{ midis: input.notes, duration: 'w' }] : [];
    case 'melody':
      return input.events.map(e => ({
        midis: e.midi === null ? [] : [e.midi],
        ...(q.rhythm ? BEATS_TO_VEX[e.beats] : { duration: 'q' }),
      }));
    case 'voices':
      return [...input.beats, ...(input.notes.length > 0 ? [input.notes] : [])]
        .map(beat => ({ midis: beat, duration: 'q' }));
    default:
      return [];
  }
}

/** 정답을 악보로 옮긴 음표 목록 */
function staffItems(q: Question): StaffItem[] {
  const twoNotes = (notes: [number, number], harmonic: boolean, label?: string): StaffItem[] =>
    harmonic
      ? [{ midis: notes, duration: 'h', label }]
      : [{ midis: [notes[0]], duration: 'q', label }, { midis: [notes[1]], duration: 'q' }];

  switch (q.kind) {
    case 'step':
    case 'interval':
      return twoNotes(q.notes, q.harmonic);
    case 'compare':
      return [...twoNotes(q.a, false, 'A'), ...twoNotes(q.b, false, 'B')];
    case 'chord':
      return [{ midis: q.chord.notes, duration: 'w' }];
    case 'chord-same':
      return [{ midis: q.first.notes, duration: 'h' }, { midis: q.second.notes, duration: 'h' }];
    case 'melody':
      return q.events.map(e => ({
        midis: e.midi === null ? [] : [e.midi],
        ...(q.rhythm ? BEATS_TO_VEX[e.beats] : { duration: 'q' }),
      }));
    case 'voices':
      return q.beats.map(beat => ({ midis: beat, duration: 'q' }));
  }
}

/** 정답 내용: 악보 + 글자 */
export function AnswerDetail({ question, ctx }: { question: Question; ctx: KeyContext }) {
  const items = useMemo(() => staffItems(question), [question]);
  return (
    <div className="space-y-2">
      <EarStaff ctx={ctx} items={items} />
      <AnswerText question={question} ctx={ctx} />
    </div>
  );
}

function AnswerText({ question, ctx }: { question: Question; ctx: KeyContext }) {
  const labels = (notes: number[]) => notes.map(m => noteLabel(ctx, m)).join(' → ');

  switch (question.kind) {
    case 'step':
      return (
        <div>
          <div className="font-medium">{question.answer === 'half' ? '반음(단2도)' : '온음(장2도)'}</div>
          <div>{labels(question.notes)}</div>
        </div>
      );
    case 'interval': {
      const diff = question.notes[1] - question.notes[0];
      const dir = question.harmonic ? '화성' : diff > 0 ? '상행' : '하행';
      return (
        <div>
          <div className="font-medium">{intervalName(diff)} ({dir})</div>
          <div>{labels(question.notes)}</div>
        </div>
      );
    }
    case 'compare': {
      const answer = { A: 'A가 넓음', B: 'B가 넓음', same: '같음' }[question.answer];
      return (
        <div>
          <div className="font-medium">{answer}</div>
          <div>A: {intervalName(question.a[1] - question.a[0])}, {labels(question.a)}</div>
          <div>B: {intervalName(question.b[1] - question.b[0])}, {labels(question.b)}</div>
        </div>
      );
    }
    case 'chord-same':
      return (
        <div>
          <div className="font-medium">{question.answer === 'same' ? '같음' : '다름'}</div>
          <div>첫째 {chordLine(ctx, question.first)}</div>
          <div>둘째 {chordLine(ctx, question.second)}</div>
        </div>
      );
    case 'chord':
      return <div className="font-medium">{chordLine(ctx, question.chord)}</div>;
    case 'melody':
      return (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {question.events.map((e, i) => (
            <span key={i}>
              {e.midi === null ? '쉼표' : noteLabel(ctx, e.midi)}
              {question.rhythm && <span className="text-gray-500"> {durationLabel(e)}</span>}
            </span>
          ))}
        </div>
      );
    case 'voices':
      return (
        <div className="flex flex-wrap gap-3">
          {question.beats.map((beat, i) => (
            <div key={i} className="flex flex-col">
              <span className="text-xs text-gray-400">{i + 1}박</span>
              {[...beat].reverse().map((m, v) => (
                <span key={v}>{noteLabel(ctx, m)}</span>
              ))}
            </div>
          ))}
        </div>
      );
  }
}
