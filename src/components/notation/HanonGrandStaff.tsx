import { useRef, useEffect, useState } from 'react';
import {
  Renderer, Stave, StaveNote, Voice, Formatter,
  Accidental, StaveConnector, Annotation,
} from 'vexflow';
import type { Pitch, NoteName } from '../../types/music';
import { respellForKey } from '../../lib/music/noteUtils';

interface HanonGrandStaffProps {
  trebleNotes: Pitch[];       // 8 eighth notes (arpeggio pattern)
  bassChord: Pitch[];         // 4-note whole note chord (7th chord)
  keySignature?: string;      // VexFlow key signature string (e.g., 'Bb', 'G')
  activeNoteIndex?: number;   // Highlight index during playback
  fingeringLabels?: string[]; // Fingering numbers per treble note
  height?: number;
  maxStaveWidth?: number;     // Maximum stave width (shrinks on narrow screens)
}

function pitchToVexKey(p: Pitch): string {
  return `${p.name.charAt(0)}${p.name.slice(1)}/${p.octave}`;
}

export default function HanonGrandStaff({
  trebleNotes,
  bassChord,
  keySignature,
  activeNoteIndex,
  fingeringLabels,
  height = 260,
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
    const bassY = 120;

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    renderer.resize(totalWidth, height);
    const context = renderer.getContext();

    // Create staves with clefs and key signature
    const trebleStave = new Stave(startX, trebleY, staveWidth);
    trebleStave.addClef('treble');
    if (useKeySig) trebleStave.addKeySignature(keySignature!);
    trebleStave.setContext(context).draw();

    const bassStave = new Stave(startX, bassY, staveWidth);
    bassStave.addClef('bass');
    if (useKeySig) bassStave.addKeySignature(keySignature!);
    bassStave.setContext(context).draw();

    // --- Treble Voice: eighth notes ---
    const treblePitches = useKeySig
      ? trebleNotes.map(p => respellForKey(p, keySignature! as NoteName))
      : trebleNotes;

    const trebleStaveNotes = treblePitches.map((p, i) => {
      const note = new StaveNote({
        keys: [pitchToVexKey(p)],
        duration: '8',
        clef: 'treble',
      });

      // Highlight active note during playback
      if (activeNoteIndex !== undefined && i === activeNoteIndex) {
        note.setStyle({ fillStyle: '#3b82f6', strokeStyle: '#3b82f6' });
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

    // --- Bass Voice: whole note 7th chord ---
    const bassPitches = useKeySig
      ? bassChord.map(p => respellForKey(p, keySignature! as NoteName))
      : bassChord;

    const bassKeys = bassPitches.map(pitchToVexKey);
    const bassNote = new StaveNote({
      keys: bassKeys,
      duration: 'w',
      clef: 'bass',
    });

    const bassVoice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false);
    bassVoice.addTickables([bassNote]);

    // Apply accidentals
    if (useKeySig) {
      Accidental.applyAccidentals([trebleVoice], keySignature!);
      Accidental.applyAccidentals([bassVoice], keySignature!);
    } else {
      // Manual accidentals when no key signature
      treblePitches.forEach((p, i) => {
        const acc = p.name.slice(1);
        if (acc === '#' || acc === 'b') {
          trebleStaveNotes[i].addModifier(new Accidental(acc), 0);
        }
      });
      bassPitches.forEach((p, idx) => {
        const acc = p.name.slice(1);
        if (acc === '#' || acc === 'b') {
          bassNote.addModifier(new Accidental(acc), idx);
        }
      });
    }

    // Format both voices together and draw
    const formatWidth = trebleStave.getNoteEndX() - trebleStave.getNoteStartX() - 10;
    new Formatter()
      .joinVoices([trebleVoice])
      .joinVoices([bassVoice])
      .format([trebleVoice, bassVoice], Math.max(formatWidth, 50));

    trebleVoice.draw(context, trebleStave);
    bassVoice.draw(context, bassStave);

    // Draw connectors: brace + barlines
    const brace = new StaveConnector(trebleStave, bassStave);
    brace.setType('brace');
    brace.setContext(context).draw();

    const lineLeft = new StaveConnector(trebleStave, bassStave);
    lineLeft.setType('singleLeft');
    lineLeft.setContext(context).draw();

    const lineRight = new StaveConnector(trebleStave, bassStave);
    lineRight.setType('singleRight');
    lineRight.setContext(context).draw();

  }, [trebleNotes, bassChord, keySignature, activeNoteIndex, fingeringLabels, height, maxStaveWidth, measuredWidth]);

  return <div ref={containerRef} />;
}
