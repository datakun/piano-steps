import { useEffect, useRef } from 'react';
import type { Instrument } from '../../lib/audio/pitchDetector';

interface SpectrumCanvasProps {
  analyserRef: React.RefObject<AnalyserNode | null>;
  isListening: boolean;
  instrument: Instrument;
}

/** Accent color per instrument */
function getAccentColor(instrument: Instrument) {
  return instrument === 'piano' ? '#3b82f6' : '#10b981'; // blue-500 / emerald-500
}

function getAccentGlow(instrument: Instrument) {
  return instrument === 'piano' ? 'rgba(59,130,246,0.3)' : 'rgba(16,185,129,0.3)';
}

export default function SpectrumCanvas({
  analyserRef,
  isListening,
  instrument,
}: SpectrumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Set canvas to retina resolution
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;

    const draw = (): void => {
      rafRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#f9fafb'; // gray-50
      ctx.fillRect(0, 0, W, H);

      if (!analyserRef.current || !isListening) {
        // Idle animation — gentle sine wave
        ctx.strokeStyle = 'rgba(156,163,175,0.3)'; // gray-400/30
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x < W; x++) {
          const y = H / 2 + Math.sin(x * 0.04 + Date.now() * 0.001) * 6;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        return;
      }

      const analyser = analyserRef.current;
      const bufLen = analyser.frequencyBinCount;
      const data = new Float32Array(bufLen);
      analyser.getFloatFrequencyData(data);

      const accentColor = getAccentColor(instrument);
      const accentGlow = getAccentGlow(instrument);

      // Frequency bars
      const barCount = 120;
      const barW = W / barCount;
      const maxBin = Math.min(bufLen, 600);

      for (let i = 0; i < barCount; i++) {
        const binIdx = Math.floor((i / barCount) * maxBin);
        const val = Math.max(0, (data[binIdx] + 90) / 90);
        const barH = val * H * 0.85;
        const x = i * barW;
        const y = H - barH;
        const grad = ctx.createLinearGradient(0, y, 0, H);
        grad.addColorStop(0, accentColor);
        grad.addColorStop(1, accentGlow);
        ctx.fillStyle = grad;
        ctx.fillRect(x + 0.5, y, barW - 1, barH);
      }

      // Waveform overlay (subtle)
      const waveData = new Uint8Array(bufLen);
      analyser.getByteTimeDomainData(waveData);
      ctx.strokeStyle = 'rgba(107,114,128,0.15)'; // gray-500/15
      ctx.lineWidth = 1;
      ctx.beginPath();
      const sliceW = W / bufLen;
      for (let i = 0; i < bufLen; i++) {
        const v = waveData[i] / 128 - 1;
        const y = v * H * 0.15 + H * 0.5;
        i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * sliceW, y);
      }
      ctx.stroke();
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isListening, instrument, analyserRef]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg border border-gray-200"
      style={{ height: '100px', display: 'block' }}
    />
  );
}
