# Touch Dynamics 모듈 — Claude Code 작업 가이드

> 이 문서는 Claude Code에게 단계별로 프롬프트를 전달하기 위한 가이드입니다.
> 각 Step의 프롬프트를 복사하여 Claude Code에 전달하세요.
> 각 Step 완료 후 `npm run build` 성공을 확인하고 다음으로 넘어갑니다.

---

## 사전 준비

Claude Code에게 첫 메시지로 컨텍스트를 잡아줍니다:

```
이 프로젝트에 새 모듈을 추가할 거야.

먼저 아래 문서를 읽어줘:
- touch-dynamics-module-spec.md (모듈 스펙)
- 이 가이드 (touch-dynamics-claude-code-guide.md)

그리고 기존 코드를 파악해줘:
- CLAUDE.md (프로젝트 규칙)
- SPEC.md (기존 모듈 스펙)
- shared/utils/midi.ts (MIDI 매니저 — velocity 포함 여부 확인)
- shared/hooks/useMidi.ts (MIDI 훅 — onNoteOn 콜백 시그니처 확인)
- shared/types/app.ts (UserData 구조 확인)

다 읽었으면 알려줘.
```

---

## Step 1: 타입 + 상수 + shared 확장

```
touch-dynamics-module-spec.md의 디렉토리 구조대로 features/touch-dynamics/ 디렉토리를 생성하고, 다음을 구현해줘.

1. features/touch-dynamics/types/touchDynamics.ts
   - 스펙 문서의 "데이터 모델" 섹션 그대로 구현
   - VelocityLevel, ExerciseMode, DynamicPattern, NoteEvent, SegmentStats,
     FingerStat, ChordBalanceStat, TouchSessionResult, TouchDynamicsModuleData,
     TouchDynamicsSettings, VELOCITY_TARGETS, VELOCITY_TOLERANCE

2. features/touch-dynamics/constants/velocityLevels.ts
   - 벨로시티 레벨별 라벨 정의 (1=pp, 2=p, 3=mp, 4=mf, 5=f)
   - 레벨별 색상 정의 (UI용)

3. features/touch-dynamics/constants/exercisePresets.ts
   - 모드별 기본 설정값 (반복 횟수, BPM 등)

4. shared/types/app.ts 수정
   - UserData.modules에 touchDynamics?: TouchDynamicsModuleData 추가

5. shared/utils/storage.ts 수정
   - 기본값에 touchDynamics 초기 데이터 추가

6. shared/utils/midi.ts 확인
   - MidiNote 타입에 velocity가 포함되어 있는지 확인
   - onNoteOn 콜백이 velocity를 전달하는지 확인
   - 없으면 추가 (기존 모듈에 영향 없도록)

npm run build 성공 확인.
```

---

## Step 2: 벨로시티 분석 유틸

```
features/touch-dynamics/utils/velocityAnalysis.ts를 구현해줘.

순수 함수로 구현한다. 상태를 갖지 않는다.

함수 목록:

1. calcSegmentStats(events: NoteEvent[]): SegmentStats
   - velocity 배열에서 mean, σ, min, max, range 계산
   - events가 비어있으면 모두 0 반환

2. judgeUniformity(stdDev: number, thresholds: { good: number, ok: number }): 'good' | 'ok' | 'bad'
   - σ < good → 'good'
   - σ < ok → 'ok'
   - 그 외 → 'bad'

3. calcFingerStats(events: NoteEvent[], scaleStartNote: number): FingerStat[]
   - scaleStartNote 기준으로 5도 범위의 음을 1~5번 손가락에 매핑
   - 손가락별 평균 velocity와 σ 계산

4. calcChordBalance(events: NoteEvent[], windowMs: number): ChordBalanceStat
   - windowMs(기본 50ms) 안에 들어온 노트를 하나의 코드로 묶음
   - 코드 내 velocity 배열, simultaneity(최초~최후 타건 간 ms), range 반환

5. isInTargetRange(velocity: number, level: VelocityLevel): boolean
   - VELOCITY_TARGETS[level] ± VELOCITY_TOLERANCE[level] 범위 안인지

npm run build 성공 확인.
```

---

## Step 3: 타이밍 분석 유틸

```
features/touch-dynamics/utils/timingAnalysis.ts를 구현해줘.

순수 함수로 구현한다.

함수 목록:

1. calcBeatOffsets(events: NoteEvent[], beatTimestamps: number[], subdivision: number): NoteEvent[]
   - 각 event에 beatOffset(ms) 값을 계산하여 추가
   - subdivision: 1 = 4분음표 기준, 2 = 8분음표 기준, 3 = 셋잇단 기준, 4 = 16분음표 기준
   - beatTimestamps 사이를 subdivision으로 나누어 기준점 생성
   - 각 event.timestamp에서 가장 가까운 기준점과의 차이가 beatOffset
   - 음수 = rushing (빠름), 양수 = dragging (느림)

2. calcTimingStats(events: NoteEvent[]): { meanOffset: number, stdDev: number, tendency: 'rushing' | 'dragging' | 'stable' }
   - beatOffset이 있는 이벤트들의 평균, σ 계산
   - meanOffset < -10ms → 'rushing', > 10ms → 'dragging', 그 외 → 'stable'

3. judgeTimingAccuracy(meanOffsetAbs: number, thresholds: { good: number, ok: number }): 'good' | 'ok' | 'bad'
   - < good → 'good'
   - < ok → 'ok'
   - 그 외 → 'bad'

npm run build 성공 확인.
```

