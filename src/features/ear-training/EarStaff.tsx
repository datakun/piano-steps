import { useEffect, useRef } from 'react';
import { Accidental, Annotation, Dot, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import { spell, type KeyContext } from './earTraining';

export interface StaffItem {
  /** 소리 나는 음. 비어 있으면 쉼표 */
  midis: number[];
  /** VexFlow 길이: 'w', 'h', 'q', '8' */
  duration: string;
  dotted?: boolean;
  /** 음표 위에 붙는 글자 */
  label?: string;
}

const NOTE_SPACING = 48;
const HEIGHT = 170;

/** 조표를 붙인 높은음자리표 한 줄 악보. 음 표기는 spell() 결과를 따른다. */
function vexKey(ctx: KeyContext, midi: number): string {
  const s = spell(ctx, midi);
  const octave = s.name.slice(s.pcName.length);
  return `${s.pcName.replace('♯', '#').replace('♭', 'b')}/${octave}`;
}

export default function EarStaff({ ctx, items }: { ctx: KeyContext; items: StaffItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = '';

    const staveWidth = 90 + Math.max(items.length, 2) * NOTE_SPACING;
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(staveWidth + 20, HEIGHT);
    const context = renderer.getContext();

    const stave = new Stave(10, 30, staveWidth);
    stave.addClef('treble').addKeySignature(ctx.key);
    stave.setContext(context).draw();
    if (items.length === 0) return;

    const notes = items.map(item => {
      const rest = item.midis.length === 0;
      const note = new StaveNote({
        keys: rest ? ['B/4'] : [...item.midis].sort((a, b) => a - b).map(m => vexKey(ctx, m)),
        duration: rest ? `${item.duration}r` : item.duration,
        clef: 'treble',
      });
      if (item.dotted) Dot.buildAndAttach([note], { all: true });
      if (item.label) {
        const ann = new Annotation(item.label);
        ann.setVerticalJustification(Annotation.VerticalJustify.TOP);
        ann.setFont('Arial', 11, 'bold');
        note.addModifier(ann, 0);
      }
      return note;
    });

    const voice = new Voice({ numBeats: 4, beatValue: 4 }).setStrict(false);
    voice.addTickables(notes);
    Accidental.applyAccidentals([voice], ctx.key);
    new Formatter().joinVoices([voice]).format([voice], staveWidth - 90);
    voice.draw(context, stave);
  }, [ctx, items]);

  return <div ref={containerRef} className="overflow-x-auto bg-white rounded" />;
}
