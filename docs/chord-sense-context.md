# CHORD SENSE
**Real-time Chord Recognition — Technical Context Document**

`chord-recognizer.tsx` | Frontend Only | No Backend Required

---

## 1. 프로젝트 개요

브라우저 마이크 입력만으로 기타·피아노 연주에서 코드를 실시간 인식하는 순수 프론트엔드 앱이다. 백엔드 서버, 외부 API 호출, 모델 서버 없이 Web Audio API + DSP 알고리즘만으로 동작한다.

**파일:** `chord-recognizer.tsx` (단일 파일, React + TypeScript)

| 항목 | 내용 |
|------|------|
| 런타임 | 브라우저 (Chrome / Safari / Firefox) |
| 의존성 | React 18, TypeScript — 외부 ML 라이브러리 없음 |
| 마이크 권한 | `getUserMedia` (`echoCancellation` · `noiseSuppression` · `autoGainControl` 모두 off) |
| FFT 크기 | 16384 — 44100Hz 기준 bin 해상도 약 2.7Hz |

---

## 2. 아키텍처

### 2-1. 데이터 흐름

마이크 → `AudioContext` → `AnalyserNode` → DSP 알고리즘 → `NoteAccumulator` → `recognizeChord` → UI 상태 업데이트 순으로 처리된다. `requestAnimationFrame` 루프에서 매 프레임 실행되며, React `setState` 호출은 throttle 없이 그대로 반영된다.

```
Mic (MediaStream)
  └─ AudioContext (44100 Hz)
       └─ AnalyserNode (fftSize: 16384)
            ├─ [Guitar]  detectPitchesFFT()  → FFT peak-picking + harmonic suppression
            └─ [Piano]   detectPitchesHPS()  → Harmonic Product Spectrum
                 └─ NoteAccumulator (350ms window, 40% stability threshold)
                      └─ recognizeChord()    → ChordResult { root, pattern, confidence }
                           └─ React state   → UI render
```

### 2-2. 주요 export

다음 심볼들이 외부에서 재사용 가능하도록 named export 되어 있다.

| 심볼 | 종류 | 설명 |
|------|------|------|
| `Instrument` | type | `"guitar" \| "piano"` |
| `ChordPattern` | interface | `name`, `intervals[]`, `display` 포함 |
| `DetectedNote` | interface | `freq`, `db`, `midi`, `noteClass`, `hps?` 포함 |
| `ChordResult` | interface | `root`, `pattern`, `confidence` (0~1) |
| `HistoryEntry` | interface | `name`, `time` (string) |
| `recognizeChord` | function | `Set<number>` → `ChordResult \| null` |
| `detectPitchesFFT` | function | Guitar 전용 pitch detector |
| `detectPitchesHPS` | function | Piano 전용 HPS pitch detector |

---

## 3. 알고리즘 상세

### 3-1. Guitar 모드 — FFT Peak-Picking + Harmonic Suppression

**함수:** `detectPitchesFFT(analyser, sampleRate)`

- 감지 범위: 60Hz ~ 1200Hz (기타 표준 튜닝 기준 개방현 82Hz ~ 고음역 1kHz 이상)
- dBFS 임계값: -55dB. 이보다 낮은 신호는 무음으로 처리
- 로컬 피크를 진폭 내림차순으로 정렬해 상위 12개 후보 추출
- 각 피크를 MIDI 번호로 변환 후 pitch class (0~11) 로 그룹화 — 옥타브 무시
- 배음 억제(harmonic suppression): 진폭이 큰 음부터 순서대로 2~5배음을 사용된 것으로 마킹해 중복 감지 방지
- 최종 결과: 임계값 통과한 음 중 최대 6개 반환

> **설계 배경:** 기타는 홀수 배음이 강하고 보디 공명으로 복잡한 배음 패턴을 갖는다. HPS를 기타에 적용하면 배음 곱이 fundamental보다 높은 partial에서 더 큰 값을 가질 수 있어 옥타브 오류가 잦다. Peak-picking + 명시적 배음 억제가 더 안정적이다.

### 3-2. Piano 모드 — HPS (Harmonic Product Spectrum)

**함수:** `detectPitchesHPS(analyser, sampleRate)`

- 감지 범위: 27.5Hz (A0) ~ 4186Hz (C8) — 88건반 전체
- dB 스펙트럼을 선형 진폭으로 변환 후 HPS 계산
- `HPS[i] = linear[i] × linear[2i] × linear[3i] × linear[4i]` (4 harmonics)
- HPS 로컬 피크에서 pitch class별 대표값 추출 (최대 8음)
- `AnalyserNode.smoothingTimeConstant = 0.7` — 피아노 어택 스파이크 억제

> **설계 배경:** 피아노는 배음 시리즈가 매우 규칙적이다. HPS는 배음이 모두 강하게 존재하는 주파수 bin을 곱으로 증폭해 fundamental이 도드라지게 만든다. 건반 간 주파수 간격이 좁은 피아노에서 옥타브 오류 없이 안정적으로 동작한다.

### 3-3. 코드 인식 — `recognizeChord()`

**함수:** `recognizeChord(noteSet: Set<number>): ChordResult | null`

