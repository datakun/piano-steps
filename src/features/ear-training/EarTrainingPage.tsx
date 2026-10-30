import { useEffect, useMemo, useState } from 'react';
import { answerNotes, chordSetTypes, rhythmDurations } from './earTraining';
import { useEarTrainingStore } from './earTrainingStore';
import { playKey, playQuestion, playScale } from './earAudio';
import EarKeyboard from './EarKeyboard';
import EarOptions from './EarOptions';
import { AnswerDetail, AnswerInputPanel } from './EarAnswer';

/** Musical Typing 배치: 키 → 기준 C에서의 반음 */
const TYPING_KEYS: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14,
};

const COLOR_INPUT = '#93c5fd';
const COLOR_CORRECT = '#3b82f6';
const COLOR_WRONG = '#ef4444';
const COLOR_ANSWER = '#fcd34d';

function newAndPlay() {
  const q = useEarTrainingStore.getState().newQuestion();
  if (q) void playQuestion(q);
}

function replay() {
  const q = useEarTrainingStore.getState().question;
  if (q) void playQuestion(q);
}

function press(midi: number) {
  const s = useEarTrainingStore.getState();
  if (s.keySound) void playKey(midi);
  s.pressKey(midi);
}

function enter() {
  const s = useEarTrainingStore.getState();
  if (!s.question || s.result) return newAndPlay();
  if (s.question.kind === 'voices') return s.nextBeat();
  s.submit();
}

function numberKey(n: number) {
  const s = useEarTrainingStore.getState();
  const q = s.question;
  if (!q) return;
  const choices: Record<string, string[]> = {
    step: ['half', 'whole'],
    compare: ['A', 'B', 'same'],
    'chord-same': ['same', 'diff'],
  };
  if (choices[q.kind]) {
    const c = choices[q.kind][n - 1];
    if (c) s.choose(c);
  } else if (q.kind === 'chord') {
    const t = chordSetTypes(s.chordSet)[n === 0 ? 9 : n - 1];
    if (t) s.choose(t.id);
  } else if (q.kind === 'melody' && q.rhythm) {
    const d = rhythmDurations(s.melodyRhythm)[n - 1];
    if (d) {
      if (d.rest) s.addRest(d.beats);
      else s.setDuration(d.beats);
    }
  }
}

export default function EarTrainingPage() {
  const { ctx, question, noQuestion, input, result, showAnswer } = useEarTrainingStore();
  /** Z / X 로 옮긴 옥타브 수. 기준은 으뜸음이 있는 옥타브의 C */
  const [octaveShift, setOctaveShift] = useState(0);
  const typingBase = Math.min(72, Math.max(48, Math.floor(ctx.tonic / 12) * 12 + octaveShift * 12));

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const key = e.key.toLowerCase();

      if (key === ' ') replay();
      else if (key === 'enter') enter();
      else if (key === 'backspace') useEarTrainingStore.getState().backspace();
      else if (key === 'q') void playScale(useEarTrainingStore.getState().ctx);
      else if (key === 'z') { if (typingBase > 48) setOctaveShift(o => o - 1); }
      else if (key === 'x') { if (typingBase < 72) setOctaveShift(o => o + 1); }
      else if (/^[0-9]$/.test(key)) numberKey(Number(key));
      else if (key in TYPING_KEYS) {
        const midi = typingBase + TYPING_KEYS[key];
        if (midi >= 48 && midi <= 84) press(midi);
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [typingBase]);

  const colors = useMemo(() => {
    const map = new Map<number, string>();
    if (!question) return map;
    const entered = question.kind === 'melody'
      ? input.events.flatMap(e => (e.midi === null ? [] : [e.midi]))
      : [...input.beats.flat(), ...input.notes];
    const answer = answerNotes(question);
    const answerPcs = new Set(answer.map(m => m % 12));

    if (result || showAnswer) {
      for (const m of answer) map.set(m, COLOR_ANSWER);
    }
    for (const m of entered) {
      if (!result) map.set(m, COLOR_INPUT);
      else map.set(m, answerPcs.has(m % 12) ? COLOR_CORRECT : COLOR_WRONG);
    }
    return map;
  }, [question, input, result, showAnswer]);

  const needsSubmit = question && !result
    && (question.kind === 'interval' || question.kind === 'chord' || question.kind === 'melody');

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <h1 className="text-lg font-bold">청음 연습</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <EarOptions />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={newAndPlay} className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white">
          {question ? '다음 문제' : '새 문제'}
        </button>
        <button
          onClick={replay}
          disabled={!question}
          className="px-3 py-2 rounded-lg text-sm border border-gray-200 bg-white disabled:opacity-40"
        >
          다시 듣기 <span className="text-xs text-gray-400">Space</span>
        </button>
        <button
          onClick={() => void playScale(ctx)}
          className="px-3 py-2 rounded-lg text-sm border border-gray-200 bg-white"
        >
          음계 듣기 <span className="text-xs text-gray-400">Q</span>
        </button>
        {needsSubmit && (
          <>
            <button
              onClick={() => useEarTrainingStore.getState().backspace()}
              className="px-3 py-2 rounded-lg text-sm border border-gray-200 bg-white"
            >
              지우기
            </button>
            <button
              onClick={() => useEarTrainingStore.getState().submit()}
              className="px-3 py-2 rounded-lg text-sm border border-blue-300 bg-blue-50 text-blue-700"
            >
              제출 <span className="text-xs text-blue-400">Enter</span>
            </button>
          </>
        )}
        {question?.kind === 'voices' && !result && (
          <button
            onClick={() => useEarTrainingStore.getState().nextBeat()}
            className="px-3 py-2 rounded-lg text-sm border border-blue-300 bg-blue-50 text-blue-700"
          >
            다음 박 <span className="text-xs text-blue-400">Enter</span>
          </button>
        )}
      </div>

      {noQuestion && (
        <div className="text-sm text-red-600">현재 옵션 조합으로 낼 수 있는 문제가 없습니다. 옵션을 바꿔 주세요.</div>
      )}

      {question && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <AnswerInputPanel />
          {result && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                result === 'correct'
                  ? 'bg-blue-50 border-blue-300 text-blue-800'
                  : 'bg-red-50 border-red-300 text-red-800'
              }`}
            >
              <div className="font-bold mb-1">{result === 'correct' ? '정답' : '오답'}</div>
              <AnswerDetail question={question} ctx={ctx} />
            </div>
          )}
          {!result && showAnswer && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AnswerDetail question={question} ctx={ctx} />
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-2">
        <EarKeyboard tonic={ctx.tonic} colors={colors} onPress={press} />
      </div>

      <p className="text-xs text-gray-400">
        키보드: A S D F G H J K = 흰건반, W E T Y U = 검은건반, Z / X = 옥타브 이동
        (현재 A = C{typingBase / 12 - 1}). Enter = 제출·다음 문제, Backspace = 지우기, 숫자 = 보기 선택.
      </p>
    </div>
  );
}
