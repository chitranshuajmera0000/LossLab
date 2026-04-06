
import { useSearchParams } from 'react-router-dom'
import { useFeed } from '../hooks/useFeed'
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import Leaderboard from '../components/feed/Leaderboard'
import TeamCard from '../components/feed/TeamCard'
import CompareOverlay from '../components/feed/CompareOverlay'
import SessionTimer from '../components/feed/SessionTimer'

function FeedScreen() {
	const [searchParams] = useSearchParams()
	const sessionCode = searchParams.get('session')
	const [compare, setCompare] = useState([]) // array of team ids
	const [isUpdatingControls, setIsUpdatingControls] = useState(false)

	// Feed hook
	const {
		leaderboard,
		teams,
		bestRuns,
		mission,
		dataset,
		sessionData,
		revealMode,
		presentingTeamId,
		submittedCount,
		totalTeams,
		timerStart,
		durationMinutes,
		teamMap,
		realtimeStatus,
		reconnectRealtime,
		toggleRevealMode,
		endSession,
	} = useFeed(sessionCode)

	const syncClass =
		realtimeStatus === 'connected'
			? 'text-green-500'
			: realtimeStatus === 'connecting'
				? 'text-amber-400'
				: realtimeStatus === 'error'
					? 'text-red-500'
					: 'text-text2'
	const syncLabel =
		realtimeStatus === 'connected'
			? 'Synced'
			: realtimeStatus === 'connecting'
				? 'Connecting'
				: realtimeStatus === 'error'
					? 'Sync error'
					: realtimeStatus === 'disconnected'
						? 'Disconnected'
						: 'Idle'

	// Error if no session code
	if (!sessionCode) {
		return (
			<main className="screen-shell flex items-center justify-center">
				<div className="bg1 border border-red-400 rounded-xl p-8 text-center">
					<div className="text-lg font-bold text-red-400 mb-2">No session code in URL</div>
					<div className="text2">Please join via the correct link.</div>
				</div>
			</main>
		)
	}

	// Compare overlay state
	const compareTeams = compare.length === 2
		? [teamMap[compare[0]], teamMap[compare[1]]] : []

	// Handlers
	const handleCompare = (teamId) => {
		setCompare((prev) => {
			if (prev.includes(teamId)) return prev.filter((id) => id !== teamId)
			if (prev.length === 2) return [prev[1], teamId]
			return [...prev, teamId]
		})
	}

	// Instructor controls (stubbed, wire up actions as needed)
	const handleReveal = async () => {
		if (isUpdatingControls) return
		setIsUpdatingControls(true)
		const result = await toggleRevealMode()
		setIsUpdatingControls(false)
		if (result?.error) {
			toast.error(result.error)
			return
		}
		toast.success(result?.revealMode ? 'Optimal config revealed' : 'Reveal mode hidden')
	}

	const handleEnd = async () => {
		if (isUpdatingControls) return
		setIsUpdatingControls(true)
		const result = await endSession()
		setIsUpdatingControls(false)
		if (result?.error) {
			toast.error(result.error)
			return
		}
		toast.success('Session ended')
	}

	const handleReconnect = () => {
		reconnectRealtime()
		toast.success('Reconnecting live feed...')
	}

	return (
		<main className="screen-shell flex flex-col min-h-screen">
			{/* HEADER BAR */}
			<header className="bg1 border-b border-border px-6 py-3 flex items-center justify-between">
				{/* Left: Title + live */}
				<div className="flex items-center gap-2">
					<span className="font-syne font-bold text-[18px]">Class Feed</span>
					<span className="relative flex h-3 w-3 mr-1">
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
						<span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
					</span>
					<span className="text-green-500 font-mono text-xs font-bold">LIVE</span>
				</div>
				{/* Center: mission + dataset */}
				<div className="text2 text-center flex-1">
					{mission?.title || 'Mission'} <span className="mx-1">·</span> {dataset?.name || 'Dataset'}
				</div>
				{/* Right: submitted counter + timer */}
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2">
						<span className={`text-xs font-mono ${syncClass}`}>{syncLabel}</span>
						<button
							type="button"
							onClick={handleReconnect}
							className="rounded border border-border bg-bg2 px-2 py-0.5 text-[10px] text-text1 hover:bg-bg3"
						>
							Reconnect
						</button>
					</div>
					<span className="text2 text-sm">{submittedCount} / {totalTeams} submitted</span>
					<SessionTimer timerStart={timerStart} durationMinutes={durationMinutes} />
				</div>
			</header>

			{/* LEADERBOARD SECTION */}
			<section className="w-full max-w-4xl mx-auto mt-6">
				<Leaderboard leaderboard={leaderboard} presentingTeamId={presentingTeamId} />
			</section>

			{/* TEAM CARDS GRID */}
			<section className="w-full max-w-6xl mx-auto mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
				{teams.map((team) => (
					<TeamCard
						key={team.id}
						team={team}
						bestRun={bestRuns[team.id]}
						rank={leaderboard.findIndex((t) => t.id === team.id) + 1}
						isPresenting={presentingTeamId === team.id}
						isSubmitted={!!bestRuns[team.id]}
						onCompare={() => handleCompare(team.id)}
						compareSelected={compare.includes(team.id)}
					/>
				))}
			</section>

			{/* INSTRUCTOR CONTROLS */}
			<div className="fixed bottom-6 right-6 z-30">
				<div className="bg2 border border-border rounded-xl shadow-lg p-3 flex flex-col gap-2 min-w-[200px]">
					<button
						className="text-xs text2 rounded px-3 py-1 bg-accent/10 hover:bg-accent/20 border border-accent mb-1 disabled:opacity-50"
						onClick={handleReveal}
						disabled={isUpdatingControls || sessionData?.is_active === false}
					>
						{revealMode ? 'Hide Optimal Config' : 'Reveal Optimal Config'}
					</button>
					<button
						className="text-xs text2 rounded px-3 py-1 bg-amber-100/10 hover:bg-amber-100/20 border border-amber-400 disabled:opacity-50"
						onClick={handleEnd}
						disabled={isUpdatingControls || sessionData?.is_active === false}
					>
						{sessionData?.is_active === false ? 'Session Ended' : 'End Session'}
					</button>
				</div>
			</div>

			{/* COMPARE OVERLAY */}
			{compareTeams.length === 2 && (
				<CompareOverlay
					teamA={compareTeams[0]}
					teamB={compareTeams[1]}
					onClose={() => setCompare([])}
				/>
			)}
		</main>
	)
}

export default FeedScreen
