# Phase N: Touch Dynamics 모듈 (터치 균일성 + 타임키핑)

> 이 문서를 Piano Steps SPEC.md 끝에 추가한다.
> MIDI 건반의 벨로시티 데이터를 활용하여 터치 균일성과 타이밍 정확도를 시각적으로 피드백하는 연습 도구.

---

## 목적

밴드 키보디스트가 균일한 터치와 정확한 타이밍으로 연주할 수 있도록 MIDI 벨로시티/타이밍을 실시간 측정하고 시각적 피드백을 제공하는 연습 도구.

기존 모듈과의 차이:

| | 보이싱 모듈 | Voicing Map | **Touch Dynamics** |
|---|---|---|---|
| 목적 | 올바른 보이싱 연습 | 보이싱 레퍼런스 | **터치/타이밍 컨트롤** |
| MIDI 활용 | 어떤 음을 쳤는지 (노트) | 없음 | **얼마나 세게/언제 쳤는지 (벨로시티+타이밍)** |
| 메트로놈 | 세션 진행용 | 없음 | **타이밍 기준점** |
| 핵심 지표 | 코드 정확도 | - | **벨로시티 편차, 타이밍 편차** |

---

## 핵심 개념

### 벨로시티 균일성

MIDI velocity 값(0~127)으로 터치 세기를 측정한다. 목표는 연주자가 의도한 볼륨 레벨에서 모든 타건의 벨로시티가 일정한 것.

**측정 지표:**
- 표준편차(σ): 일정 구간(예: 8~16타건)의 velocity 표준편차. 낮을수록 균일.
- 범위(range): 최대 velocity - 최소 velocity. 좁을수록 균일.
- 목표: σ < 8이면 "균일", σ 8~15이면 "보통", σ > 15이면 "불균일"
  (이 기준값은 설정에서 조절 가능)

### 타이밍 정확도

메트로놈 비트 기준으로 타건 타이밍의 편차를 측정한다.

**측정 지표:**
- 비트 대비 오프셋(ms): 각 타건이 가장 가까운 비트에서 얼마나 벗어났는지.
- 타이밍 표준편차: 오프셋의 표준편차. 낮을수록 안정적.
- 러시/드래그 경향: 오프셋의 평균이 음수면 rushing(빠름), 양수면 dragging(느림).
- 목표: 평균 오프셋 절대값 < 20ms이면 "정확", 20~50ms "보통", > 50ms "부정확"

---

## 연습 모드

### 모드 1: 단음 반복 (Single Note Repeat)

한 건반을 한 손가락씩 바꿔가며 반복해서 친다. 가장 기본적인 터치 균일성 연습.

**설정:**
- 반복 횟수: 8, 16, 32 (기본 8)
- 목표 벨로시티 레벨: 1~5단계 (pp=20, p=40, mp=60, mf=80, f=100) 선택
- 메트로놈: ON/OFF (기본 ON, 60 BPM)

**화면:**
- 상단: 현재 목표 레벨 (예: "mf — 벨로시티 80 근처")
- 중앙: 실시간 벨로시티 바 차트 (최근 N타건의 velocity를 세로 막대로 표시)
  - 목표 범위(±15)를 가로 밴드로 표시, 범위 안이면 초록, 밖이면 빨강
- 하단: 통계 (현재 σ, 범위, 손가락별 평균 velocity)

**MIDI 데이터 활용:**
- noteOn의 velocity 값을 수집
- 건반 위치(어떤 음)는 무시 — 아무 건반이나 쳐도 됨
- 타이밍은 메트로놈 ON 시에만 측정

### 모드 2: 연속 음 (Sequential Notes)

도레미파솔(1-2-3-4-5) 올라갔다가 솔파미레도(5-4-3-2-1) 내려오는 패턴. 손가락 전환 시 터치 균일성 연습.

**설정:**
- 시작 음: 사용자 선택 (기본 C4)
- 스케일: 크로매틱, 메이저, 마이너 (기본 메이저)
- 목표 벨로시티 레벨: 1~5단계
- 메트로놈: ON/OFF

