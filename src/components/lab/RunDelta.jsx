function getChangedParamKeys(previousConfig, currentConfig, lockedParams = []) {
	if (!previousConfig || !currentConfig) return []
	const locked = new Set(lockedParams)
	const candidateKeys = Object.keys(currentConfig).filter((key) => !locked.has(key))

	return candidateKeys.filter((key) => previousConfig[key] !== currentConfig[key])
}

function RunDelta({ currentRun, previousRun, mission }) {
	if (!currentRun) {
		return null
	}

	const currentAccuracy = currentRun.finalAccuracy ?? 0
	const previousAccuracy = previousRun?.finalAccuracy ?? currentAccuracy
	const currentGap = (currentRun.finalValLoss ?? 0) - (currentRun.finalTrainLoss ?? 0)
	const previousGap = previousRun ? (previousRun.finalValLoss ?? 0) - (previousRun.finalTrainLoss ?? 0) : currentGap
	const accDelta = currentAccuracy - previousAccuracy
	const gapDelta = currentGap - previousGap
	const lossDelta = (previousRun?.finalTrainLoss ?? currentRun.finalTrainLoss ?? 0) - (currentRun.finalTrainLoss ?? 0)
	const changedParamKeys = getChangedParamKeys(previousRun?.config, currentRun?.config, mission?.lockedParams || [])
	const changedParamsCount = changedParamKeys.length

	return (
		<div className="rounded-xl border border-border bg-bg1 p-4">
			<div className="text-[11px] uppercase tracking-[0.18em] text-text2">Run delta</div>
			{changedParamsCount > 2 && (
				<div className="mt-3 rounded-lg border border-amber bg-amber/10 px-3 py-2 text-xs text-amber">
					You changed {changedParamsCount} params at once. Changing one variable at a time gives cleaner signal.
				</div>
			)}
			<div className="mt-3 grid grid-cols-3 gap-2">
				<div className="rounded-lg border border-border bg-bg2 px-3 py-2">
					<div className="text-[10px] uppercase tracking-[0.12em] text-text2">Accuracy</div>
					<div className={`font-mono text-sm ${accDelta >= 0 ? 'text-green' : 'text-red'}`}>{(accDelta * 100).toFixed(1)}%</div>
				</div>
				<div className="rounded-lg border border-border bg-bg2 px-3 py-2">
					<div className="text-[10px] uppercase tracking-[0.12em] text-text2">Train loss</div>
					<div className={`font-mono text-sm ${lossDelta >= 0 ? 'text-green' : 'text-red'}`}>{lossDelta.toFixed(3)}</div>
				</div>
				<div className="rounded-lg border border-border bg-bg2 px-3 py-2">
					<div className="text-[10px] uppercase tracking-[0.12em] text-text2">Gap</div>
					<div className={`font-mono text-sm ${gapDelta <= 0 ? 'text-green' : 'text-amber'}`}>{gapDelta.toFixed(3)}</div>
				</div>
			</div>
			<div className="mt-3 text-xs leading-6 text-text1">
				{accDelta >= 0
					? 'This run moved closer to the target.'
					: 'This run moved away from the target. Compare the config changes before rerunning.'}
			</div>
			{changedParamsCount > 0 && (
				<div className="mt-2 text-[11px] text-text2">Changed: {changedParamKeys.join(', ')}</div>
			)}
		</div>
	)
}

export default RunDelta
