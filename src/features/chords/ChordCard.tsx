import { useMemo } from 'react';
import type { NoteName, ChordQuality, VoicingMode } from '../../types/music';
import { chordSymbol } from '../../data/chords';
import { buildBasicVoicing, buildDrop2Voicing } from '../../lib/music/voicingEngine';
import { getChordDegreeLabels } from '../../lib/music/chordBuilder';
import GrandStaff from '../../components/notation/GrandStaff';
import PianoKeyboard from '../../components/piano/PianoKeyboard';
import type { NoteHighlight } from '../../components/piano/PianoKeyboard';

interface ChordCardProps {
	root: NoteName;
	quality: ChordQuality;
	voicingMode: VoicingMode;
}

const DEGREE_COLORS: Record<string, string> = {
	'1': '#ef4444',
	'3': '#f97316',
	'\u266D3': '#f97316',
	'5': '#eab308',
	'\u266D5': '#eab308',
	'7': '#22c55e',
	'\u266D7': '#22c55e',
	'\u266D\u266D7': '#22c55e',
	'6': '#22c55e',
	'4': '#f97316',
	'9': '#8b5cf6',
	'11': '#06b6d4',
	'13': '#ec4899',
};

export default function ChordCard({ root, quality, voicingMode }: ChordCardProps) {
	const voicing = useMemo(() => (voicingMode === 'drop2' ? buildDrop2Voicing(root, quality) : buildBasicVoicing(root, quality)), [root, quality, voicingMode]);

	const degreeLabels = getChordDegreeLabels(quality);

	const highlights = useMemo<NoteHighlight[]>(() => {
		const all = [...voicing.leftHand, ...voicing.rightHand];
		return all.map((p, i) => {
			const label = i < voicing.leftHand.length ? (i === 0 ? '1' : 'D2') : (degreeLabels[i - voicing.leftHand.length] ?? '');
			return {
				note: p.name,
				octave: p.octave,
				color: DEGREE_COLORS[label] ?? '#93c5fd',
				label,
			};
		});
	}, [voicing, degreeLabels]);

	const grandStaffChords = useMemo(
		() => [
			{
				treble: voicing.rightHand,
				bass: voicing.leftHand,
			},
		],
		[voicing],
	);

	// Dynamically compute keyboard range to cover all voicing notes
	const { kbStart, kbOctaves } = useMemo(() => {
		const allNotes = [...voicing.leftHand, ...voicing.rightHand];
		const minOct = Math.min(...allNotes.map((p) => p.octave));
		const maxOct = Math.max(...allNotes.map((p) => p.octave));
		return { kbStart: minOct, kbOctaves: Math.max(2, maxOct - minOct + 1) };
	}, [voicing]);

	return (
		<div className="bg-white border border-gray-200 rounded-xl p-3 hover:shadow-sm transition-shadow">
			<div className="font-semibold text-center mb-2 text-gray-800">{chordSymbol(root, quality)}</div>
			<div className="flex flex-col items-center gap-2">
				<GrandStaff chords={grandStaffChords} width={180} height={180} staveWidth={140} />
				<PianoKeyboard startOctave={kbStart} octaves={kbOctaves} highlightedNotes={highlights} width={180} />
			</div>
		</div>
	);
}
