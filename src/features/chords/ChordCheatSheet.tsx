import { useMemo } from 'react';
import { ALL_ROOTS, ALL_QUALITIES, QUALITY_DISPLAY } from '../../data/chords';
import { useChordStore } from './chordStore';
import ChordCard from './ChordCard';
import type { NoteName, ChordQuality } from '../../types/music';

export default function ChordCheatSheet() {
  const {
    selectedRoot, selectedQuality, searchQuery, voicingMode,
    setRoot, setQuality, setSearchQuery, toggleVoicingMode,
  } = useChordStore();

  const filteredChords = useMemo(() => {
    const results: { root: NoteName; quality: ChordQuality }[] = [];
    const query = searchQuery.toLowerCase().trim();

    for (const root of ALL_ROOTS) {
      if (selectedRoot && root !== selectedRoot) continue;

      for (const quality of ALL_QUALITIES) {
        if (selectedQuality && quality !== selectedQuality) continue;

        if (query) {
          const symbol = `${root}${QUALITY_DISPLAY[quality]}`.toLowerCase();
          if (!symbol.includes(query) && !root.toLowerCase().includes(query)) continue;
        }

        results.push({ root, quality });
      }
    }
    return results;
  }, [selectedRoot, selectedQuality, searchQuery]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold">Chord Cheat Sheet</h1>
        <button
          onClick={toggleVoicingMode}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            voicingMode === 'drop2'
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-gray-200 text-gray-600'
          }`}
        >
          {voicingMode === 'drop2' ? 'Voicing: Drop 2' : 'Voicing: Basic'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search chords..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-40"
        />

        <select
          value={selectedRoot ?? ''}
          onChange={e => setRoot((e.target.value || null) as NoteName | null)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All Keys</option>
          {ALL_ROOTS.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <select
          value={selectedQuality ?? ''}
          onChange={e => setQuality((e.target.value || null) as ChordQuality | null)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All Types</option>
          {ALL_QUALITIES.map(q => (
            <option key={q} value={q}>{QUALITY_DISPLAY[q]}</option>
          ))}
        </select>

        {(selectedRoot || selectedQuality || searchQuery) && (
          <button
            onClick={() => { setRoot(null); setQuality(null); setSearchQuery(''); }}
            className="text-sm text-gray-500 hover:text-gray-700 px-2"
          >
            Clear
          </button>
        )}
      </div>

      <div className="text-xs text-gray-400 mb-3">{filteredChords.length} chords</div>

      {/* Chord grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredChords.map(({ root, quality }) => (
          <ChordCard
            key={`${root}-${quality}`}
            root={root}
            quality={quality}
            voicingMode={voicingMode}
          />
        ))}
      </div>
    </div>
  );
}
