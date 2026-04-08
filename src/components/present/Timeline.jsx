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
		<section className="flex h-full max-h-full min-h-0 max-w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-bg2 p-4 md:p-5">
			<header className="mb-3 shrink-0 text-[13px] font-semibold uppercase tracking-[0.14em] text-text2 md:text-[14px]">
				Timeline
			</header>

			<div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
				{rows.length === 0 ? (
					<div className="text-base text-text2 md:text-lg">No runs yet.</div>
				) : (
					rows.map((entry, index) => (
						<div key={entry.id} className="grid grid-cols-[24px_1fr] gap-2 md:gap-3">
							<div className="relative flex justify-center">
								<span className={`z-10 mt-1.5 block h-3.5 w-3.5 rounded-full ${statusColor(entry.status)}`} />
								{index < rows.length - 1 ? (
									<span className="absolute top-5 h-[calc(100%+10px)] w-[1px] bg-border2" />
								) : null}
							</div>

							<div className="rounded-md border border-border bg-bg3 px-3 py-2 md:px-3.5 md:py-2.5">
								<div className="font-mono text-[13px] text-text2 md:text-[14px]">Run {entry.runNumber}</div>
								<div className="text-sm text-text1 md:text-[15px]">{entry.diff}</div>
								<div className={`mt-1.5 font-mono text-sm md:text-[15px] ${entry.result.className}`}>
									Result: {entry.result.text}
								</div>
							</div>
						</div>
					))
				)}
			</div>
		</section>
	)
}

export default Timeline
