import { useRef, useEffect } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Annotation } from 'vexflow';
import type { Pitch } from '../../types/music';

export interface MeasureData {
  notes: Pitch[][];         // Array of chords (each chord is Pitch[])
  durations?: string[];     // VexFlow durations ('w', 'h', 'q', '8'). Default: 'w'
  clef?: 'treble' | 'bass';
  fingerings?: string[];    // Fingering number per note position (displayed below)
}

interface StaffRendererProps {
  measures: MeasureData[];
  width?: number;
  height?: number;
  clef?: 'treble' | 'bass';
  activeNoteIndex?: number;
  staveWidth?: number;
}

function pitchToVexKey(p: Pitch): string {
  // VexFlow wants format like "C/4", "Eb/5"
  const base = p.name.charAt(0);
  const acc = p.name.slice(1); // '#', 'b', or ''
  return `${base}${acc}/${p.octave}`;
}

function getAccidentals(p: Pitch): string | null {
  const acc = p.name.slice(1);
  if (acc === '#') return '#';
  if (acc === 'b') return 'b';
  return null;
}

export default function StaffRenderer({
  measures,
  width,
  height = 150,
  clef = 'treble',
  activeNoteIndex,
  staveWidth = 200,
}: StaffRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || measures.length === 0) return;

    // Clear previous render
    containerRef.current.innerHTML = '';

    const totalWidth = width ?? (measures.length * staveWidth + 40);
    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    renderer.resize(totalWidth, height);
    const context = renderer.getContext();

    let x = 10;
    measures.forEach((measure, mIdx) => {
      const stave = new Stave(x, 10, staveWidth);
      if (mIdx === 0) {
        stave.addClef(clef);
      }
      stave.setContext(context).draw();

      const staveNotes = measure.notes.map((chord, nIdx) => {
        const keys = chord.map(pitchToVexKey);
        const duration = measure.durations?.[nIdx] ?? 'w';
        const note = new StaveNote({
          keys,
          duration,
          clef,
        });

        // Add accidentals
        chord.forEach((p, keyIdx) => {
          const acc = getAccidentals(p);
          if (acc) {
            note.addModifier(new Accidental(acc), keyIdx);
          }
        });

        // Add fingering annotation below note
        const fingering = measure.fingerings?.[nIdx];
        if (fingering) {
          const ann = new Annotation(fingering);
          ann.setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
          ann.setFont('Arial', 11, 'normal');
          note.addModifier(ann, 0);
        }

        // Highlight active note
        if (activeNoteIndex !== undefined) {
          const globalIdx = measures.slice(0, mIdx).reduce((sum, m) => sum + m.notes.length, 0) + nIdx;
          if (globalIdx === activeNoteIndex) {
            note.setStyle({ fillStyle: '#3b82f6', strokeStyle: '#3b82f6' });
          }
        }

        return note;
      });

      if (staveNotes.length > 0) {
        const voice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false);
        voice.addTickables(staveNotes);
        new Formatter().joinVoices([voice]).format([voice], staveWidth - 40);
        voice.draw(context, stave);
      }

      x += staveWidth;
    });
  }, [measures, width, height, clef, activeNoteIndex, staveWidth]);

  return <div ref={containerRef} className="overflow-x-auto" />;
}
