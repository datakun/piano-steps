export type PlaybackStatus = 'stopped' | 'playing' | 'paused';

export interface PlaybackState {
  status: PlaybackStatus;
  currentMeasure: number;
  currentBeat: number;
  totalMeasures: number;
  isRepeating: boolean;
}
