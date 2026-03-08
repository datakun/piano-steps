import MetronomeWidget from '../../components/metronome/MetronomeWidget';
import { useModuleMetronome } from './useModuleMetronome';

export default function MetronomePage() {
  useModuleMetronome('metronome');

  return (
    <div className="max-w-lg mx-auto">
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-3">
        <h1 className="text-lg font-bold">Metronome</h1>
      </div>
      <div className="px-4 md:px-6 pb-6">
        <MetronomeWidget />
      </div>
    </div>
  );
}
