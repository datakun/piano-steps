import { useCallback, useRef, useState } from 'react';

const MAX_TAPS = 4;
const RESET_THRESHOLD_MS = 2000; // 2초 이상 간격이면 리셋
const MIN_BPM = 40;
const MAX_BPM = 200;

/**
 * Tap Tempo hook — 탭 간격의 평균으로 BPM 계산
 *
 * - 최소 2번 탭부터 BPM 계산
 * - 최근 4번 탭까지만 사용
 * - 2초 이상 간격이면 리셋 (새로 시작)
 * - 소수점 버림 (Math.floor)
 * - BPM 40~200 범위 밖이면 콜백 호출 안 함
 */
export function useTapTempo(onBpmChange: (bpm: number) => void) {
  const tapsRef = useRef<number[]>([]);
  const [tapCount, setTapCount] = useState(0);

  const tap = useCallback(() => {
    const now = performance.now();
    const taps = tapsRef.current;

    // 이전 탭과 2초 이상 간격이면 리셋
    if (taps.length > 0 && now - taps[taps.length - 1] > RESET_THRESHOLD_MS) {
      taps.length = 0;
    }

    // 탭 기록 추가
    taps.push(now);

    // 최대 4개까지만 유지
    if (taps.length > MAX_TAPS) {
      taps.shift();
    }

    setTapCount(taps.length);

    // 2번 이상 탭해야 BPM 계산
    if (taps.length < 2) return;

    // 인접 간격들의 평균 계산
    let sum = 0;
    for (let i = 1; i < taps.length; i++) {
      sum += taps[i] - taps[i - 1];
    }
    const avgInterval = sum / (taps.length - 1);

    // BPM = 60000ms / 평균 간격(ms), 소수점 버림
    const bpm = Math.floor(60000 / avgInterval);

    // 범위 내에서만 반영
    if (bpm >= MIN_BPM && bpm <= MAX_BPM) {
      onBpmChange(bpm);
    }
  }, [onBpmChange]);

  return { tap, tapCount };
}
