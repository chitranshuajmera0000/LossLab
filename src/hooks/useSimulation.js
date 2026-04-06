import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lookupCurve, preloadMission } from '../engine/curveLookup.js'
import generateDiagnostics, { generateInsight } from '../engine/diagnostics.js'
import calculateScore from '../engine/scoring.js'

export function useSimulation() {
	const [allRuns, setAllRuns] = useState([])
	const [isAnimating, setIsAnimating] = useState(false)
	const [currentEpoch, setCurrentEpoch] = useState(0)
	const [animatedData, setAnimatedData] = useState({
		trainLoss: [],
		valLoss: [],
		accuracy: [],
	})
	const [diagnostics, setDiagnostics] = useState([])
	const [insight, setInsight] = useState('')
	const [score, setScore] = useState(null)

	const timerRef = useRef(null)

	useEffect(() => {
		return () => {
			if (timerRef.current) {
				clearInterval(timerRef.current)
			}
		}
	}, [])

	// Preload the current mission's JSON data as soon as the hook mounts.
	// This fires once per mission so the first Run press has no latency.
	const preloadForMission = useCallback((missionId) => {
		if (missionId) preloadMission(missionId)
	}, [])

	const runSimulation = useCallback(
		async (config, missionConfig) => {
			// Fetch real pre-computed curve (falls back to parametric if needed)
			const result = await lookupCurve(config, missionConfig)

			setIsAnimating(true)
			setCurrentEpoch(0)
			setAnimatedData({ trainLoss: [], valLoss: [], accuracy: [] })

			await new Promise((resolve) => {
				let epoch = 0
				timerRef.current = setInterval(() => {
					epoch += 1

					setCurrentEpoch(epoch)
					setAnimatedData({
						trainLoss: result.trainLoss.slice(0, epoch),
						valLoss: result.valLoss.slice(0, epoch),
						accuracy: result.accuracy.slice(0, epoch),
					})

					if (epoch >= result.epochs) {
						clearInterval(timerRef.current)
						timerRef.current = null
						resolve()
					}
				}, 60)
			})

			setIsAnimating(false)

			const nextDiagnostics = generateDiagnostics(config, result, missionConfig)
			const nextInsight = generateInsight(config, result, missionConfig)
			const nextScore = calculateScore(config, result, allRuns, missionConfig)
			const runNumber = allRuns.length + 1

			setDiagnostics(nextDiagnostics)
			setInsight(nextInsight)
			setScore(nextScore)
			setAllRuns((prev) => [
				...prev,
				{
					runNumber,
					config,
					result,
					score: nextScore.total,
					breakdown: nextScore.breakdown,
					badges: nextScore.badges,
					newBadges: nextScore.newBadges,
					scoreBreakdownLabels: nextScore.scoreBreakdownLabels,
					finalAccuracy: result.finalAccuracy,
					finalTrainLoss: result.finalTrainLoss,
					finalValLoss: result.finalValLoss,
					diverged: result.diverged,
					vanished: result.vanished,
					overfit: result.overfit,
					flatlined: result.flatlined,
					phases: result.phases,
					effectiveLrHistory: result.effectiveLrHistory,
					plateauEpoch: result.plateauEpoch,
					createdAt: Date.now(),
				},
			])

			return result
		},
		[allRuns],
	)

	const bestRun = useMemo(() => {
		if (allRuns.length === 0) return null
		return allRuns.reduce((best, current) =>
			(current.finalAccuracy || 0) > (best.finalAccuracy || 0) ? current : best,
		)
	}, [allRuns])

	const clearSimulation = useCallback(() => {
		setAllRuns([])
		setIsAnimating(false)
		setCurrentEpoch(0)
		setAnimatedData({ trainLoss: [], valLoss: [], accuracy: [] })
		setDiagnostics([])
		setInsight('')
		setScore(null)
	}, [])

	const restorePreviousRuns = useCallback((dbRuns, missionConfig) => {
		const historicalRuns = []
		for (const row of dbRuns) {
			const result = {
				trainLoss: row.train_loss || [],
				valLoss: row.val_loss || [],
				accuracy: row.accuracy || [],
				finalAccuracy: row.final_accuracy || 0,
				finalTrainLoss: row.final_train_loss || 0,
				finalValLoss: row.final_val_loss || 0,
				diverged: row.diverged || false,
				vanished: row.vanished || false,
				overfit: row.overfit || false,
				flatlined: row.flatlined || false,
				epochs: Array.isArray(row.train_loss) ? row.train_loss.length : 0,
			}
			const nextScore = calculateScore(row.config, result, historicalRuns, missionConfig)

			historicalRuns.push({
				id: row.id,
				runNumber: row.run_number,
				config: row.config,
				result,
				score: row.score ?? nextScore.total,
				breakdown: nextScore.breakdown,
				badges: nextScore.badges,
				newBadges: nextScore.newBadges,
				scoreBreakdownLabels: nextScore.scoreBreakdownLabels,
				finalAccuracy: result.finalAccuracy,
				finalTrainLoss: result.finalTrainLoss,
				finalValLoss: result.finalValLoss,
				diverged: result.diverged,
				vanished: result.vanished,
				overfit: result.overfit,
				flatlined: result.flatlined,
				createdAt: new Date(row.created_at).getTime() || Date.now(),
			})
		}

		setAllRuns(historicalRuns)

		if (historicalRuns.length > 0) {
			const lastRun = historicalRuns[historicalRuns.length - 1]
			setDiagnostics(generateDiagnostics(lastRun.config, lastRun.result, missionConfig))
			setInsight(generateInsight(lastRun.config, lastRun.result, missionConfig))
			setScore(calculateScore(lastRun.config, lastRun.result, historicalRuns.slice(0, -1), missionConfig))
		}
	}, [])

	return {
		allRuns,
		isAnimating,
		currentEpoch,
		animatedData,
		runSimulation,
		preloadForMission,
		diagnostics,
		insight,
		score,
		bestRun,
		clearSimulation,
		restorePreviousRuns,
	}
}

export default useSimulation
