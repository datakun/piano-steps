import { useRef, useEffect, useState } from 'react';
import {
  Renderer, Stave, StaveNote, Voice, Formatter,
  Accidental, Annotation, Stem,
} from 'vexflow';
import type { Pitch, NoteName } from '../../types/music';
import { respellForKey } from '../../lib/music/noteUtils';

interface HanonGrandStaffProps {
  trebleNotes: Pitch[];       // 8 eighth notes (arpeggio pattern)
  bassChord?: Pitch[];        // (unused, kept for API compat)
  keySignature?: string;      // VexFlow key signature string (e.g., 'Bb', 'G')
  activeNoteIndex?: number;   // Highlight index during playback
  fingeringLabels?: string[]; // Fingering numbers per treble note
  degreeLabels?: string[];    // Chord degree labels per treble note (e.g., '1','3','5','7')
  height?: number;
  maxStaveWidth?: number;     // Maximum stave width (shrinks on narrow screens)
}

function pitchToVexKey(p: Pitch): string {
  return `${p.name.charAt(0)}${p.name.slice(1)}/${p.octave}`;
}

export default function HanonGrandStaff({
  trebleNotes,
  keySignature,
  activeNoteIndex,
  fingeringLabels,
  degreeLabels,
  height = 160,
  maxStaveWidth = 500,
}: HanonGrandStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  // Measure container width and respond to resizes
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0;
      setMeasuredWidth(w);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current || trebleNotes.length === 0 || measuredWidth === 0) return;
    containerRef.current.innerHTML = '';

    const startX = 10;
    const staveWidth = Math.min(maxStaveWidth, measuredWidth - startX * 2);
    const useKeySig = !!keySignature;
    const totalWidth = startX + staveWidth + 10;
    const trebleY = 10;

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    renderer.resize(totalWidth, height);
    const context = renderer.getContext();

    // Create treble stave with clef and key signature
    const trebleStave = new Stave(startX, trebleY, staveWidth);
    trebleStave.addClef('treble');
    if (useKeySig) trebleStave.addKeySignature(keySignature!);
    trebleStave.setContext(context).draw();

    // --- Treble Voice: eighth notes ---
    const treblePitches = useKeySig
      ? trebleNotes.map(p => respellForKey(p, keySignature! as NoteName))
      : trebleNotes;

    const trebleStaveNotes = treblePitches.map((p, i) => {
      // Stem down for notes at or above C5 (high C, MIDI 72)
      const origPitch = trebleNotes[i];
      const stemDir = origPitch && origPitch.midi >= 72 ? Stem.DOWN : Stem.UP;
      const note = new StaveNote({
        keys: [pitchToVexKey(p)],
        duration: '8',
        clef: 'treble',
        stemDirection: stemDir,
      });

      // Highlight active note during playback
      if (activeNoteIndex !== undefined && i === activeNoteIndex) {
        note.setStyle({ fillStyle: '#3b82f6', strokeStyle: '#3b82f6' });
      }

      // Degree label annotation above note
      if (degreeLabels?.[i]) {
        const degAnn = new Annotation(degreeLabels[i]);
        degAnn.setVerticalJustification(Annotation.VerticalJustify.TOP);
        degAnn.setFont('Arial', 11, 'bold');
        note.addModifier(degAnn, 0);
      }

      // Fingering annotation below note
      if (fingeringLabels?.[i]) {
        const ann = new Annotation(fingeringLabels[i]);
        ann.setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
        ann.setFont('Arial', 11, 'normal');
        note.addModifier(ann, 0);
      }

      return note;
    });

    const trebleVoice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false);
    trebleVoice.addTickables(trebleStaveNotes);

    // Apply accidentals
    if (useKeySig) {
      Accidental.applyAccidentals([trebleVoice], keySignature!);
    } else {
      treblePitches.forEach((p, i) => {
        const acc = p.name.slice(1);
        if (acc === '#' || acc === 'b') {
          trebleStaveNotes[i].addModifier(new Accidental(acc), 0);
        }
      });
    }

    // Format and draw
    const formatWidth = trebleStave.getNoteEndX() - trebleStave.getNoteStartX() - 10;
    new Formatter()
      .joinVoices([trebleVoice])
      .format([trebleVoice], Math.max(formatWidth, 50));

    trebleVoice.draw(context, trebleStave);

  }, [trebleNotes, keySignature, activeNoteIndex, fingeringLabels, degreeLabels, height, maxStaveWidth, measuredWidth]);

  return <div ref={containerRef} />;
}