**화면:**
- 건반 시각화: 다음에 쳐야 할 건반을 하이라이트
- 벨로시티 바 차트: 연속된 음의 velocity를 표시
  - 3→4번 손가락 전환 지점, 방향 전환 지점에 마커 표시
- 손가락 전환 분석: "3→4 전환에서 평균 -12 velocity 감소" 같은 구체적 피드백

**MIDI 데이터 활용:**
- noteOn의 note(어떤 음) + velocity(세기) 둘 다 수집
- 기대 음 시퀀스와 비교하여 순서가 맞는지도 확인

### 모드 3: 코드 균일 (Chord Balance)

코드를 칠 때 구성음이 동시에, 같은 세기로 눌리는지 연습.

**설정:**
- 코드: 프리셋 (C, Am, F, G 등) 또는 자유 (아무 코드)
- 목표 벨로시티 레벨: 1~5단계
- 메트로놈: ON/OFF

**화면:**
- 건반 시각화: 코드 구성음 하이라이트
- 코드 내 벨로시티 비교: 동시에 눌린 음들의 velocity를 나란히 표시
  - 가장 센 음과 약한 음의 차이를 수치로 표시
  - 차이 < 10이면 초록, 10~20 노랑, > 20 빨강
- 동시성 표시: 음들이 동시에 눌렸는지 (타이밍 편차 ms 표시)

**MIDI 데이터 활용:**
- 50ms 윈도우 안에 들어온 noteOn을 하나의 코드로 묶음 (기존 ChordRecognizer 패턴과 동일)
- 코드 내 각 음의 velocity와 timestamp 비교

### 모드 4: 아르페지오 균일 (Arpeggio Evenness)

아르페지오 패턴에서 모든 음이 균일한 세기와 일정한 간격으로 나오는지 연습. 실전에 가장 가까운 모드.

**설정:**
- 코드 진행: 프리셋 또는 커스텀 (기존 Progression 타입 재사용)
- 아르페지오 패턴: 상행, 하행, 상행+하행
- 목표 벨로시티 레벨: 1~5단계
- 메트로놈: ON (필수, 8분음표 기준)

**화면:**
- 건반 시각화: 아르페지오 음 순서 표시
- 벨로시티 타임라인: 시간 축(X)에 대한 velocity(Y) 꺾은선 그래프
  - 목표 범위 밴드 표시
  - 코드 전환 지점에 세로 마커
- 타이밍 타임라인: 각 음의 비트 대비 오프셋 표시
  - 0ms 라인(정확) 기준으로 위(rushing)/아래(dragging) 표시
- 코드 전환 분석: "Dadd9→FM7 전환 시 velocity 급등 +25" 같은 피드백

**MIDI 데이터 활용:**
- noteOn의 note + velocity + timestamp 전부 수집
- 기대 아르페지오 시퀀스와 비교
- 코드 전환 전후의 velocity 변화량 계산

### 모드 5: 다이나믹 컨트롤 (Dynamic Range)

pp↔f 대비 연습, 크레셴도/디크레셴도 연습. 의도한 강약을 정확히 표현하는 연습.

**설정:**
- 패턴: pp↔f 반복 (4마디씩), 크레셴도(pp→f), 디크레셴도(f→pp), 크레셴도+디크레셴도
- 마디 수: 4, 8 (기본 4)
- 메트로놈: ON (필수)

**화면:**
- 목표 다이나믹 커브: 시간에 따른 목표 velocity를 곡선으로 표시
- 실제 벨로시티 오버레이: 목표 커브 위에 실제 velocity를 점으로 표시
  - 목표 커브 근처면 초록, 벗어나면 빨강
- pp↔f 반복 시: 두 구간의 평균 velocity 차이가 클수록 좋음
  - "pp 평균: 25, f 평균: 95, 차이: 70" 같은 수치

---

## 디렉토리 구조

