function polarPoint(cx, cy, radius, angleDeg) {
	const angle = ((angleDeg - 90) * Math.PI) / 180
	return {
		x: cx + radius * Math.cos(angle),
		y: cy + radius * Math.sin(angle),
	}
}

function getExplorationRequirement(mission) {
	if (mission?.explorationRequirement) return mission.explorationRequirement
	if (mission?.id === 'slowlearner') return { key: 'optimizer', count: 3, label: 'Optimizers tried' }
	if (mission?.id === 'batcheffect') return { key: 'batchSize', count: 4, label: 'Batch sizes tried' }
	return null
}

function listUniqueRunValues(allRuns, key) {
	return [...new Set(allRuns.map((run) => run.config?.[key]).filter((value) => value !== undefined && value !== null))]
}

function ProgressCompass({
	mission,
	result,
	allRuns = [],
	insight = '',
	missionStatus,
	winThreshold = 0.8,
	stretchThreshold = 0.9,
}) {
	const bestAccuracy = allRuns.length > 0 ? Math.max(...allRuns.map((run) => run.finalAccuracy || 0)) : 0
	const accuracy = result?.finalAccuracy ?? 0
	const gap = Math.max(0, (result?.finalValLoss ?? 0) - (result?.finalTrainLoss ?? 0))
	const progress = Math.min(100, Math.max(0, Math.round(accuracy * 100)))
	const runCount = allRuns.length
	const status = result?.diverged ? 'unstable' : result?.flatlined ? 'stalled' : result?.plateauEpoch != null ? 'plateau' : 'advancing'
	const requirement = getExplorationRequirement(mission)
	const exploredValues = requirement ? listUniqueRunValues(allRuns, requirement.key) : []
	const remainingExploration = requirement ? Math.max(0, requirement.count - exploredValues.length) : 0

	const circleSize = 96
	const radius = 40
	const circumference = 2 * Math.PI * radius
	const accOffset = circumference - Math.max(0, Math.min(1, accuracy)) * circumference
	const winMarker = polarPoint(circleSize / 2, circleSize / 2, radius, winThreshold * 360)
	const stretchMarker = polarPoint(circleSize / 2, circleSize / 2, radius, stretchThreshold * 360)

	return (
		<div className="rounded-xl border border-border bg-gradient-to-br from-bg1 via-bg1 to-bg2 p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="text-[11px] uppercase tracking-[0.18em] text-text2">Progress compass</div>
					<div className="mt-1 text-lg font-semibold text-text0">{mission?.title || 'Mission'}</div>
				</div>
				<div className="rounded-full border border-border bg-bg0 px-3 py-1 text-xs text-text1">{status}</div>
			</div>

			<div className="mt-4 grid grid-cols-[120px_1fr] gap-4">
				<div className="relative flex items-center justify-center">
					<svg viewBox={`0 0 ${circleSize} ${circleSize}`} className="h-24 w-24">
						<circle cx={circleSize / 2} cy={circleSize / 2} r={radius} fill="none" stroke="#252a40" strokeWidth="7" />
						<circle
							cx={circleSize / 2}
							cy={circleSize / 2}
							r={radius}
							fill="none"
							stroke={missionStatus?.stretch ? '#ef5da8' : '#34d399'}
							strokeWidth="7"
							strokeLinecap="round"
							strokeDasharray={circumference}
							strokeDashoffset={accOffset}
							transform={`rotate(-90 ${circleSize / 2} ${circleSize / 2})`}
						/>
						<circle cx={winMarker.x} cy={winMarker.y} r="2.4" fill="#34d399" />
						<circle cx={stretchMarker.x} cy={stretchMarker.y} r="2.4" fill="#ef5da8" />
						<text x={circleSize / 2} y="48" textAnchor="middle" fontSize="18" fill="#e8eaf6" fontFamily="JetBrains Mono">
							{progress}%
						</text>
						<text x={circleSize / 2} y="62" textAnchor="middle" fontSize="8" fill="#8a90b4" style={{ letterSpacing: '0.08em' }}>
							ACCURACY
						</text>
					</svg>
				</div>

				<div className="space-y-3">
					<div className="rounded-lg border border-border bg-bg0 px-3 py-2">
						<div className="text-[10px] uppercase tracking-[0.12em] text-text2">Best so far</div>
						<div className="font-mono text-sm text-text0">{(bestAccuracy * 100).toFixed(1)}%</div>
						<div className="mt-1 text-[11px] text-text2">
							Win {(winThreshold * 100).toFixed(0)}% | Stretch {(stretchThreshold * 100).toFixed(0)}%
						</div>
					</div>
					<div className="rounded-lg border border-border bg-bg0 px-3 py-2">
						<div className="text-[10px] uppercase tracking-[0.12em] text-text2">Generalization gap</div>
						<div className="font-mono text-sm text-text0">{gap.toFixed(3)}</div>
					</div>
					<div className="rounded-lg border border-border bg-bg0 px-3 py-2">
						<div className="text-[10px] uppercase tracking-[0.12em] text-text2">Runs tried</div>
						<div className="font-mono text-sm text-text0">{runCount}</div>
					</div>
					{requirement && (
						<div className="rounded-lg border border-border bg-bg0 px-3 py-2">
							<div className="text-[10px] uppercase tracking-[0.12em] text-text2">{requirement.label}</div>
							<div className="font-mono text-sm text-text0">
								{exploredValues.length}/{requirement.count}
							</div>
							<div className="mt-1 text-[11px] text-text2">
								{exploredValues.length > 0 ? exploredValues.join(', ') : 'none yet'}
								{remainingExploration > 0 ? ` (need ${remainingExploration} more)` : ' (requirement met)'}
							</div>
						</div>
					)}
				</div>
			</div>

			{insight && <p className="mt-4 rounded-lg border border-border bg-bg0 px-3 py-2 text-sm leading-6 text-text1">{insight}</p>}
		</div>
	)
}

export default ProgressCompass