- 입력: pitch class 집합 (0~11 정수 `Set`)
- 12개 루트 × 14개 패턴 = 168가지 조합을 브루트포스로 비교
- `score = matched/total − (missing × 0.3)` — 생략음에 페널티 적용
- 조건: `matched ≥ min(3, required.length)` AND `score > bestScore`
- 신뢰도(`confidence`) = `matched / pattern.intervals.length`
- 14개 지원 코드 타입: `maj min dim aug sus2 sus4 maj7 m7 7 dim7 m7♭5 add9 m9 maj9`
- 인버전(전위) 처리: pitch class 비교이므로 루트 보이싱과 무관하게 동작

### 3-4. NoteAccumulator — 시간 평활화

매 프레임 pitch detector 결과는 노이즈와 짧은 오검출이 섞인다. `NoteAccumulator`는 350ms 롤링 윈도우 내 프레임들에서 각 pitch class가 **40% 이상** 등장할 때만 안정된 음으로 판정한다.

이 값은 빠른 스트럼(~120bpm 16th note ≈ 125ms)에서 오검출 억제와 실시간 응답 사이의 균형점으로 선택됐다.

---

## 4. Production 모델 교체 가이드

현재 구현은 순수 DSP 기반이라 악기에 따라 정확도가 달라진다. 아래는 CC가 ML 모델로 교체할 때의 인터페이스 명세다.

| 악기 | 교체 대상 모델 | 모델 크기 | 비고 |
|------|--------------|---------|------|
| Piano | Magenta OnsetsAndFrames (small) | ~17 MB | note onset/offset 이벤트 방식으로 코드 추출 방식 변경 필요 |
| Guitar | CREPE (crepe-tiny) | ~17 MB | 단음 pitch 신뢰도 반환 → 다중 pitch 감지엔 별도 polyphonic 처리 필요 |

### 교체 시 수정 지점

- **Guitar:** `startListening()` 내 `detectPitchesFFT()` 호출을 CREPE 추론 결과로 교체. `DetectedNote[]` 형태 유지.
- **Piano:** `detectPitchesHPS()`를 Magenta OnsetsAndFrames 프레임 출력으로 교체. `noteClass` `Set`을 직접 반환하도록 래핑.
- **NoteAccumulator**는 두 경우 모두 유지 가능. 모델이 이미 smoothing을 제공한다면 `windowMs`를 0으로 설정해도 무방.
- **`recognizeChord()`는 변경 불필요.** `Set<number>` (pitch class)를 받는 인터페이스가 모델과 무관하게 동작한다.

---

## 5. 현재 구현의 한계 및 주의사항

| 항목 | 내용 |
|------|------|
| 기타 정확도 | 배음 억제 heuristic이므로 왜곡이 강한 일렉 기타, 카포 사용 시 오검출 증가 |
| 피아노 페달 | 서스테인 페달 사용 시 이전 화음이 겹쳐 코드 오인식 가능 |
| 주변 소음 | `noiseSuppression` off 상태이므로 저주파 노이즈(-55dB 이상)가 오감지 유발 가능 |
| enharmonic | C#과 D♭을 구분하지 않음 — pitch class 기반 동일 취급 |
| Safari AudioContext | iOS Safari는 user gesture 없이 `AudioContext.resume()` 불가. `startListening()`이 click handler에서 호출되므로 현재 구조는 문제 없음 |
| 동시 악기 | 기타와 피아노 동시 연주는 지원하지 않음 — 악기별 모델이 분리돼 있음 |

---

## 6. 주요 조정 파라미터

아래 값들은 실험적으로 결정됐으며 환경에 따라 조정이 필요할 수 있다.

| 파라미터 | Guitar | Piano | 변경 영향 |
|---------|--------|-------|---------|
| dB threshold | -55 dBFS | -50 dBFS | 낮추면 조용한 연주 감지 ↑, 노이즈 오검출 ↑ |
| `smoothingTimeConstant` | 0.6 | 0.7 | 높이면 부드러움 ↑, 응답 지연 ↑ |
| `NoteAccumulator` windowMs | 350ms | 350ms | 줄이면 반응속도 ↑, 안정성 ↓ |
| stability threshold | 40% | 40% | 높이면 오검출 ↓, 감지 민감도 ↓ |
| harmonic suppression range | 2~5배음 | N/A | 범위 늘리면 배음 오감지 ↓, 고음역 음 누락 ↑ |
| HPS harmonics | N/A | 4 | 늘리면 fundamental 강조 ↑, 고음역 정밀도 ↓ |

---

## 7. 파일 구조

단일 파일 컴포넌트로 구성되어 있다. 분리가 필요할 경우 아래 모듈 경계로 분할을 권장한다.

```
chord-recognizer.tsx
  ├── Types & Interfaces         (export: Instrument, ChordPattern, DetectedNote, ChordResult, HistoryEntry)
  ├── Constants                  (NOTE_NAMES, CHORD_PATTERNS)
  ├── Music Theory Utils         (freqToMidi, midiToNoteName)
  ├── recognizeChord()           (export — core chord matching logic)
  ├── detectPitchesFFT()         (export — Guitar pitch detector)
  ├── detectPitchesHPS()         (export — Piano pitch detector)
  ├── NoteAccumulator            (class — temporal smoothing)
  ├── SpectrumCanvas             (React component — canvas visualizer)
  └── ChordRecognizer            (default export — main app component)
```

---

*chord-recognizer.tsx — for CC reference*