```
src/features/touch-dynamics/
├── components/
│   ├── VelocityBarChart.tsx        # 실시간 벨로시티 막대 차트
│   ├── VelocityTimeline.tsx        # 시간축 벨로시티 꺾은선 그래프
│   ├── TimingOffsetChart.tsx       # 비트 대비 타이밍 오프셋 표시
│   ├── TargetBand.tsx              # 목표 벨로시티 범위 밴드
│   ├── DynamicCurve.tsx            # 다이나믹 커브 (목표 + 실제 오버레이)
│   ├── FingerStats.tsx             # 손가락별 통계 표시
│   ├── SessionSummary.tsx          # 연습 세션 결과 요약
│   └── ModeSelector.tsx            # 연습 모드 선택 UI
├── constants/
│   ├── velocityLevels.ts           # 벨로시티 레벨 정의 (pp~f)
│   └── exercisePresets.ts          # 모드별 기본 설정
├── hooks/
│   ├── useVelocityTracker.ts       # 벨로시티 수집 + 통계 계산
│   ├── useTimingTracker.ts         # 타이밍 수집 + 편차 계산
│   └── useTouchSession.ts          # 세션 상태 관리 (모드별)
├── pages/
│   └── TouchDynamicsPage.tsx       # 메인 페이지 (모드 선택 + 연습)
├── types/
│   └── touchDynamics.ts            # 모듈 전용 타입
└── utils/
    ├── velocityAnalysis.ts         # 벨로시티 통계 계산 (σ, range, 손가락별)
    ├── timingAnalysis.ts           # 타이밍 통계 계산 (offset, rushing/dragging)
    └── dynamicCurve.ts             # 목표 다이나믹 커브 생성
```

---

## 라우팅 추가

| 경로 | 페이지 |
|---|---|
| `/touch-dynamics` | TouchDynamicsPage |

`App.tsx`에 라우트 추가, `ModuleNav`에 "터치 다이나믹스" 메뉴 추가.

---

## 데이터 모델

### 모듈 데이터 (`features/touch-dynamics/types/touchDynamics.ts`)

```typescript
import { PitchClass } from '../../../shared/types/music';

/** 벨로시티 레벨 (1~5) */
export type VelocityLevel = 1 | 2 | 3 | 4 | 5;

/** 벨로시티 레벨 → 목표 MIDI velocity 매핑 */
export const VELOCITY_TARGETS: Record<VelocityLevel, number> = {
  1: 20,  // pp
  2: 40,  // p
  3: 60,  // mp
  4: 80,  // mf
  5: 100, // f
};

/** 벨로시티 레벨 → 허용 범위 (±) */
export const VELOCITY_TOLERANCE: Record<VelocityLevel, number> = {
  1: 10,
  2: 12,
  3: 15,
  4: 15,
  5: 15,
};

/** 연습 모드 */
export type ExerciseMode =
  | 'single-repeat'     // 모드 1: 단음 반복
  | 'sequential'        // 모드 2: 연속 음
  | 'chord-balance'     // 모드 3: 코드 균일
  | 'arpeggio'          // 모드 4: 아르페지오 균일
  | 'dynamic-range';    // 모드 5: 다이나믹 컨트롤

/** 다이나믹 패턴 (모드 5) */
export type DynamicPattern =
  | 'pp-f-alternate'       // pp↔f 반복
  | 'crescendo'            // pp→f
  | 'decrescendo'          // f→pp
  | 'crescendo-decrescendo'; // pp→f→pp

/** 단일 타건 기록 */
export interface NoteEvent {
  midiNote: number;
  velocity: number;
  timestamp: number;           // performance.now() 기준
  beatOffset?: number;         // 가장 가까운 비트 대비 오프셋 (ms). 메트로놈 ON 시만.
}

/** 구간 통계 (일정 타건 수 또는 일정 시간) */
export interface SegmentStats {
  count: number;               // 타건 수
  velocityMean: number;
  velocityStdDev: number;
  velocityMin: number;
  velocityMax: number;
  velocityRange: number;       // max - min
  timingMeanOffset?: number;   // 평균 비트 오프셋 (ms). 음수=rushing, 양수=dragging.
  timingStdDev?: number;
}

/** 손가락별 통계 (모드 2에서 사용) */
export interface FingerStat {
  finger: 1 | 2 | 3 | 4 | 5;
  avgVelocity: number;
  stdDev: number;
  noteCount: number;
}

/** 코드 내 균일성 (모드 3에서 사용) */
export interface ChordBalanceStat {
  velocities: number[];        // 동시에 눌린 각 음의 velocity
  simultaneityMs: number;      // 최초~최후 노트 간 시간 차이 (ms)
  velocityRange: number;       // max - min
}

/** 세션 결과 */
export interface TouchSessionResult {
  id: string;
  date: string;
  mode: ExerciseMode;
  targetLevel: VelocityLevel;
  bpm: number | null;          // 메트로놈 OFF면 null
  durationMs: number;
  overallStats: SegmentStats;
  fingerStats?: FingerStat[];  // 모드 2에서만
  chordStats?: ChordBalanceStat[];  // 모드 3에서만
  noteEvents: NoteEvent[];     // 전체 기록 (재생/분석용)
}

/** 모듈 저장 데이터 */
export interface TouchDynamicsModuleData {
  sessions: TouchSessionResult[];
  settings: TouchDynamicsSettings;
}

export interface TouchDynamicsSettings {
  defaultMode: ExerciseMode;
  defaultLevel: VelocityLevel;
  defaultBpm: number;
  showFingerGuide: boolean;    // 다음에 칠 손가락 번호 가이드 표시
  uniformityThresholds: {      // σ 기준값 (커스터마이즈 가능)
    good: number;              // 기본 8
    ok: number;                // 기본 15
  };
  timingThresholds: {          // 오프셋 기준값
    good: number;              // 기본 20ms
    ok: number;                // 기본 50ms
  };
}
```

