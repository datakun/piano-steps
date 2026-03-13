import { useState, useMemo, useCallback } from 'react';
import { type ChordDegree, DEGREE_LABELS, degreesToPatterns, getDiatonicBassChords, autoFingering } from '../../data/exercises';
import type { StoredPattern } from './customPatternStorage';
import { generatePatternId } from './customPatternStorage';
import HanonGrandStaff from '../../components/notation/HanonGrandStaff';

const CHORD_TONE_DEGREES: ChordDegree[] = [1, 3, 5, 7];
const TENSION_DEGREES: ChordDegree[] = [9, 11, 13];
const UPPER_OCTAVE_DEGREES: ChordDegree[] = [8, 10, 12, 14];
const SLOT_COUNT = 8;

interface Props {
  onSave: (pattern: StoredPattern) => void;
  onCancel: () => void;
  editingPattern?: StoredPattern;
}

export default function PatternBuilder({ onSave, onCancel, editingPattern }: Props) {
  const [slots, setSlots] = useState<(ChordDegree | null)[]>(() =>
    editingPattern
      ? [...editingPattern.degrees]
      : Array(SLOT_COUNT).fill(null)
  );
  const [cursor, setCursor] = useState<number>(() =>
    editingPattern ? SLOT_COUNT : 0
  );
  const [name, setName] = useState(editingPattern?.name ?? '');

  const isFull = slots.every(s => s !== null);
  const canSave = isFull && name.trim().length > 0;

  // Add degree to next empty slot or replace selected slot
  const addDegree = useCallback((deg: ChordDegree) => {
    setSlots(prev => {
      const next = [...prev];
      if (cursor < SLOT_COUNT) {
        next[cursor] = deg;
      }
      return next;
    });
    setCursor(prev => {
      // Advance to next empty or past end
      const nextCursor = prev + 1;
      return Math.min(nextCursor, SLOT_COUNT);
    });
  }, [cursor]);

  // Tap a slot to select it for replacement
  const selectSlot = useCallback((idx: number) => {
    setCursor(idx);
  }, []);

  // Delete last filled slot
  const deleteLast = useCallback(() => {
    setSlots(prev => {
      const next = [...prev];
      // Find last filled
      let lastIdx = -1;
      for (let i = SLOT_COUNT - 1; i >= 0; i--) {
        if (next[i] !== null) { lastIdx = i; break; }
      }
      if (lastIdx >= 0) {
        next[lastIdx] = null;
        setCursor(lastIdx);
      }
      return next;
    });
  }, []);

  // Preview: treble arpeggio + bass chord (CM7 = first diatonic chord)
  const previewData = useMemo(() => {
    if (!isFull) return null;
    const degrees = slots as ChordDegree[];
    const patterns = degreesToPatterns(degrees);
    const bassChords = getDiatonicBassChords();
    const degreeLabels = degrees.map(d => DEGREE_LABELS[d]);
    const fingeringLabels = autoFingering(patterns[0]);
    return {
      trebleNotes: patterns[0],
      bassChord: bassChords[0],
      degreeLabels,
      fingeringLabels,
    };
  }, [slots, isFull]);

  const handleSave = () => {
    if (!canSave) return;
    const degrees = slots as ChordDegree[];
    onSave({
      id: editingPattern?.id ?? generatePatternId(),
      name: name.trim(),
      degrees,
      createdAt: editingPattern?.createdAt ?? Date.now(),
    });
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Action bar */}
      <div className="sticky top-0 z-30 bg-gray-50 px-4 md:px-6 pt-4 md:pt-6 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">
            {editingPattern ? 'Edit Pattern' : 'Create Pattern'}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                canSave
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {editingPattern ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          {/* Name input */}
          <div>
            <label className="text-sm text-gray-500 block mb-1">Pattern Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value.slice(0, 30))}
              placeholder="My Pattern"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* 8 Slots */}
          <div>
            <label className="text-sm text-gray-500 block mb-1">
              Degree Sequence ({slots.filter(s => s !== null).length}/{SLOT_COUNT})
            </label>
            <div className="flex gap-1.5">
              {slots.map((slot, i) => (
                <button
                  key={i}
                  onClick={() => selectSlot(i)}
                  className={`flex-1 h-10 rounded-lg text-sm font-medium border-2 transition-all ${
                    cursor === i
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : slot !== null
                        ? 'border-gray-300 bg-gray-50 text-gray-700'
                        : 'border-dashed border-gray-300 text-gray-300'
                  }`}
                >
                  {slot !== null ? DEGREE_LABELS[slot] : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Degree Palette */}
          <div>
            <label className="text-sm text-gray-500 block mb-1">Tap to add</label>
            {/* Row 1: Chord tones */}
            <div className="grid grid-cols-4 gap-2">
              {CHORD_TONE_DEGREES.map(deg => (
                <button
                  key={deg}
                  onClick={() => addDegree(deg)}
                  disabled={cursor >= SLOT_COUNT}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    cursor >= SLOT_COUNT
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-blue-50'
                  }`}
                >
                  {DEGREE_LABELS[deg]}
                </button>
              ))}
            </div>
            {/* Row 2: Tensions */}
            <div className="grid grid-cols-4 gap-2 mt-2">
              {TENSION_DEGREES.map(deg => (
                <button
                  key={deg}
                  onClick={() => addDegree(deg)}
                  disabled={cursor >= SLOT_COUNT}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    cursor >= SLOT_COUNT
                      ? 'border-amber-100 text-gray-300 cursor-not-allowed'
                      : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 active:bg-amber-200'
                  }`}
                >
                  {DEGREE_LABELS[deg]}
                </button>
              ))}
            </div>
            {/* Row 3: Upper octave chord tones */}
            <div className="grid grid-cols-4 gap-2 mt-2">
              {UPPER_OCTAVE_DEGREES.map(deg => (
                <button
                  key={deg}
                  onClick={() => addDegree(deg)}
                  disabled={cursor >= SLOT_COUNT}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    cursor >= SLOT_COUNT
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-blue-50'
                  }`}
                >
                  {DEGREE_LABELS[deg]}
                </button>
              ))}
            </div>
            <button
              onClick={deleteLast}
              className="mt-2 text-xs text-gray-500 hover:text-red-500 px-2 py-1 border border-gray-200 rounded-lg"
            >
              ← Delete Last
            </button>
          </div>

          {/* Preview */}
          {previewData && (
            <div>
              <label className="text-sm text-gray-500 block mb-1">Preview (CM7)</label>
              <HanonGrandStaff
                trebleNotes={previewData.trebleNotes}
                bassChord={previewData.bassChord}
                degreeLabels={previewData.degreeLabels}
                fingeringLabels={previewData.fingeringLabels}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
