import MetronomeWidget from '../../components/metronome/MetronomeWidget';
import { useModuleMetronome } from './useModuleMetronome';

export default function MetronomePage() {
  useModuleMetronome('metronome');

  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">Metronome</h1>
      <MetronomeWidget />
    </div>
  );
}