### UserData 확장

```typescript
// shared/types/app.ts의 UserData.modules에 추가
modules: {
  voicing: VoicingModuleData;
  voicingMap?: VoicingMapModuleData;
  touchDynamics?: TouchDynamicsModuleData;  // ← 추가
};
```

---

## shared 활용/변경 사항

### 재사용하는 것 (변경 없음)
- `shared/utils/midi.ts` — MidiManager (noteOn 이벤트에서 velocity, timestamp 수집)
- `shared/utils/metronome.ts` — MetronomeEngine (비트 타이밍 기준점 제공)
- `shared/hooks/useMetronome.ts` — 메트로놈 React 래퍼
- `shared/hooks/useMidi.ts` — MIDI React 래퍼
- `shared/components/PianoKeyboard.tsx` — 건반 시각화 (모드 2, 3, 4에서 사용)
- `shared/components/MetronomeVisual.tsx` — 박자 표시
- `shared/components/MidiStatus.tsx` — MIDI 연결 상태

### 확인 필요
- `shared/utils/midi.ts`의 MidiNote 타입에 velocity가 포함되어 있는지 확인.
  포함되어 있으면 그대로 사용. 없으면 추가 필요.
- `shared/hooks/useMidi.ts`의 onNoteOn 콜백이 velocity를 전달하는지 확인.

### 변경 사항
- `shared/types/app.ts` — UserData.modules에 touchDynamics 필드 추가
- `shared/utils/storage.ts` — 기본값에 touchDynamics 초기 데이터 추가
- `App.tsx` — 라우트 추가
- `ModuleNav` — 메뉴 항목 추가

---

## 핵심 로직 상세

### 벨로시티 수집 (`useVelocityTracker`)

```
역할: MIDI noteOn 이벤트에서 velocity를 수집하고 실시간 통계를 계산한다.

상태:
- events: NoteEvent[] — 전체 기록
- recentWindow: NoteEvent[] — 최근 N개 (통계 계산용, 기본 16)
- currentStats: SegmentStats — 현재 윈도우의 통계

동작:
- useMidi의 onNoteOn 콜백에 연결
- noteOn 들어올 때마다:
  1. NoteEvent 생성 (midiNote, velocity, timestamp)
  2. events에 추가
  3. recentWindow 갱신 (최근 N개 유지)
  4. currentStats 재계산 (mean, σ, range)
  5. 목표 velocity 대비 판정 (good/ok/bad)

통계 계산:
- mean = Σ(velocity) / count
- σ = √(Σ(v - mean)² / count)
- range = max(velocity) - min(velocity)
```

