/**
 * Force iOS to use "playback" audio session instead of "ambient".
 * "Ambient" respects the mute switch; "playback" ignores it.
 *
 * iOS 17+ supports navigator.audioSession.type = "playback" (official API).
 * Fallback: loop a silent HTML5 <audio> element to force the media channel.
 *
 * @see https://bugs.webkit.org/show_bug.cgi?id=237322
 */

// Extend Navigator for the audioSession API (iOS 17+)
interface AudioSession {
  type: 'auto' | 'playback' | 'transient' | 'ambient' | 'play-and-record';
}

declare global {
  interface Navigator {
    audioSession?: AudioSession;
  }
}

// ── Tiny silent WAV for fallback ────────────────────────────────
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let unlocked = false;

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Primary: use the official audioSession API (iOS 17+).
 * Returns true if the API was available and set.
 */
function tryAudioSessionAPI(): boolean {
  if (navigator.audioSession) {
    try {
      navigator.audioSession.type = 'playback';
      console.log('[unmute] audioSession.type set to playback');
      return true;
    } catch {
      // API exists but assignment failed — fall through
    }
  }
  return false;
}

/**
 * Fallback: play a looping silent HTML5 audio to force the media channel.
 */
function trySilentAudio(): boolean {
  try {
    const audio = document.createElement('audio');
    audio.setAttribute('x-webkit-airplay', 'deny');
    audio.preload = 'auto';
    audio.loop = true;
    audio.src = SILENT_WAV;
    audio.load();

    const p = audio.play();
    if (p) {
      p.catch(() => {
        unlocked = false;
      });
    }
    return true;
  } catch {
    return false;
  }
}

function unlock() {
  if (unlocked) return;

  // Try official API first, then silent audio fallback
  if (tryAudioSessionAPI() || trySilentAudio()) {
    unlocked = true;
  }
}

export function setupUnmuteAudio() {
  if (!isIOS()) return;

  // Try immediately (audioSession API doesn't need user gesture)
  if (tryAudioSessionAPI()) {
    unlocked = true;
    return;
  }

  // Fallback: wait for user interaction
  const events = ['touchstart', 'touchend', 'click'] as const;

  function handler() {
    unlock();
    if (unlocked) {
      events.forEach(e => document.removeEventListener(e, handler, true));
    }
  }

  events.forEach(e =>
    document.addEventListener(e, handler, { capture: true, passive: true }),
  );
}
