import { useRef, useEffect } from 'react';
import {
  Renderer, Stave, StaveNote, Voice, Formatter,
  Accidental, StaveConnector,
} from 'vexflow';
import type { Pitch, NoteName } from '../../types/music';
import { respellForKey } from '../../lib/music/noteUtils';

export interface GrandStaffChord {
  treble: Pitch[];   // Right hand notes
  bass: Pitch[];     // Left hand notes
  duration?: string; // VexFlow duration, default 'w'
}

interface GrandStaffProps {
  chords?: GrandStaffChord[];      // Single measure (backward compat)
  measures?: GrandStaffChord[][];  // Multi-measure mode
  keySignature?: string;           // VexFlow key sig string (e.g., 'Bb', 'G')
  measureLabels?: string[][];      // Chord labels per measure (e.g., [['Dm7','G7'],['CM7']])
  onLabelClick?: (measureIdx: number, chordIdx: number) => void;
  width?: number;
  height?: number;
  staveWidth?: number;
  activeChordIndex?: number;       // Single-measure highlighting (backward compat)
  activeMeasureIdx?: number;       // Multi-measure: highlight all chords in this measure
}

function pitchToVexKey(p: Pitch): string {
  return `${p.name.charAt(0)}${p.name.slice(1)}/${p.octave}`;
}

function addAccidentals(note: StaveNote, pitches: Pitch[]) {
  pitches.forEach((p, idx) => {
    const acc = p.name.slice(1);
    if (acc === '#' || acc === 'b') {
      note.addModifier(new Accidental(acc), idx);
    }
  });
}

