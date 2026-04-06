function shortLr(lr) {
	if (lr < 0.001) return lr.toExponential(1)
	if (lr < 0.1) return lr.toFixed(3)
	return lr.toFixed(2)
}

function qualityColor(run) {
	if (run.diverged) return 'text-red'
	if ((run.finalAccuracy || 0) > 0.85) return 'text-green'
	if ((run.finalAccuracy || 0) > 0.7) return 'text-amber'
	return 'text-text2'
}

function sparklinePath(values = []) {
	if (values.length === 0) return ''
	const width = 80
	const height = 24
	const step = values.length > 1 ? width / (values.length - 1) : width
	return values
		.map((v, i) => {
			const x = i * step
			const y = height - Math.max(0, Math.min(1, v)) * height
			return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
		})
		.join(' ')
}


function RunHistory({ allRuns = [], onSelectRun, selectedRunIndex = -1 }) {
	const bestRunId =
		allRuns.length === 0
			? null
			: allRuns.reduce((best, run) =>
				(run.finalAccuracy || 0) > (best.finalAccuracy || 0) ? run : best,
			).runNumber

	const latestTen = allRuns.slice(-10).reverse()

	return (
		<aside className="h-[50vh] overflow-y-auto rounded-2xl border border-white/10 bg-bg1/40 backdrop-blur-xl p-3 flex flex-col shadow-lg">
			<div className="px-1 pb-2 text-[11px] uppercase tracking-[0.1em] text-text2">Run History</div>
			{allRuns.length === 0 ? (
				<div className="flex-1 flex flex-col items-center justify-center text-center text-text2 py-8">
					<span style={{ fontSize: 36, marginBottom: 8 }}>🧪</span>
					<div className="text-sm font-mono mb-1">No runs yet.</div>
					<div className="text-xs">Configure your model and click <b>Run Training</b>.</div>
				</div>
			) : (
				<div className="space-y-2">
					{latestTen.map((run) => {
						const absoluteIndex = allRuns.findIndex((r) => r.runNumber === run.runNumber)
						const selected = absoluteIndex === selectedRunIndex
						const isBest = run.runNumber === bestRunId
						const line = sparklinePath(run.result?.accuracy || [])
						return (
							<button
								type="button"
								key={run.runNumber}
								onClick={() => onSelectRun(absoluteIndex)}
								className={`w-full rounded-xl border bg-bg2/50 backdrop-blur-md p-2.5 text-left transition-all duration-300 hover:bg-bg3/80 hover:-translate-y-0.5 hover:shadow-md ${selected ? 'border-accent bg-accent/10 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'border-white/5 hover:border-white/20'
									}`}
							>
								<div className="flex items-center justify-between">
									<div className="text-xs font-semibold text-text0">Run {run.runNumber}</div>
									{isBest ? (
										<span className="rounded bg-green/20 px-1.5 py-0.5 text-[10px] font-bold text-green">BEST</span>
									) : null}
								</div>

								<div className={`mt-1 font-mono text-lg ${qualityColor(run)}`}>
									{run.diverged ? '✕ Exploded' : `${((run.finalAccuracy || 0) * 100).toFixed(1)}%`}
								</div>

								<div className="mt-1 flex flex-wrap gap-1 text-[10px]">
									<span className="rounded bg-bg4 px-1.5 py-0.5 text-text1">{run.config?.optimizer}</span>
									<span className="rounded bg-bg4 px-1.5 py-0.5 text-text1">lr {shortLr(run.config?.lr || 0.001)}</span>
									<span className="rounded bg-bg4 px-1.5 py-0.5 text-text1">{run.config?.activation}</span>
								</div>

								<svg className="mt-2 h-6 w-20" viewBox="0 0 80 24" aria-label="accuracy sparkline">
									<path
										d={line}
										fill="none"
										stroke={run.diverged ? '#f87171' : '#34d399'}
										strokeWidth="1.8"
										strokeLinecap="round"
									/>
								</svg>
							</button>
						)
					})}
				</div>
			)}
		</aside>
	)
}

export default RunHistory
