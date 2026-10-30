import type { ReactNode } from 'react';
import type { NoteName } from '../../types/music';
import { getAllRoots, noteDisplay } from '../../lib/music/noteUtils';
import { CHORD_SETS, intervalName, type ChordSetId, type ExerciseKind } from './earTraining';
import { useEarTrainingStore } from './earTrainingStore';

const KINDS: { id: ExerciseKind; label: string }[] = [
  { id: 'step', label: '반음/온음' },
  { id: 'interval', label: '음정' },
  { id: 'compare', label: '음정 비교' },
  { id: 'chord', label: '화음' },
  { id: 'melody', label: '선율' },
  { id: 'voices', label: '2·3성부' },
];

const ALL_INTERVALS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface SegmentProps<T extends string | number> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

function Segment<T extends string | number>({ value, options, onChange }: SegmentProps<T>) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
      {options.map(o => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-sm ${
            o.value === value ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-gray-500 w-20 shrink-0">{label}</span>
      {children}
    </div>
  );
}

function IntervalPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const toggle = (s: number) => {
    const next = value.includes(s) ? value.filter(v => v !== s) : [...value, s].sort((a, b) => a - b);
    if (next.length > 0) onChange(next);
  };
  return (
    <div className="flex flex-wrap gap-1">
      {ALL_INTERVALS.map(s => (
        <button
          key={s}
          onClick={() => toggle(s)}
          className={`px-2 py-0.5 text-xs rounded border ${
            value.includes(s) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-400'
          }`}
        >
          {intervalName(s)}
        </button>
      ))}
    </div>
  );
}

export default function EarOptions() {
  const s = useEarTrainingStore();
  const update = s.updateSettings;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map(k => (
          <button
            key={k.id}
            onClick={() => s.setKind(k.id)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              s.kind === k.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <Row label="조">
        <select
          value={s.key}
          onChange={e => s.setKey(e.target.value as NoteName)}
          className="border border-gray-200 rounded-lg px-3 py-1 text-sm bg-white"
        >
          {getAllRoots().map(r => (
            <option key={r} value={r}>{noteDisplay(r)} 장조</option>
          ))}
        </select>
      </Row>

      {s.kind === 'step' && (
        <Row label="재생">
          <Segment
            value={s.stepPlay}
            options={[
              { value: 'seq', label: '차례로' },
              { value: 'harm', label: '동시에' },
              { value: 'mix', label: '섞기' },
            ]}
            onChange={v => update({ stepPlay: v })}
          />
        </Row>
      )}

      {s.kind === 'interval' && (
        <>
          <Row label="시작음">
            <Segment
              value={s.intervalStart}
              options={[{ value: 'any', label: '아무 음' }, { value: 'do', label: '도' }]}
              onChange={v => update({ intervalStart: v })}
            />
            <Segment
              value={s.intervalHarmonic ? 1 : 0}
              options={[{ value: 0, label: '선율' }, { value: 1, label: '화성' }]}
              onChange={v => update({ intervalHarmonic: v === 1 })}
            />
          </Row>
          <Row label="낼 음정">
            <IntervalPicker value={s.intervals} onChange={v => update({ intervals: v })} />
          </Row>
        </>
      )}

      {s.kind === 'compare' && (
        <>
          <Row label="시작음">
            <Segment
              value={s.compareStart}
              options={[{ value: 'same', label: '같음' }, { value: 'diff', label: '다름' }]}
              onChange={v => update({ compareStart: v })}
            />
          </Row>
          <Row label="낼 음정">
            <IntervalPicker value={s.compareIntervals} onChange={v => update({ compareIntervals: v })} />
          </Row>
        </>
      )}

      {s.kind === 'chord' && (
        <>
          <Row label="단계">
            <Segment
              value={s.chordStage}
              options={[{ value: 'same', label: '같은지 다른지' }, { value: 'identify', label: '종류·구성음' }]}
              onChange={v => update({ chordStage: v })}
            />
          </Row>
          <Row label="화음">
            <select
              value={s.chordSet}
              onChange={e => update({ chordSet: e.target.value as ChordSetId })}
              className="border border-gray-200 rounded-lg px-3 py-1 text-sm bg-white"
            >
              {CHORD_SETS.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            {s.chordStage === 'identify' && (
              <label className="flex items-center gap-1.5 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={s.chordInversions}
                  onChange={e => update({ chordInversions: e.target.checked })}
                />
                전위 포함
              </label>
            )}
          </Row>
        </>
      )}

      {s.kind === 'melody' && (
        <>
          <Row label="음 개수">
            <select
              value={s.melodyLength}
              onChange={e => update({ melodyLength: Number(e.target.value) })}
              className="border border-gray-200 rounded-lg px-3 py-1 text-sm bg-white"
            >
              {[2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n}음</option>
              ))}
            </select>
          </Row>
          <Row label="음 진행">
            <Segment
              value={s.melodyMotion}
              options={[
                { value: 1, label: '1 순차' },
                { value: 2, label: '2 3도까지' },
                { value: 3, label: '3 옥타브 이내' },
              ]}
              onChange={v => update({ melodyMotion: v })}
            />
          </Row>
          <Row label="리듬">
            <Segment
              value={s.melodyRhythm}
              options={[
                { value: 0, label: '없음' },
                { value: 1, label: '1' },
                { value: 2, label: '2' },
                { value: 3, label: '3' },
              ]}
              onChange={v => update({ melodyRhythm: v })}
            />
          </Row>
        </>
      )}

      {s.kind === 'voices' && (
        <Row label="성부">
          <Segment
            value={s.voiceCount}
            options={[{ value: 2, label: '2성' }, { value: 3, label: '3성' }]}
            onChange={v => update({ voiceCount: v })}
          />
        </Row>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
        <label className={`flex items-center gap-1.5 ${s.kind === 'chord' || s.kind === 'voices' ? 'opacity-40' : ''}`}>
          <input
            type="checkbox"
            checked={s.kind === 'voices' || (s.kind !== 'chord' && s.scaleOnly)}
            disabled={s.kind === 'chord' || s.kind === 'voices'}
            onChange={e => update({ scaleOnly: e.target.checked })}
          />
          음계 음만 출제
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={s.keySound} onChange={e => s.setKeySound(e.target.checked)} />
          건반 소리
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={s.showAnswer} onChange={e => s.setShowAnswer(e.target.checked)} />
          정답 보기
        </label>
      </div>
    </div>
  );
}
