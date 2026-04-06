import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useSession } from '../hooks/useSession.js'
import { useSimulation } from '../hooks/useSimulation.js'
import ControlPanel from '../components/lab/ControlPanel.jsx'
import ProgressCompass from '../components/lab/ProgressCompass.jsx'
import RunDelta from '../components/lab/RunDelta.jsx'
import TrainingCurve from '../components/lab/TrainingCurve.jsx'
import MetricsRow from '../components/lab/MetricsRow.jsx'
import Diagnostics from '../components/lab/Diagnostics.jsx'
import RunHistory from '../components/lab/RunHistory.jsx'
import NotesPanel from '../components/lab/NotesPanel.jsx'
import MissionBrief from '../components/shared/MissionBrief.jsx'
import BadgeToast from '../components/shared/BadgeToast.jsx'
import { MISSIONS } from '../missions/index.js'
import calculateScore from '../engine/scoring.js'
import { supabase } from '../lib/supabase.js'

const NOTE_MIN = 20

function getThresholdFromText(text) {
	if (!text) return null
	const match = String(text).match(/(\d+(?:\.\d+)?)%/)
	if (!match) return null
	return Number(match[1]) / 100
}

function getMissionThresholds(mission) {
	const winThreshold =
		typeof mission?.winThreshold === 'number'
			? mission.winThreshold
			: getThresholdFromText(mission?.winCondition) ?? 0.8

	const stretchThreshold =
		typeof mission?.stretchThreshold === 'number'
			? mission.stretchThreshold
			: getThresholdFromText(mission?.stretchGoal) ?? Math.max(winThreshold + 0.06, winThreshold)

	const gapThreshold = typeof mission?.gapThreshold === 'number' ? mission.gapThreshold : null

	return { winThreshold, stretchThreshold, gapThreshold }
}

function evaluateMissionStatus(mission, result, runs) {
	const safeRuns = Array.isArray(runs) ? runs : []
	const won = typeof mission?.winFn === 'function' ? Boolean(mission.winFn(result, safeRuns)) : false
	const stretch = typeof mission?.stretchFn === 'function' ? Boolean(mission.stretchFn(result, safeRuns)) : false
	return { won, stretch }
}

function buildChangeEvents(result) {
	if (!result) return []
	const events = []
	if (result?.params?.explodeEpoch != null) {
		events.push({ epoch: result.params.explodeEpoch + 1, type: 'explode', label: 'Explosion' })
	}
	if (result?.plateauEpoch != null) {
		events.push({ epoch: result.plateauEpoch + 1, type: 'plateau', label: 'Plateau' })
	}
	if (result?.params?.overfitEpoch != null && result.overfit) {
		events.push({ epoch: result.params.overfitEpoch + 1, type: 'overfit', label: 'Overfit start' })
	}
	return events
}