---

## Step 4: 다이나믹 커브 유틸

```
features/touch-dynamics/utils/dynamicCurve.ts를 구현해줘.

함수 목록:

1. generateTargetCurve(pattern: DynamicPattern, bpm: number, measures: number): Array<{ time: number, targetVelocity: number }>
   - 패턴에 따라 시간→목표velocity 배열 생성
   - 비트 단위로 포인트 생성 (4/4 기준 measures × 4개 포인트)
   - 'pp-f-alternate': 4마디 pp(20) → 4마디 f(100) 반복
   - 'crescendo': 전체에 걸쳐 20 → 100 선형 증가
   - 'decrescendo': 100 → 20 선형 감소
   - 'crescendo-decrescendo': 전반 20→100, 후반 100→20

2. calcCurveDeviation(actual: NoteEvent[], curve: Array<{ time: number, targetVelocity: number }>): number
   - 실제 velocity와 목표 커브 간의 평균 편차 반환
   - 각 actual event의 timestamp에 해당하는 목표 velocity를 커브에서 보간(interpolation)
   - |actual.velocity - interpolated target| 의 평균

npm run build 성공 확인.
```

---

## Step 5: 커스텀 훅

```
features/touch-dynamics/hooks/ 아래 훅 3개를 구현해줘.

1. useVelocityTracker.ts
   반환: { events, recentEvents, currentStats, isInRange, reset }
   - useMidi의 onNoteOn에 연결
   - 매 noteOn마다 NoteEvent 생성, events에 추가
   - recentEvents: 최근 16개 유지 (슬라이딩 윈도우)
   - currentStats: recentEvents 기반 SegmentStats 실시간 계산
   - isInRange: 마지막 타건이 목표 범위 안인지
   - reset(): 초기화

2. useTimingTracker.ts
   반환: { eventsWithTiming, timingStats, reset }
   - useMetronome에서 비트 타이밍을 수집 (onBeat 콜백에서 timestamp 기록)
   - useVelocityTracker의 events를 받아서 beatOffset 계산
   - timingStats: { meanOffset, stdDev, tendency } 실시간 계산

3. useTouchSession.ts
   반환: { mode, phase, startSession, stopSession, sessionResult, settings, updateSettings }
   - phase: 'idle' | 'practicing' | 'complete'
   - startSession(mode, settings)으로 세션 시작
   - 메트로놈 시작, MIDI 수집 시작
   - stopSession()으로 종료 → sessionResult 생성
   - useAppData를 통해 결과 저장

npm run build 성공 확인.
```

---

## Step 6: 차트 컴포넌트

```
features/touch-dynamics/components/ 아래 차트 컴포넌트를 구현해줘.

기존 프로젝트의 다크 테마와 Tailwind 스타일을 따른다.
차트는 SVG로 직접 그린다 (외부 차트 라이브러리 사용하지 않음).

1. VelocityBarChart.tsx
   Props: events: NoteEvent[], targetLevel: VelocityLevel, maxBars?: number(기본 16)
   - 최근 maxBars개의 velocity를 세로 막대로 표시
   - 목표 범위를 반투명 밴드로 표시
   - 범위 안 막대: 초록(emerald-500), 밖: 빨강(red-500)
   - 현재 σ 수치를 우상단에 표시
   - 새 타건마다 자연스럽게 업데이트 (애니메이션은 간단하게)

2. TimingOffsetChart.tsx
   Props: events: NoteEvent[] (beatOffset 포함), maxDots?: number(기본 32)
   - 가로축: 시간(이벤트 순서), 세로축: 오프셋(ms)
   - 0ms 라인을 중앙에 가로로 표시
   - ±20ms 범위: 초록 점, ±20~50ms: 노랑 점, ±50ms+: 빨강 점
   - rushing/dragging 경향을 텍스트로 표시

3. DynamicCurve.tsx
   Props: targetCurve: Array<{ time, targetVelocity }>, actualEvents: NoteEvent[]
   - 목표 커브: 회색 실선
   - 실제 velocity: 점으로 표시 (목표 근처면 초록, 벗어나면 빨강)
   - 차이가 큰 구간을 시각적으로 강조

4. TargetBand.tsx
   Props: level: VelocityLevel
   - 현재 목표 레벨, 목표 velocity, 허용 범위를 한 줄로 표시
   - 예: "mf — 목표 80 (65~95)"

npm run build 성공 확인.
```

