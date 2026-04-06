import { useEffect, useMemo, useRef, useState } from 'react'

function formatDelta(value) {
	const sign = value > 0 ? '+' : ''
	return `${sign}${value.toFixed(3)}`
}

function getGapState(gap, threshold) {
	if (typeof threshold !== 'number') return 'neutral'
	if (gap <= threshold) return 'good'
	if (gap <= threshold + 0.04) return 'warn'
	return 'bad'
}

function MetricsRow({
	mission,
	result,
	previousResult,
	winThreshold = 0.8,
	stretchThreshold = 0.9,
	gapThreshold = null,
	missionStatus,
	score = 0,
	scoreBreakdownLabels = [],
}) {
	const train = result?.finalTrainLoss ?? 0
	const val = result?.finalValLoss ?? 0
	const acc = result?.finalAccuracy ?? 0

	const prevTrain = previousResult?.finalTrainLoss ?? train
	const prevAcc = previousResult?.finalAccuracy ?? acc
	const prevVal = previousResult?.finalValLoss ?? val

	const trainDelta = prevTrain - train
	const valDelta = prevVal - val
	const accPct = acc * 100
	const accProgress = Math.min(100, (acc / winThreshold) * 100)
	const gap = val - train
	const includeGap = ['memorizer', 'symmetrybreaker', 'batcheffect'].includes(mission?.id) || typeof gapThreshold === 'number'
	const gapState = getGapState(gap, gapThreshold)
	const hasWonMission = Boolean(missionStatus?.won)
	const hasStretch = Boolean(missionStatus?.stretch)
	const bestLabel = useMemo(() => {
		if (!scoreBreakdownLabels.length) return null
		return scoreBreakdownLabels.reduce((best, current) => (current.value > (best?.value ?? -Infinity) ? current : best), null)
	}, [scoreBreakdownLabels])

	// Animated score counter
	const [displayScore, setDisplayScore] = useState(score)
	const rafRef = useRef()

	useEffect(() => {
		if (displayScore === score) return
		let start = null
		const initial = displayScore
		const delta = score - initial
		function animate(ts) {
			if (!start) start = ts
			const elapsed = ts - start
			const pct = Math.min(1, elapsed / 600)
			setDisplayScore(Math.round(initial + delta * pct))
			if (pct < 1) rafRef.current = requestAnimationFrame(animate)
			else setDisplayScore(score)
		}
		rafRef.current = requestAnimationFrame(animate)
		return () => rafRef.current && cancelAnimationFrame(rafRef.current)
		// eslint-disable-next-line
	}, [score])

	return (
		<>
			<div className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${includeGap ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
				<div className="rounded-2xl border border-white/5 bg-bg2/50 backdrop-blur-md p-4 shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(34,211,238,0.1)] hover:bg-bg2/70 hover:border-white/10">
					<div className="text-[11px] uppercase tracking-[0.08em] text-text2">Train Loss</div>
					<div className="font-mono text-[20px] text-accent">{train.toFixed(3)}</div>
					<div className={`text-xs ${trainDelta >= 0 ? 'text-green' : 'text-red'}`}>
						{trainDelta >= 0 ? 'improved ' : 'worse '}
						{formatDelta(trainDelta)}
					</div>
				</div>

				<div className="rounded-2xl border border-white/5 bg-bg2/50 backdrop-blur-md p-4 shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(34,211,238,0.1)] hover:bg-bg2/70 hover:border-white/10">
					<div className="text-[11px] uppercase tracking-[0.08em] text-text2">Val Loss</div>
					<div className={`font-mono text-[20px] ${gap > 0.1 ? 'text-amber' : 'text-green'}`}>{val.toFixed(3)}</div>
					<div className={`text-xs ${valDelta >= 0 ? 'text-green' : 'text-red'}`}>
						{valDelta >= 0 ? 'improved ' : 'worse '}
						{formatDelta(valDelta)}
					</div>
				</div>

				<div className="rounded-2xl border border-white/5 bg-bg2/50 backdrop-blur-md p-4 shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(34,211,238,0.1)] hover:bg-bg2/70 hover:border-white/10">
					<div className="text-[11px] uppercase tracking-[0.08em] text-text2">Accuracy</div>
					<div className={`font-mono text-[20px] ${hasWonMission || acc >= winThreshold ? 'text-green' : 'text-accent'}`}>
						{accPct.toFixed(1)}%
					</div>
					<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg4">
						<div className={`h-full rounded-full ${hasStretch ? 'bg-pink' : 'bg-green'}`} style={{ width: `${accProgress}%` }} />
					</div>
					<div className="mt-1 text-xs text-text2">
						{hasStretch
							? `stretch reached (${(stretchThreshold * 100).toFixed(0)}%)`
							: hasWonMission
								? `win reached (${(winThreshold * 100).toFixed(0)}%)`
								: ((acc - prevAcc) * 100 >= 0 ? '+' : '') + ((acc - prevAcc) * 100).toFixed(1) + '% vs prev'}
					</div>
				</div>

				{includeGap && (
					<div className="rounded-2xl border border-white/5 bg-bg2/50 backdrop-blur-md p-4 shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(34,211,238,0.1)] hover:bg-bg2/70 hover:border-white/10">
						<div className="text-[11px] uppercase tracking-[0.08em] text-text2">Gap</div>
						<div
							className={`font-mono text-[20px] ${gapState === 'good' ? 'text-green' : gapState === 'warn' ? 'text-amber' : gapState === 'bad' ? 'text-red' : 'text-text0'
								}`}
						>
							{gap.toFixed(3)}
						</div>
						<div className="mt-1 text-xs text-text2">
							{typeof gapThreshold === 'number'
								? gap <= gapThreshold
									? `on target (< ${(gapThreshold * 100).toFixed(0)}%)`
									: `target < ${(gapThreshold * 100).toFixed(0)}%`
								: 'monitor train vs val separation'}
						</div>
					</div>
				)}

				<div className="rounded-2xl border border-white/5 bg-bg2/50 backdrop-blur-md p-4 shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(34,211,238,0.1)] hover:bg-bg2/70 hover:border-white/10">
					<div className="text-[11px] uppercase tracking-[0.08em] text-text2">Score</div>
					<div className="font-mono text-[20px] text-pink">{displayScore}</div>
					<div className="text-xs text-text2">{bestLabel ? `${bestLabel.label} led the gain` : 'Run summary'}</div>
				</div>
			</div>

			{scoreBreakdownLabels.length > 0 && (
				<div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
					{scoreBreakdownLabels.map((item) => (
						<div key={item.key} className="rounded-xl border border-white/5 bg-bg1/60 backdrop-blur-sm px-3 py-2 shadow-sm">
							<div className="text-[10px] uppercase tracking-[0.08em] text-text2">{item.label}</div>
							<div className={`font-mono text-sm ${item.value >= 0 ? 'text-text0' : 'text-red'}`}>{item.value}</div>
						</div>
					))}
				</div>
			)}
		</>
	)
}

export default MetricsRow
