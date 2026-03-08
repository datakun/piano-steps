import { useEffect, useRef } from 'react';
import { useMetronomeStore } from './metronomeStore';
import type { TimeSignature } from '../../types/metronome';

const STORAGE_PREFIX = 'piano-steps:metronome:';

interface SavedConfig {
  bpm: number;
  timeSignature: TimeSignature;
  accentBeat1: boolean;
}

/**
 * Hook that persists metronome settings per module in localStorage.
 * On mount: loads saved settings for this module and applies to the global store.
 * On change: saves current settings to localStorage under this module's key.
 */
export function useModuleMetronome(moduleKey: string) {
  const { bpm, timeSignature, accentBeat1, setBpm, setTimeSignature, toggleAccent, stop } =
    useMetronomeStore();

  // Skip the first save cycle — it runs with stale values from the initial render,
  // before the loaded values have propagated through a re-render.
  const mounted = useRef(false);

  // Load saved settings on mount
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_PREFIX + moduleKey);
    if (!raw) return;

    try {
      const config: SavedConfig = JSON.parse(raw);
      if (typeof config.bpm === 'number') setBpm(config.bpm);
      if (config.timeSignature) setTimeSignature(config.timeSignature);
      if (typeof config.accentBeat1 === 'boolean') {
        const current = useMetronomeStore.getState().accentBeat1;
        if (current !== config.accentBeat1) toggleAccent();
      }
    } catch { /* ignore corrupt data */ }
  }, [moduleKey, setBpm, setTimeSignature, toggleAccent]);

  // Save on config change — skip the first invocation (initial render with stale defaults)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const config: SavedConfig = { bpm, timeSignature, accentBeat1 };
    localStorage.setItem(STORAGE_PREFIX + moduleKey, JSON.stringify(config));
  }, [bpm, timeSignature, accentBeat1, moduleKey]);

  // Stop metronome when leaving the module
  useEffect(() => {
    return () => stop();
  }, [stop]);
}
