import { useMemo } from 'react';
import { useHummingStore } from './hummingStore';
import { usePianoRollPlayback } from './usePianoRollPlayback';
import PianoRollTransport from './PianoRollTransport';
import PianoRollCanvas, { ROW_HEIGHT, RULER_HEIGHT } from './PianoRollCanvas';
import VerticalPianoKeyboard, { KEYBOARD_WIDTH } from './VerticalPianoKeyboard';
import type { MelodyNote } from '../../lib/audio/melodyExtractor';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PITCH_PADDING = 3; // extra semitones above/below note range

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computePitchRange(notes: MelodyNote[]) {
  if (notes.length === 0) return { minMidi: 57, maxMidi: 72 }; // A3–C5 default
  let min = 127;
  let max = 0;
  for (const n of notes) {
    if (n.pitchMidi < min) min = n.pitchMidi;
    if (n.pitchMidi > max) max = n.pitchMidi;
  }
  return {
    minMidi: min - PITCH_PADDING,
    maxMidi: max + PITCH_PADDING,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PianoRollPreviewProps {
  notes: MelodyNote[];
  bpm: number;
}

export default function PianoRollPreview({ notes, bpm }: PianoRollPreviewProps) {
  const audioBlob = useHummingStore((s) => s.audioBlob);

  const {
    playbackState,
    play,
    pause,
    stop,
    seekTo,
    setAudioEnabled,
    setMidiEnabled,
  } = usePianoRollPlayback(notes, bpm, audioBlob);

  const { minMidi, maxMidi } = useMemo(() => computePitchRange(notes), [notes]);

  const totalRows = maxMidi - minMidi + 1;
  const rollHeight = totalRows * ROW_HEIGHT + RULER_HEIGHT;

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Transport */}
      <div className="px-3 border-b border-gray-100">
        <PianoRollTransport
          status={playbackState.status}
          currentTime={playbackState.currentTime}
          totalDuration={playbackState.totalDuration}
          audioEnabled={playbackState.audioEnabled}
          midiEnabled={playbackState.midiEnabled}
          onPlay={play}
          onPause={pause}
          onStop={stop}
          onToggleAudio={() => setAudioEnabled(!playbackState.audioEnabled)}
          onToggleMidi={() => setMidiEnabled(!playbackState.midiEnabled)}
        />
      </div>

      {/* Piano Roll area */}
      <div
        className="flex overflow-hidden"
        style={{ height: Math.min(rollHeight, 300) }}
      >
        {/* Vertical keyboard (fixed left) */}
        <div
          className="shrink-0 border-r border-gray-200 overflow-hidden"
          style={{ width: KEYBOARD_WIDTH, paddingTop: RULER_HEIGHT }}
        >
          <VerticalPianoKeyboard
            minMidi={minMidi}
            maxMidi={maxMidi}
            rowHeight={ROW_HEIGHT}
            activeNotes={playbackState.activeNotes}
          />
        </div>

        {/* Canvas scroll area */}
        <div className="flex-1 overflow-hidden">
          <PianoRollCanvas
            notes={notes}
            minMidi={minMidi}
            maxMidi={maxMidi}
            bpm={bpm}
            currentTime={playbackState.currentTime}
            isPlaying={playbackState.status === 'playing'}
            onSeek={seekTo}
          />
        </div>
      </div>
    </div>
  );
}
