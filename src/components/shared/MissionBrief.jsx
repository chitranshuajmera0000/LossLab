import { useState } from 'react'
import { ChevronDown, CheckCircle, Star } from 'lucide-react'
import { motion as Motion, AnimatePresence } from 'framer-motion'

function ProgressBar({ value, max }) {
	const pct = Math.min(100, (value / max) * 100)
	return (
		<div className="w-full h-2 bg-bg3 rounded mt-1 overflow-hidden">
			<div className="h-2 bg-accent" style={{ width: pct + '%' }} />
		</div>
	)
}

function MissionBrief({ mission, progress }) {
	const [open, setOpen] = useState(false)
	if (!mission) return null

	// Collapsed state: pill, title, best accuracy, win/stretch icons
	const collapsed = (
		<div className="flex items-center gap-3 px-3 py-2">
			<span className="bg-accent text-white text-xs px-2 py-0.5 rounded font-mono">#{mission.number}</span>
			<span className="font-bold text-sm">{mission.title}</span>
			{progress?.bestAccuracy !== undefined && (
				<span className="text-xs text2">Best: {(progress.bestAccuracy * 100).toFixed(1)}%</span>
			)}
			{progress?.winAchieved && <CheckCircle size={16} className="text-green-500 ml-2" title="Win achieved" />}
			{progress?.stretchAchieved && <Star size={16} className="text-yellow-400 ml-1" title="Stretch achieved" />}
		</div>
	)

	// Expanded state: full details
	const expanded = (
		<Motion.div
			key="expanded"
			initial={{ opacity: 0, height: 0 }}
			animate={{ opacity: 1, height: 'auto' }}
			exit={{ opacity: 0, height: 0 }}
			className="overflow-hidden"
		>
			<div className="border-t border-white/10 px-4 py-4 text-sm text-text1 space-y-3 bg-black/10">
				<div>{mission.description}</div>
				<div className="flex gap-2 flex-wrap items-center">
					<span className="bg-bg3 text2 text-xs rounded px-2 py-0.5">Dataset: {mission.dataset}</span>
					<span className="bg-bg3 text2 text-xs rounded px-2 py-0.5">Time: {mission.timeLimit} min</span>
				</div>
				<div className="flex gap-4 items-center">
					<span className="font-semibold text-xs">Win:</span>
					<span className="text-xs">{mission.winCondition}</span>
					{progress?.winAchieved && <CheckCircle size={16} className="text-green-500 ml-2" title="Win achieved" />}
				</div>
				<div className="flex gap-4 items-center">
					<span className="font-semibold text-xs">Stretch:</span>
					<span className="text-xs">{mission.stretchGoal}</span>
					{progress?.stretchAchieved && <Star size={16} className="text-yellow-400 ml-2" title="Stretch achieved" />}
				</div>
				<div className="italic text2 text-xs opacity-80">Hint: {mission.hint}</div>
				<div className="flex items-center gap-2 mt-2">
					<span className="font-mono text-xs">Run {progress?.runsUsed || 1} of {mission.maxRuns}</span>
					<ProgressBar value={progress?.runsUsed || 1} max={mission.maxRuns} />
				</div>
			</div>
		</Motion.div>
	)

	return (
		<section className="rounded-2xl border border-white/10 bg-bg1/60 backdrop-blur-xl shadow-lg transition-all duration-300 overflow-hidden">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center justify-between px-3 py-2 text-left"
			>
				<div className="flex-1 flex items-center gap-2">
					<span className="text-xs uppercase tracking-[0.1em] text-text2">Mission Brief</span>
				</div>
				<ChevronDown
					size={16}
					className={`text-text2 transition ${open ? 'rotate-180' : ''}`}
				/>
			</button>
			{/* Collapsed summary always visible */}
			{collapsed}
			<AnimatePresence>{open && expanded}</AnimatePresence>
		</section>
	)
}

export default MissionBrief
