# Piano Steps - Jazz Piano Practice Web App

## Tech Stack
- React 19 + TypeScript + Vite 7
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- VexFlow 5 (music notation rendering, SVG)
- Tone.js (audio engine, metronome, playback scheduling)
- Zustand 5 (state management, per-module stores)
- React Router v7

## Commands
- `npm run dev` - Start dev server (port 5173, host 127.0.0.1)
- `npm run build` - TypeScript check + production build
- `npm run preview` - Preview production build

## Project Structure
```
src/
  app/                    - Router, Layout, HomePage
  components/
    metronome/            - MetronomeWidget, BeatIndicator
    notation/             - StaffRenderer (single clef), GrandStaff (treble+bass), HanonGrandStaff (responsive, ResizeObserver)
    piano/                - PianoKeyboard (SVG, dynamic width)
    playback/             - PlaybackControls (DAW-style transport)
  features/
    metronome/            - MetronomePage, metronomeStore (global)
    chords/               - ChordCheatSheet, ChordCard, chordStore
    two-five-one/         - TwoFiveOnePage, ProgressionDisplay, twoFiveOneStore, usePracticePlayback
    jazz-hanon/           - JazzHanonPage, jazzHanonStore, PatternBuilder, customPatternStorage, useHanonPlayback
  data/
    chords.ts             - 12 keys × 9 chord qualities, ALL_ROOTS, ALL_QUALITIES
    voicings.ts           - Not yet created (voicing logic is in voicingEngine)
    progressions.ts       - II-V-I A/B form voicings (C key base + transposition)
    exercises.ts          - Jazz Hanon 6 patterns (C key base + transposition)
  lib/
    music/
      noteUtils.ts        - Note/MIDI conversion, transposition, pitch helpers, compactVoicing
      chordBuilder.ts     - Chord intervals, tension rules, chord construction
      voicingEngine.ts    - Basic + Drop 2 voicing builders
    audio/
      metronomeEngine.ts  - Tone.js Transport + Loop singleton
  types/
    music.ts              - NoteName, Pitch, ChordQuality, ChordVoicing, Progression
    metronome.ts          - TimeSignature, ClickSound, MetronomeConfig
    playback.ts           - PlaybackStatus, PlaybackState
```

## Key Conventions
- Pitch type: `{ name: NoteName, octave: number, midi: number }` - all music data uses this
- Jazz enharmonic spelling: always prefer flats (Bb not A#, Eb not D#)
- VexFlow notation: `StaffRenderer` for single clef, `GrandStaff` for treble+bass with brace
- Piano keyboard: custom SVG component (`PianoKeyboard`) with note highlighting
- Each feature module has its own Zustand store; metronome store is global (shared)
- Voicing data: C key manually transcribed from lesson images, other keys via transposition
- Responsive notation: ResizeObserver pattern for dynamic stave width (HanonGrandStaff, ProgressionDisplay)
- Responsive layout: desktop = left sidebar (md: breakpoint), mobile = FAB bottom menu

## Modules
1. **Metronome** - BPM 40-200, time signatures (4/4, 3/4, 6/8, 2/4, 5/4, 7/8), accent, visual beat indicator. Standalone page + embeddable widget.
2. **Chord Cheat Sheet** - 108 chords (12×9), search/filter, staff notation + keyboard, basic↔Drop 2 voicing toggle. Color-coded degree labels.
3. **II-V-I Practice** - Whole-tone descending (C→Bb→Ab→Gb→E→D→F→Eb→Db→B→A→G) or random mode, 12 keys per session, A form (Open/Drop 2) / B form (Close), current+next progression display, chord label click → piano keyboard, DAW playback controls. Auto compact voicing for wide intervals.
4. **Jazz Hanon** - 6 built-in + custom patterns (PatternBuilder, localStorage CRUD), chord tone arpeggios through 7 diatonic chords (I-VII), key transposition, responsive staff notation, playback controls.

## Reference Materials
- `docs/2026-03-07_보이싱수업정리.md` - Lesson notes (voicing theory, II-V-I, Drop 2, tensions)
- `docs/2-5-1 voicing 1~3.jpeg` - A form (Open) + B form (Close) voicings for 12 keys
- `docs/7th chord cheatsheet 1~3.jpeg` - 7th chord reference for 12 keys × 10 types
- `docs/jazz trill 2.png` - Jazz Hanon exercise patterns (6 patterns, C key diatonic)