---

## Step 7: 모드별 연습 컴포넌트

```
features/touch-dynamics/components/ 아래 모드별 컴포넌트를 구현해줘.

1. ModeSelector.tsx
   Props: currentMode, onSelect
   - 5개 모드를 카드 또는 탭으로 표시
   - 각 모드의 아이콘, 이름, 한줄 설명

2. SingleRepeatMode.tsx
   - 모드 1: 단음 반복
   - 상단: TargetBand (목표 레벨)
   - 중앙: VelocityBarChart (실시간)
   - 하단: 현재 통계 (σ, 판정)
   - 메트로놈 ON이면 TimingOffsetChart도 표시

3. SequentialMode.tsx
   - 모드 2: 연속 음
   - 건반 시각화 (PianoKeyboard): 다음에 쳐야 할 음 하이라이트
   - VelocityBarChart
   - 손가락 전환 지점 마커
   - FingerStats 컴포넌트: 손가락별 평균 velocity 비교

4. ChordBalanceMode.tsx
   - 모드 3: 코드 균일
   - 건반 시각화: 코드 구성음 하이라이트
   - 코드 내 velocity 비교 바 (각 음의 velocity를 나란히 표시)
   - simultaneity 표시 (동시성)

5. ArpeggioMode.tsx
   - 모드 4: 아르페지오 균일
   - 건반 시각화: 아르페지오 음 순서
   - VelocityBarChart + TimingOffsetChart 동시 표시
   - 코드 전환 지점 마커

6. DynamicRangeMode.tsx
   - 모드 5: 다이나믹 컨트롤
   - DynamicCurve (목표 + 실제 오버레이)
   - 패턴 선택 버튼 (pp↔f, crescendo, decrescendo, 양쪽)

7. SessionSummary.tsx
   Props: result: TouchSessionResult
   - 세션 결과 요약
   - 전체 σ, 타이밍 정확도, 판정
   - "이전 세션 대비" 비교 (있으면)

npm run build 성공 확인.
```

---

## Step 8: 페이지 + 라우팅 + 네비게이션

```
1. features/touch-dynamics/pages/TouchDynamicsPage.tsx를 구현해줘.
   - 상단: ModeSelector
   - 중앙: 선택된 모드에 따라 해당 모드 컴포넌트 렌더링
   - 설정 패널: 목표 레벨, BPM, 메트로놈 ON/OFF
   - [세션 시작] / [세션 종료] 버튼
   - 세션 완료 시 SessionSummary 표시
   - MidiStatus 표시 (MIDI 미연결 시 안내)

2. App.tsx에 /touch-dynamics 라우트 추가

3. ModuleNav에 "터치 다이나믹스" 메뉴 항목 추가

4. CLAUDE.md 업데이트
   - 디렉토리 구조에 features/touch-dynamics/ 추가
   - 라우팅 테이블에 /touch-dynamics 추가

npm run build 성공 확인.
```

---

## Step 9: 통합 테스트 + 마무리

```
다음을 확인하고 수정해줘:

1. MIDI 연결 후 아무 건반을 치면 모드 1에서 벨로시티 바 차트가 실시간 업데이트되는지
2. 메트로놈 ON 상태에서 타이밍 오프셋 차트가 표시되는지
3. 모드 전환 시 상태가 정상 초기화되는지
4. 세션 시작 → 연습 → 세션 종료 → 결과 표시 → 저장 플로우가 정상 동작하는지
5. MIDI 미연결 시 적절한 안내가 표시되는지
6. 기존 모듈(보이싱, voicing-map)이 정상 동작하는지 (사이드 이펙트 없음 확인)

문제가 있으면 수정.
npm run build 성공 확인.
```

---

## 트러블슈팅

### MIDI velocity가 항상 같은 값으로 들어올 때
일부 MIDI 키보드는 벨로시티 감도 설정이 필요하다. 앱 문제가 아니라 키보드 설정 문제일 수 있다. MidiStatus 컴포넌트에 "벨로시티가 고정된 것 같습니다. 키보드의 벨로시티 감도 설정을 확인하세요." 안내를 추가할 것.

### 메트로놈 타이밍과 MIDI 타이밍 기준이 다를 때
MetronomeEngine은 AudioContext.currentTime 기반이고, MIDI noteOn은 performance.now() 기준이다. 두 시간축을 맞추려면 세션 시작 시 두 타이머의 오프셋을 한 번 계산해서 보정해야 한다.

### 차트가 타건마다 전체 리렌더되어 느릴 때
VelocityBarChart는 최근 N개만 표시하므로 데이터가 많아져도 렌더링 부하가 일정해야 한다. 그래도 느리면 React.memo + useMemo로 최적화.