### 타이밍 수집 (`useTimingTracker`)

```
역할: 메트로놈 비트 기준으로 각 타건의 타이밍 오프셋을 계산한다.

의존: useMetronome (비트 타이밍 정보)

동작:
- noteOn 타이밍(performance.now())과 가장 가까운 비트 타이밍을 비교
- 비트 타이밍은 메트로놈의 onBeat 콜백에서 기록

오프셋 계산:
  서브디비전을 고려한다.
  8분음표 모드면 비트 사이의 중간점도 기준점으로 포함.

  예: 60 BPM 4/4, 8분음표 기준
  비트 간격 = 1000ms (4분음표)
  기준점 간격 = 500ms (8분음표)
  타건이 1023ms에 왔고 가장 가까운 기준점이 1000ms면 → 오프셋 = +23ms (dragging)

통계:
- meanOffset: 전체 오프셋 평균 (음수=rushing, 양수=dragging)
- timingStdDev: 오프셋의 표준편차 (일관성)
```

### 다이나믹 커브 생성 (`dynamicCurve.ts`)

```
역할: 모드 5에서 목표 velocity 커브를 시간 축으로 생성한다.

입력: DynamicPattern, BPM, 마디 수
출력: Array<{ time: number, targetVelocity: number }>

예: crescendo, 60 BPM, 4마디
  16비트 (4마디 × 4박)에 걸쳐 velocity 20 → 100으로 선형 증가
  [{time: 0, target: 20}, {time: 1000, target: 25}, ...]

실제 연주 velocity를 이 커브와 비교하여 얼마나 가까운지 판정.
```

---

## 시각적 피드백 상세

### VelocityBarChart

최근 N타건의 velocity를 세로 막대로 표시한다. 새 타건이 들어올 때마다 오른쪽에 추가되고 왼쪽이 빠진다 (슬라이딩 윈도우).

```
  127│
     │      ┃
  100│  ┃   ┃       ┃
     │  ┃   ┃   ┃   ┃
   80│──┃───┃───┃───┃── 목표 상한 (mf+15)
     │  ┃   ┃   ┃   ┃
   60│──┃───┃───┃───┃── 목표 (mf=80)
     │  ┃       ┃
   40│──────────────── 목표 하한 (mf-15)
     │
    0│
     └─────────────────
       1   2   3   4   (최근 타건)
```

- 목표 범위 안: 막대 초록
- 목표 범위 밖: 막대 빨강
- 현재 σ를 실시간 숫자로 표시

### TimingOffsetChart

가로축이 시간, 세로축이 오프셋(ms). 0ms 라인이 중앙.

```
  +50ms│         ●
       │     ●
    0ms│──●───────●──── (정확한 타이밍)
       │              ●
  -50ms│  ●
       └──────────────── 시간 →
```

- 0ms 근처(±20ms): 점 초록
- 벗어남(±20~50ms): 점 노랑
- 크게 벗어남(±50ms+): 점 빨강
- rushing(음수) / dragging(양수) 경향을 화살표나 텍스트로 표시

### DynamicCurve

목표 커브(선)와 실제 velocity(점)를 오버레이한다.

```
  100│          ╱── 목표 커브
     │        ╱  ●
   80│      ╱ ●
     │    ╱●
   60│  ╱
     │╱  ●
   20│●
     └──────────────── 시간 →
       1   2   3   4   (마디)
```

---

## 완료 기준

- 모든 5개 모드에서 MIDI 입력을 받아 벨로시티/타이밍 통계가 실시간 계산된다
- 벨로시티 바 차트가 타건마다 즉시 업데이트된다
- 메트로놈과 동기화된 타이밍 오프셋이 정확히 계산된다
- 다이나믹 커브와 실제 연주를 오버레이로 비교할 수 있다
- 세션 결과가 저장되고 이전 기록과 비교할 수 있다
- 기존 모듈(보이싱, voicing-map)에 영향 없음
