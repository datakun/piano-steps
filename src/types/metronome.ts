export type TimeSignature = '4/4' | '3/4' | '6/8' | '2/4' | '5/4' | '7/8';

export type ClickSound = 'click' | 'woodblock' | 'beep';

export interface MetronomeConfig {
  bpm: number;
  timeSignature: TimeSignature;
  accentBeat1: boolean;
  soundType: ClickSound;
  volume: number; // 0–100 (default 80)
}
