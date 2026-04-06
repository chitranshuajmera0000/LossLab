import { useEffect, useMemo, useRef } from 'react'

function diffSummary(current, previous) {
	if (!previous) return 'Initial config'
	const changed = Object.keys(current || {}).filter(
		(key) => JSON.stringify(current[key]) !== JSON.stringify(previous[key]),
	)
	if (!changed.length) return 'No parameter changes'
	return changed.slice(0, 3).join(', ')
}

function statusForRun(run) {
	if (run.diverged || (run.final_accuracy ?? run.finalAccuracy ?? 0) < 0.4) return 'bad'
	if ((run.final_accuracy ?? run.finalAccuracy ?? 0) > 0.75) return 'good'
	return 'partial'
}

function statusColor(status) {
	if (status === 'good') return 'bg-green'
	if (status === 'bad') return 'bg-red'
	return 'bg-amber'
}

function resultText(run) {
	if (run.diverged) return { text: '✕ Exploded', className: 'text-red' }
	if (run.flatlined) return { text: '◌ Flatlined', className: 'text-amber' }
	const acc = (run.final_accuracy ?? run.finalAccuracy ?? 0) * 100
	const className = acc > 75 ? 'text-green' : acc < 40 ? 'text-red' : 'text-amber'
	return { text: `${acc.toFixed(1)}%`, className }
}

function Timeline({ allRuns = [] }) {
	const scrollerRef = useRef(null)

	useEffect(() => {
		if (scrollerRef.current) {
			scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
		}
	}, [allRuns.length])

	const rows = useMemo(() => {
		return allRuns.map((run, index) => {
			const prev = index > 0 ? allRuns[index - 1] : null
			const status = statusForRun(run)
			const result = resultText(run)
			return {
				id: run.id || run.run_number || run.runNumber || index,
				runNumber: run.run_number || run.runNumber || index + 1,
				diff: diffSummary(run.config, prev?.config),
				status,
				result,
			}
		})
	}, [allRuns])

	return (
		<section className="rounded-xl border border-border bg-bg2 p-3">
			<header className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text2">Timeline</header>

			<div ref={scrollerRef} className="max-h-[280px] space-y-3 overflow-y-auto pr-1">
				{rows.length === 0 ? (
					<div className="text-sm text-text2">No runs yet.</div>
				) : (
					rows.map((entry, index) => (
						<div key={entry.id} className="grid grid-cols-[20px_1fr] gap-2">
							<div className="relative flex justify-center">
								<span className={`z-10 mt-1 block h-3 w-3 rounded-full ${statusColor(entry.status)}`} />
								{index < rows.length - 1 ? (
									<span className="absolute top-4 h-[calc(100%+10px)] w-[1px] bg-border2" />
								) : null}
							</div>

							<div className="rounded-md border border-border bg-bg3 px-2 py-1.5">
								<div className="font-mono text-[11px] text-text2">Run {entry.runNumber}</div>
								<div className="text-xs text-text1">{entry.diff}</div>
								<div className={`mt-1 font-mono text-xs ${entry.result.className}`}>Result: {entry.result.text}</div>
							</div>
						</div>
					))
				)}
			</div>
		</section>
	)
}

export default Timeline
