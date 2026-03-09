import { Link } from 'react-router-dom';

const modules = [
  {
    to: '/metronome',
    title: 'Metronome',
    description: 'BPM 40-200, 다양한 박자 지원',
    icon: '🎵',
  },
  {
    to: '/chords',
    title: 'Chord Cheat Sheet',
    description: '7th 코드 검색, 오선지 + 건반 표시, 보이싱 토글',
    icon: '🎹',
  },
  {
    to: '/two-five-one',
    title: 'II-V-I Practice',
    description: '12키 보이싱 연습, 반음 하행/랜덤 모드',
    icon: '🔄',
  },
  {
    to: '/jazz-hanon',
    title: 'Jazz Hanon',
    description: '코드 구성음 아르페지오 패턴 연습',
    icon: '🎼',
  },
  {
    to: '/chord-detect',
    title: 'Chord Detector',
    description: '마이크로 코드 실시간 인식',
    icon: '🎤',
  },
  {
    to: '/chord-sense',
    title: 'Chord Sense',
    description: '향상된 코드 인식 (Guitar/Piano 모드)',
    icon: '🎧',
  },
  {
    to: '/humming',
    title: 'Humming',
    description: '허밍으로 멜로디 → MIDI 변환',
    icon: '🎙️',
  },
];

export default function HomePage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Piano Steps</h1>
      <p className="text-gray-500 mb-6">Jazz Piano Practice Tool</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modules.map(mod => (
          <Link
            key={mod.to}
            to={mod.to}
            className="block p-5 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="text-2xl mb-2">{mod.icon}</div>
            <h2 className="font-semibold text-gray-800 mb-1">{mod.title}</h2>
            <p className="text-sm text-gray-500">{mod.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
