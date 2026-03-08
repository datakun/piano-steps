interface BeatIndicatorProps {
  totalBeats: number;
  currentBeat: number;
  isPlaying: boolean;
}

export default function BeatIndicator({ totalBeats, currentBeat, isPlaying }: BeatIndicatorProps) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: totalBeats }, (_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full transition-all duration-75 ${
            isPlaying && currentBeat === i
              ? i === 0
                ? 'bg-red-500 scale-125'
                : 'bg-blue-500 scale-125'
              : 'bg-gray-300'
          }`}
        />
      ))}
    </div>
  );
}