export default function GrandStaff({
  chords,
  measures,
  keySignature,
  measureLabels,
  onLabelClick,
  width,
  height = 240,
  staveWidth = 280,
  activeChordIndex,
  activeMeasureIdx,
}: GrandStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const allMeasures = measures ?? (chords ? [chords] : []);
    if (!containerRef.current || allMeasures.length === 0) return;
    containerRef.current.innerHTML = '';

    const numMeasures = allMeasures.length;
    const useKeySig = !!keySignature;

    // Calculate per-measure widths
    let measureWidths: number[];
    if (numMeasures === 1) {
      measureWidths = [staveWidth];
    } else {
      // First measure gets 55% (clef + key sig take space)
      const firstW = Math.round(staveWidth * 0.55);
      const otherW = Math.round((staveWidth - firstW) / (numMeasures - 1));
      measureWidths = [firstW, ...Array(numMeasures - 1).fill(otherW)];
    }

    const startX = 10;
    const totalWidth = width ?? (startX + staveWidth + 10);
    const trebleY = 10;
    const bassY = 110;

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    renderer.resize(totalWidth, height);
    const context = renderer.getContext();

    let currentX = startX;
    let globalChordIdx = 0;

    const trebleStaves: Stave[] = [];
    const bassStaves: Stave[] = [];

    for (let m = 0; m < numMeasures; m++) {
      const mChords = allMeasures[m];
      const mWidth = measureWidths[m];

      const trebleStave = new Stave(currentX, trebleY, mWidth);
      const bassStave = new Stave(currentX, bassY, mWidth);

      if (m === 0) {
        trebleStave.addClef('treble');
        bassStave.addClef('bass');
        if (useKeySig) {
          trebleStave.addKeySignature(keySignature!);
          bassStave.addKeySignature(keySignature!);
        }
      }

      trebleStave.setContext(context).draw();
      bassStave.setContext(context).draw();

      trebleStaves.push(trebleStave);
      bassStaves.push(bassStave);

      // Build notes for this measure
      const trebleNotes: StaveNote[] = [];
      const bassNotes: StaveNote[] = [];

      for (const chord of mChords) {
        const treblePitches = useKeySig
          ? chord.treble.map(p => respellForKey(p, keySignature! as NoteName))
          : chord.treble;
        const bassPitches = useKeySig
          ? chord.bass.map(p => respellForKey(p, keySignature! as NoteName))
          : chord.bass;

        // Treble note
        const tKeys = treblePitches.length > 0 ? treblePitches.map(pitchToVexKey) : ['B/4'];
        const tDur = treblePitches.length > 0 ? (chord.duration ?? 'w') : 'wr';
        const tNote = new StaveNote({ keys: tKeys, duration: tDur, clef: 'treble' });

        if (!useKeySig && treblePitches.length > 0) {
          addAccidentals(tNote, treblePitches);
        }

        const isHighlighted = activeChordIndex === globalChordIdx || activeMeasureIdx === m;
        if (isHighlighted) {
          tNote.setStyle({ fillStyle: '#3b82f6', strokeStyle: '#3b82f6' });
        }
        trebleNotes.push(tNote);

        // Bass note
        const bKeys = bassPitches.length > 0 ? bassPitches.map(pitchToVexKey) : ['D/3'];
        const bDur = bassPitches.length > 0 ? (chord.duration ?? 'w') : 'wr';
        const bNote = new StaveNote({ keys: bKeys, duration: bDur, clef: 'bass' });

        if (!useKeySig && bassPitches.length > 0) {
          addAccidentals(bNote, bassPitches);
        }
        if (isHighlighted) {
          bNote.setStyle({ fillStyle: '#3b82f6', strokeStyle: '#3b82f6' });
        }
        bassNotes.push(bNote);

        globalChordIdx++;
      }

      // Create voices, apply accidentals, format, draw
      if (trebleNotes.length > 0) {
        const trebleVoice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false);
        trebleVoice.addTickables(trebleNotes);

        const bassVoice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false);
        bassVoice.addTickables(bassNotes);

        if (useKeySig) {
          Accidental.applyAccidentals([trebleVoice], keySignature!);
          Accidental.applyAccidentals([bassVoice], keySignature!);
        }

        const formatWidth = trebleStave.getNoteEndX() - trebleStave.getNoteStartX() - 10;
        new Formatter()
          .joinVoices([trebleVoice])
          .joinVoices([bassVoice])
          .format([trebleVoice, bassVoice], Math.max(formatWidth, 50));

        trebleVoice.draw(context, trebleStave);
        bassVoice.draw(context, bassStave);

        // Draw chord labels above treble staff
        if (measureLabels?.[m]) {
          const svg = containerRef.current!.querySelector('svg');
          if (svg) {
            trebleNotes.forEach((note, i) => {
              const labelText = measureLabels[m][i];
              if (!labelText) return;
              const x = note.getAbsoluteX();
              const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
              text.setAttribute('x', String(x));
              text.setAttribute('y', String(trebleY));
              text.setAttribute('font-size', '13');
              text.setAttribute('font-family', 'ui-monospace, monospace');
              text.setAttribute('fill', '#374151');
              text.textContent = labelText;
              if (onLabelClick) {
                text.style.cursor = 'pointer';
                const mIdx = m, cIdx = i;
                text.addEventListener('click', () => onLabelClick(mIdx, cIdx));
                text.addEventListener('mouseenter', () => text.setAttribute('fill', '#2563eb'));
                text.addEventListener('mouseleave', () => text.setAttribute('fill', '#374151'));
              }
              svg.appendChild(text);
            });
          }
        }
      }

      currentX += mWidth;
    }

    // Draw connectors (brace + barlines)
    if (trebleStaves.length > 0 && bassStaves.length > 0) {
      const brace = new StaveConnector(trebleStaves[0], bassStaves[0]);
      brace.setType('brace');
      brace.setContext(context).draw();

      const lineLeft = new StaveConnector(trebleStaves[0], bassStaves[0]);
      lineLeft.setType('singleLeft');
      lineLeft.setContext(context).draw();

      const last = trebleStaves.length - 1;
      const lineRight = new StaveConnector(trebleStaves[last], bassStaves[last]);
      lineRight.setType('singleRight');
      lineRight.setContext(context).draw();
    }
  }, [chords, measures, keySignature, measureLabels, onLabelClick, width, height, staveWidth, activeChordIndex, activeMeasureIdx]);

  return <div ref={containerRef} className="overflow-x-auto" />;
}