function LabScreen() {
	const navigate = useNavigate()
	const {
		mission,
		team,
		sessionCode,
		restoreSession,
		saveRun,
		saveBadges,
		savePresentation,
		submitPresentation,
		setMission,
	} = useSession()
	const currentMission = mission || MISSIONS[0]

	const {
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
	} = useSimulation()

	const [configState, setConfigState] = useState({
		missionId: currentMission?.id,
		values: currentMission?.defaultConfig ? { ...currentMission.defaultConfig } : null,
	})
	const [selectedRunIndex, setSelectedRunIndex] = useState(-1)
	const [runFeedback, setRunFeedback] = useState('idle')
	const [notes, setNotes] = useState({ approach: '', broke: '', concept: '' })
	const [isSubmitted, setIsSubmitted] = useState(false)
	const [missionStatus, setMissionStatus] = useState({ missionId: null, won: false, stretch: false })

	const config =
		configState.missionId === currentMission?.id && configState.values
			? configState.values
			: { ...currentMission.defaultConfig }

	useEffect(() => {
		if (!team || !sessionCode || !mission) {
			restoreSession().then((ok) => {
				if (!ok) navigate('/join')
			})
		}
	}, [team, sessionCode, mission, navigate, restoreSession])

	useEffect(() => {
		if (currentMission?.id) {
			preloadForMission(currentMission.id)
		}
	}, [currentMission?.id, preloadForMission])

	// Automatically fetch and restore past runs on mount or pc switch
	useEffect(() => {
		if (team?.id && sessionCode && currentMission && allRuns.length === 0) {
			Promise.all([
				supabase.from('runs').select('*').eq('team_id', team.id).order('run_number', { ascending: true }),
				supabase.from('presentations').select('*').eq('team_id', team.id).maybeSingle(),
			]).then(([runsRes, presRes]) => {
				if (!runsRes.error && runsRes.data?.length > 0) {
					restorePreviousRuns(runsRes.data, currentMission)
				}
				if (!presRes.error && presRes.data) {
					setNotes({
						approach: presRes.data.note_approach || '',
						broke: presRes.data.note_broke || '',
						concept: presRes.data.note_concept || '',
					})
					setIsSubmitted(presRes.data.is_submitted || false)
				}
			})
		}
	}, [team?.id, sessionCode, currentMission, allRuns.length, restorePreviousRuns])

	useEffect(() => {
		if (runFeedback !== 'done') return undefined
		const timer = setTimeout(() => setRunFeedback('idle'), 2000)
		return () => clearTimeout(timer)
	}, [runFeedback])

	const selectedRun = selectedRunIndex >= 0 ? allRuns[selectedRunIndex] : null
	const displayedRun = selectedRun || allRuns[allRuns.length - 1] || null
	const previousRun = selectedRunIndex > 0 ? allRuns[selectedRunIndex - 1] : null
	const displayedResult = displayedRun?.result
	const activeMissionStatus = missionStatus.missionId === currentMission?.id ? missionStatus : { missionId: currentMission?.id, won: false, stretch: false }
	const missionThresholds = useMemo(() => getMissionThresholds(currentMission), [currentMission])
	const changeEvents = useMemo(() => buildChangeEvents(displayedResult), [displayedResult])
	const isRunLimitReached = currentMission?.maxRuns != null && allRuns.length >= currentMission.maxRuns

	const canSubmitNotes =
		notes.approach.trim().length > NOTE_MIN &&
		notes.broke.trim().length > NOTE_MIN &&
		notes.concept.trim().length > NOTE_MIN

	const canPresent = isSubmitted

	const onConfigChange = (key, value) => {
		setConfigState((prev) => {
			const baseConfig = prev.missionId === currentMission.id && prev.values ? prev.values : { ...currentMission.defaultConfig }
			return {
				missionId: currentMission.id,
				values: { ...baseConfig, [key]: value },
			}
		})
	}

	const handleMissionSwitch = () => { } // disabled — mission is set by session code
	void handleMissionSwitch // suppress unused warning

	const onRunTraining = async () => {
		if (!config || !currentMission || isRunLimitReached) return

		try {
			const result = await runSimulation(config, currentMission)
			const localScore = calculateScore(config, result, allRuns, currentMission)

			const runsIncludingCurrent = [
				...allRuns,
				{
					config,
					result,
					finalAccuracy: result.finalAccuracy,
					finalTrainLoss: result.finalTrainLoss,
					finalValLoss: result.finalValLoss,
				},
			]
			const status = evaluateMissionStatus(currentMission, result, runsIncludingCurrent)

			if (status.won && !activeMissionStatus.won) {
				toast.success('Mission win achieved')
			}
			if (status.stretch && !activeMissionStatus.stretch) {
				toast.success('Stretch goal achieved')
			}
			setMissionStatus({
				missionId: currentMission.id,
				won: activeMissionStatus.won || status.won,
				stretch: activeMissionStatus.stretch || status.stretch,
			})

			const persistedRun = await saveRun({
				config,
				trainLoss: result.trainLoss,
				valLoss: result.valLoss,
				accuracy: result.accuracy,
				finalTrainLoss: result.finalTrainLoss,
				finalValLoss: result.finalValLoss,
				finalAccuracy: result.finalAccuracy,
				score: localScore.total,
				diverged: result.diverged,
				vanished: result.vanished,
				overfit: result.overfit,
				flatlined: result.flatlined,
			})

			if (localScore.newBadges?.length) {
				if (persistedRun?.id && !String(persistedRun.id).startsWith('local-')) {
					await saveBadges(localScore.newBadges, persistedRun.id)
				}
				localScore.newBadges.forEach((badgeKey) => {
					toast.custom(<BadgeToast badgeKey={badgeKey} />)
				})
			}

			setSelectedRunIndex(allRuns.length)
			setRunFeedback('done')
		} catch (err) {
			toast.error(err.message || 'Run failed to save')
		}
	}

	const onSubmitNotes = async () => {
		if (!canSubmitNotes || isSubmitted || !bestRun) return
		try {
			await savePresentation(notes, null)
			await submitPresentation()
			setIsSubmitted(true)
			toast.success('Presentation submitted')
		} catch (err) {
			toast.error(err.message || 'Submit failed')
		}
	}

	return (
		<main className="min-h-screen bg-bg0 text-text0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-bg2 via-bg0 to-bg0">
			<header className="fixed left-0 right-0 top-0 z-20 flex h-[60px] items-center justify-between border-b border-white/5 bg-bg1/70 backdrop-blur-xl px-4 shadow-sm">
				<div className="bg-gradient-to-r from-accent to-accent2 bg-clip-text font-['Syne'] text-xl font-bold text-transparent">
					LossLab
				</div>

				<div className="rounded-full border border-white/10 bg-white/5 py-1 px-4 text-xs text-text1 shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] backdrop-blur-md flex items-center gap-2">
					<span className="text-accent2 opacity-80 font-bold tracking-wider">MISSION:</span>
					<span className="text-white font-bold">{currentMission.number}: {currentMission.title}</span>
				</div>

				<div className="flex items-center gap-2 text-xs">
					<span className="text-text1">Run {allRuns.length + 1}</span>
					<span className="rounded-full border border-border bg-bg2 px-2 py-1 text-text0">{team?.team_name || 'Team'}</span>
					<button
						type="button"
						onClick={() => navigate('/present')}
						disabled={!canPresent}
						title={canPresent ? 'Open presentation view' : 'Submit your notes first to unlock Present'}
						className="rounded-lg border border-accent/50 bg-gradient-to-r from-accent/20 to-accent/5 px-3 py-1.5 text-white shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all duration-300 hover:scale-[1.03] hover:border-accent hover:from-accent/30 hover:to-accent/10 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none"
					>
						Present →
					</button>
					{!canPresent && <span className="text-[11px] text-text2">Submit notes to unlock</span>}
				</div>
			</header>

			<div className="flex gap-3 px-3 pb-3 pt-[68px]">
				<ControlPanel
					config={config || currentMission.defaultConfig}
					onConfigChange={onConfigChange}
					lockedParams={currentMission.lockedParams}
					missionId={currentMission.id}
					onRun={onRunTraining}
					isAnimating={isAnimating}
					currentEpoch={currentEpoch}
					lastAccuracy={displayedResult ? (displayedResult.finalAccuracy * 100).toFixed(1) : '0.0'}
					runFeedback={runFeedback}
					isRunLimitReached={isRunLimitReached}
					runsUsed={allRuns.length}
					maxRuns={currentMission.maxRuns}
				/>

				<section className="flex min-w-0 flex-1 flex-col gap-3">
					<MissionBrief
						mission={currentMission}
						progress={{
							runsUsed: allRuns.length,
							bestAccuracy: bestRun?.finalAccuracy,
							winAchieved: activeMissionStatus.won,
							stretchAchieved: activeMissionStatus.stretch,
						}}
					/>
					<div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
						<ProgressCompass
							mission={currentMission}
							result={displayedResult}
							allRuns={allRuns}
							insight={insight}
							missionStatus={activeMissionStatus}
							winThreshold={missionThresholds.winThreshold}
							stretchThreshold={missionThresholds.stretchThreshold}
						/>
						<RunDelta currentRun={displayedRun} previousRun={previousRun} mission={currentMission} />
					</div>
					<TrainingCurve
						animatedData={
							displayedResult && !isAnimating
								? {
									trainLoss: displayedResult.trainLoss,
									valLoss: displayedResult.valLoss,
									accuracy: displayedResult.accuracy,
								}
								: animatedData
						}
						allRuns={allRuns}
						isAnimating={isAnimating}
						changePoints={changeEvents.map((event) => event.epoch)}
						changeEvents={changeEvents}
						runForPhases={displayedRun}
					/>
					<MetricsRow
						mission={currentMission}
						result={displayedResult || { finalTrainLoss: 0, finalValLoss: 0, finalAccuracy: 0 }}
						previousResult={previousRun?.result}
						winThreshold={missionThresholds.winThreshold}
						stretchThreshold={missionThresholds.stretchThreshold}
						gapThreshold={missionThresholds.gapThreshold}
						missionStatus={activeMissionStatus}
						score={selectedRun?.score || score?.total || 0}
						scoreBreakdownLabels={selectedRun?.scoreBreakdownLabels || score?.scoreBreakdownLabels || []}
					/>
					<Diagnostics diagnostics={diagnostics} mission={currentMission} runCount={allRuns.length} />
					{insight && (
						<div className="rounded-xl border border-border bg-bg1 px-4 py-3 text-sm leading-6 text-text1">
							<div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-text2">Socratic insight</div>
							{insight}
						</div>
					)}
				</section>

				<section className="flex w-[220px] shrink-0 flex-col gap-3">
					<RunHistory
						allRuns={allRuns}
						onSelectRun={setSelectedRunIndex}
						selectedRunIndex={selectedRunIndex}
					/>
					<NotesPanel
						notes={notes}
						onNotesChange={(key, value) => setNotes((prev) => ({ ...prev, [key]: value }))}
						onSubmit={onSubmitNotes}
						isSubmitted={isSubmitted}
						canSubmit={canSubmitNotes}
						onEdit={() => setIsSubmitted(false)}
					/>
				</section>
			</div>
		</main>
	)
}

export default LabScreen
