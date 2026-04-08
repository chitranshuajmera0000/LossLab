import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import calculateScore from '../engine/scoring.js'
import { MISSIONS } from '../missions/missions.js'
import { LAB_TEAM_SESSION_CODES, getMissionForLabSessionCode } from '../config/labSessions.js'

const TEAM_CODES = LAB_TEAM_SESSION_CODES

function getMissionLimit(missionId) {
    const mission = MISSIONS.find(m => m.id === missionId)
    return mission?.maxRuns || Infinity
}

function getMission(missionId) {
    return MISSIONS.find(m => m.id === missionId) || MISSIONS[0]
}

function formatPct01(x) {
    if (x == null || Number.isNaN(x)) return '—'
    return `${(x * 100).toFixed(1)}%`
}

function Sparkline({ data, stroke = '#22c55e' }) {
    if (!data || data.length < 2) {
        return (
            <div className="h-[40px] flex items-center justify-center text-[10px] text-text2 font-mono border border-white/5 rounded-lg bg-bg0/50">
                No curve yet
            </div>
        )
    }
    const w = 160
    const h = 40
    const min = Math.min(...data)
    const max = Math.max(...data)
    const norm = (v) => h - 4 - ((v - min) / (max - min + 1e-9)) * (h - 8)
    const points = data.map((v, i) => [4 + (w - 8) * (i / (data.length - 1)), norm(v)])
    const d = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ')
    return (
        <svg width={w} height={h} className="block w-full max-w-[160px]" viewBox={`0 0 ${w} ${h}`}>
            <path d={d} stroke={stroke} strokeWidth="1.5" fill="none" className="opacity-90" />
        </svg>
    )
}

function MeterBar({ value, max, tone = 'accent' }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
    const bg =
        tone === 'green'
            ? 'bg-green'
            : tone === 'pink'
              ? 'bg-pink'
              : tone === 'amber'
                ? 'bg-amber'
                : 'bg-accent'
    return (
        <div className="h-2 w-full rounded-full bg-bg0 overflow-hidden border border-white/10">
            <div className={`h-full ${bg} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
    )
}

function AdminScreen() {
    const [isAuth, setIsAuth] = useState(localStorage.getItem('losslab_admin_token') === 'true')
    const [password, setPassword] = useState('')

    const [teams, setTeams] = useState([])
    const [runs, setRuns] = useState([])
    const [presentations, setPresentations] = useState([])
    const [sessions, setSessions] = useState([])
    const [syncStatus, setSyncStatus] = useState('connecting')
    const [lastSyncAt, setLastSyncAt] = useState(null)

    const channelRef = useRef(null)

    const handleLogin = (e) => {
        e.preventDefault()
        const ADMIN_PW = import.meta.env.VITE_ADMIN_PASSWORD || 'losslab'
        if (password === ADMIN_PW) {
            localStorage.setItem('losslab_admin_token', 'true')
            setIsAuth(true)
        } else {
            alert('Incorrect password')
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('losslab_admin_token')
        localStorage.removeItem('losslab_admin_session')
        setIsAuth(false)
        setTeams([])
        setRuns([])
        setPresentations([])
        setSessions([])
    }

    useEffect(() => {
        let active = true
        const monitoredSessions = new Set(TEAM_CODES)

        async function fetchAll() {
            if (!isAuth) return
            try {
                const [sessionsRes, teamsRes, runsRes, presRes] = await Promise.all([
                    supabase.from('sessions').select('*').in('session_code', TEAM_CODES),
                    supabase.from('teams').select('*').in('session_code', TEAM_CODES),
                    supabase.from('runs').select('*').in('session_code', TEAM_CODES).order('run_number', { ascending: true }),
                    supabase.from('presentations').select('*').in('session_code', TEAM_CODES),
                ])

                if (!active) return

                setSessions(sessionsRes.data || [])
                setTeams(teamsRes.data || [])
                setRuns(runsRes.data || [])
                setPresentations(presRes.data || [])
                setLastSyncAt(new Date())
            } catch {
                if (!active) return
                setSyncStatus('polling')
            }
        }

        fetchAll()

        let pollId
        if (isAuth) {
            pollId = setInterval(() => {
                if (!active) return
                fetchAll()
            }, 12_000)
        }

        if (isAuth) {
            const channel = supabase.channel('admin:all-team-sessions')

            // Supabase Realtime uses payload.eventType ('INSERT' | 'UPDATE' | 'DELETE'), not payload.event
            const ev = (p) => p.eventType || p.event

            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, (payload) => {
                const type = ev(payload)
                const nextCode =
                    payload?.new?.session_code ||
                    payload?.old?.session_code ||
                    payload?.new?.code ||
                    payload?.old?.code
                if (!monitoredSessions.has(nextCode)) return
                if (type === 'INSERT') {
                    setSessions((prev) => [...prev, payload.new])
                } else if (type === 'UPDATE') {
                    setSessions((prev) => prev.map((s) => (s.id === payload.new.id ? payload.new : s)))
                } else if (type === 'DELETE' && payload.old?.id) {
                    setSessions((prev) => prev.filter((s) => s.id !== payload.old.id))
                }
            })

            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, (payload) => {
                const type = ev(payload)
                const nextSessionCode = payload?.new?.session_code || payload?.old?.session_code
                if (!monitoredSessions.has(nextSessionCode)) return
                if (type === 'INSERT') {
                    setTeams((prev) => [...prev, payload.new])
                } else if (type === 'UPDATE') {
                    setTeams((prev) => prev.map((t) => (t.id === payload.new.id ? payload.new : t)))
                } else if (type === 'DELETE' && payload.old?.id) {
                    setTeams((prev) => prev.filter((t) => t.id !== payload.old.id))
                }
            })

            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'runs' }, (payload) => {
                const type = ev(payload)
                const nextSessionCode = payload?.new?.session_code || payload?.old?.session_code
                if (!monitoredSessions.has(nextSessionCode)) return
                if (type === 'INSERT') {
                    setRuns((prev) =>
                        [...prev, payload.new].sort((a, b) => (a.run_number || 0) - (b.run_number || 0)),
                    )
                } else if (type === 'UPDATE') {
                    setRuns((prev) => prev.map((r) => (r.id === payload.new.id ? payload.new : r)))
                } else if (type === 'DELETE' && payload.old?.id) {
                    setRuns((prev) => prev.filter((r) => r.id !== payload.old.id))
                }
            })

            channel.on('postgres_changes', { event: '*', schema: 'public', table: 'presentations' }, (payload) => {
                const type = ev(payload)
                const nextSessionCode = payload?.new?.session_code || payload?.old?.session_code
                if (!monitoredSessions.has(nextSessionCode)) return
                if (type === 'INSERT') {
                    setPresentations((prev) => [...prev, payload.new])
                } else if (type === 'UPDATE') {
                    setPresentations((prev) => prev.map((p) => (p.id === payload.new.id ? payload.new : p)))
                } else if (type === 'DELETE' && payload.old?.id) {
                    setPresentations((prev) => prev.filter((p) => p.id !== payload.old.id))
                }
            })

            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setSyncStatus('live')
                    return
                }
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    setSyncStatus('polling')
                } else if (status === 'CONNECTING') {
                    setSyncStatus('connecting')
                }
                if (import.meta.env.DEV && status !== 'SUBSCRIBED') {
                    // eslint-disable-next-line no-console
                    console.warn('[Admin realtime]', status)
                }
            })
            channelRef.current = channel
        }

        return () => {
            active = false
            if (pollId) clearInterval(pollId)
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
            }
        }
    }, [isAuth])

    const sessionMetaByCode = useMemo(() => {
        const map = {}
        sessions.forEach((session) => {
            const key = session.session_code || session.code
            if (key) map[key] = session
        })
        return map
    }, [sessions])

    const gridData = useMemo(() => {
        const canonicalTeams = Object.values(
            teams.reduce((acc, team) => {
                const key = team.session_code || `team:${team.id}`
                const prev = acc[key]
                if (!prev || (team.run_count || 0) > (prev.run_count || 0)) {
                    acc[key] = team
                }
                return acc
            }, {}),
        )

        return canonicalTeams
            .map((team) => {
                const teamRuns = runs.filter((r) => r.team_id === team.id)
                const pres = presentations.find((p) => p.team_id === team.id)
                const missionObj = getMissionForLabSessionCode(team.session_code) ?? getMission(null)

                const processedRuns = []
                let highestScore = 0
                let bestAccuracy = 0
                let allBadges = []
                let lastRunAt = null
                let bestRunPayload = null

                for (const r of teamRuns) {
                    const resultObj = {
                        trainLoss: r.train_loss || [],
                        valLoss: r.val_loss || [],
                        accuracy: r.accuracy || [],
                        finalAccuracy: r.final_accuracy || 0,
                        finalTrainLoss: r.final_train_loss || 0,
                        finalValLoss: r.final_val_loss || 0,
                        diverged: r.diverged || false,
                        vanished: r.vanished || false,
                        overfit: r.overfit || false,
                        flatlined: r.flatlined || false,
                        epochs: Array.isArray(r.train_loss) ? r.train_loss.length : 0,
                    }
                    const nextScore = calculateScore(r.config, resultObj, processedRuns, missionObj)
                    processedRuns.push({ ...r, result: resultObj, fullScore: nextScore })

                    if (nextScore.total > highestScore) {
                        highestScore = nextScore.total
                        bestRunPayload = { run: r, resultObj, fullScore: nextScore }
                    }
                    if (resultObj.finalAccuracy > bestAccuracy) bestAccuracy = resultObj.finalAccuracy

                    nextScore.badges.forEach((b) => {
                        if (!allBadges.includes(b)) allBadges.push(b)
                    })

                    if (!lastRunAt || new Date(r.created_at) > new Date(lastRunAt)) {
                        lastRunAt = r.created_at
                    }
                }

                const runsForMission = teamRuns.map((r) => ({
                    config: r.config,
                    finalAccuracy: r.final_accuracy || 0,
                }))
                const bestResult = bestRunPayload?.resultObj
                const missionWon =
                    bestResult && typeof missionObj.winFn === 'function'
                        ? missionObj.winFn(bestResult, runsForMission)
                        : false
                const stretchWon =
                    bestResult && typeof missionObj.stretchFn === 'function'
                        ? missionObj.stretchFn(bestResult, runsForMission)
                        : false

                const optimizersTried = new Set(teamRuns.map((r) => r.config?.optimizer).filter(Boolean)).size

                const isReady = pres?.is_submitted
                const maxRuns = missionObj?.id ? getMissionLimit(missionObj.id) : Infinity

                const gap =
                    bestResult != null ? bestResult.finalValLoss - bestResult.finalTrainLoss : null

                const breakdownRows =
                    bestRunPayload?.fullScore?.scoreBreakdownLabels?.filter((row) => row.value !== 0) ?? []

                return {
                    id: team.id,
                    name: team.session_code || team.team_name,
                    sessionCode: team.session_code,
                    runsUsed: teamRuns.length,
                    highestScore,
                    bestAccuracy,
                    badges: allBadges,
                    isReady,
                    maxRuns,
                    missionTitle: missionObj.title || 'Unknown Mission',
                    missionId: missionObj.id,
                    lastRunValLoss: bestRunPayload?.run?.val_loss,
                    lastRunAt,
                    bestRunPayload,
                    breakdownRows,
                    missionWon,
                    stretchWon,
                    gap,
                    optimizersTried,
                    presSubmittedAt: pres?.submitted_at,
                    isPresenting: pres?.is_presenting,
                    presentationDraft: pres && !pres.is_submitted,
                }
            })
            .sort((a, b) => {
                if (a.isReady && !b.isReady) return -1
                if (!a.isReady && b.isReady) return 1
                return b.highestScore - a.highestScore
            })
    }, [teams, runs, presentations])

    const sessionSummaries = useMemo(() => {
        return TEAM_CODES.map((code) => {
            const dbSession = sessionMetaByCode[code]
            const missionObj = getMissionForLabSessionCode(code) ?? MISSIONS[0]
            const sessionTeams = gridData.filter((team) => team.sessionCode === code)
            const readyTeams = sessionTeams.filter((team) => team.isReady).length
            const totalRuns = sessionTeams.reduce((sum, team) => sum + team.runsUsed, 0)
            const avgScore = sessionTeams.length
                ? Math.round(sessionTeams.reduce((sum, team) => sum + team.highestScore, 0) / sessionTeams.length)
                : 0
            const topScore = sessionTeams.reduce((m, t) => Math.max(m, t.highestScore), 0)
            const wonCount = sessionTeams.filter((t) => t.missionWon).length
            const stretchCount = sessionTeams.filter((t) => t.stretchWon).length
            const capacityRuns = missionObj.maxRuns * Math.max(1, sessionTeams.length)

            return {
                code,
                dbSession,
                mission: missionObj,
                missionTitle: missionObj.title,
                missionNumber: missionObj.number,
                subtitle: missionObj.subtitle,
                dataset: missionObj.dataset,
                winCondition: missionObj.winCondition,
                stretchGoal: missionObj.stretchGoal,
                timeLimit: missionObj.timeLimit,
                concept: missionObj.concept,
                maxRunsMission: missionObj.maxRuns,
                teamCount: sessionTeams.length,
                readyTeams,
                totalRuns,
                avgScore,
                topScore,
                wonCount,
                stretchCount,
                capacityRuns,
            }
        })
    }, [gridData, sessionMetaByCode])

    const overviewStats = useMemo(() => {
        const readyCount = gridData.filter((team) => team.isReady).length
        const missionWinners = gridData.filter((team) => team.missionWon).length
        const avgScoreAll = gridData.length
            ? Math.round(gridData.reduce((s, t) => s + t.highestScore, 0) / gridData.length)
            : 0
        return {
            monitoredSessions: TEAM_CODES.length,
            missionCatalog: MISSIONS.length,
            activeTeams: gridData.length,
            totalRuns: runs.length,
            readyTeams: readyCount,
            missionWinners,
            avgScoreAll,
        }
    }, [runs.length, gridData])

    if (!isAuth) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-bg0 text-text0 flex-col">
                <div className="bg-gradient-to-r from-accent to-accent2 bg-clip-text font-['Syne'] text-4xl font-bold text-transparent mb-8">
                    LossLab Admin
                </div>
                <form
                    onSubmit={handleLogin}
                    className="w-[300px] border border-white/5 bg-bg1 p-6 rounded-2xl shadow-xl flex flex-col gap-4"
                >
                    <div className="text-center text-xs uppercase tracking-widest text-text2 font-bold mb-2">Restricted Access</div>
                    <input
                        type="password"
                        autoFocus
                        placeholder="Admin PIN"
                        className="rounded-lg bg-bg2 border border-white/10 px-4 py-3 text-center tracking-widest text-white outline-none focus:border-accent w-full"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                        type="submit"
                        className="rounded-lg bg-accent text-bg0 font-bold py-2 mt-2 hover:bg-accent/80 transition uppercase tracking-widest text-xs"
                    >
                        Unlock
                    </button>
                </form>
            </div>
        )
    }

    const rangeLabel = `${TEAM_CODES[0]} – ${TEAM_CODES[TEAM_CODES.length - 1]}`

    return (
        <main className="min-h-screen bg-bg0 text-text0 flex flex-col">
            <header className="flex min-h-[72px] shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border bg-bg1 px-6 py-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-6">
                    <div className="bg-gradient-to-r from-accent to-accent2 bg-clip-text font-['Syne'] text-2xl font-bold text-transparent">
                        LossLab Admin
                    </div>
                    <div className="flex flex-col gap-1 border-l border-white/10 pl-6">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] uppercase tracking-widest text-text2">Live monitor</span>
                            <span className="font-mono text-xs font-bold tracking-wider text-white bg-white/10 px-2.5 py-1 rounded-md">
                                {rangeLabel}
                            </span>
                            <span className="text-[10px] text-text2 font-mono">
                                {overviewStats.monitoredSessions} sessions · {overviewStats.missionCatalog} missions
                            </span>
                        </div>
                        <p className="text-[11px] text-text2 max-w-xl leading-relaxed">
                            All lab rooms at a glance: mission brief, run budgets, win/stretch signals, and per-team score
                            anatomy — no session code entry required.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider ${
                                syncStatus === 'live'
                                    ? 'border-green/40 text-green bg-green/10'
                                    : syncStatus === 'polling'
                                      ? 'border-amber/40 text-amber bg-amber/10'
                                      : 'border-white/15 text-text2 bg-white/5'
                            }`}
                        >
                            {syncStatus === 'live' ? 'Live' : syncStatus === 'polling' ? 'Polling' : 'Connecting'}
                        </div>
                        <div className="text-[10px] font-mono text-text2">
                            Last sync: {lastSyncAt ? lastSyncAt.toLocaleTimeString() : '—'}
                        </div>
                    </div>
                    <div className="flex gap-5 text-xs font-mono">
                        <div className="flex flex-col items-end">
                            <span className="text-text2 text-[10px] uppercase">Teams</span>
                            <span className="text-lg font-bold text-accent">{overviewStats.activeTeams}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-text2 text-[10px] uppercase">Runs</span>
                            <span className="text-lg font-bold text-pink">{overviewStats.totalRuns}</span>
                        </div>
                    </div>
                    <button type="button" onClick={handleLogout} className="text-xs text-text2 hover:text-text1 whitespace-nowrap">
                        Log out
                    </button>
                </div>
            </header>

            <section className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-bg2 via-bg0 to-bg0 px-4 py-6 sm:px-8">
                {/* KPI strip */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
                    {[
                        { label: 'Sessions', value: overviewStats.monitoredSessions, sub: 'lab codes', color: 'text-white' },
                        { label: 'Teams live', value: overviewStats.activeTeams, sub: 'across all rooms', color: 'text-accent' },
                        { label: 'Total runs', value: overviewStats.totalRuns, sub: 'all experiments', color: 'text-pink' },
                        { label: 'Ready to present', value: overviewStats.readyTeams, sub: 'submitted decks', color: 'text-green' },
                        { label: 'Win condition met', value: overviewStats.missionWinners, sub: 'best run passes winFn', color: 'text-green' },
                        { label: 'Avg best score', value: overviewStats.avgScoreAll, sub: 'per team', color: 'text-amber' },
                    ].map((kpi) => (
                        <div
                            key={kpi.label}
                            className="rounded-xl border border-white/10 bg-gradient-to-br from-bg1/90 to-bg1/40 p-4 shadow-lg shadow-black/20"
                        >
                            <div className="text-[10px] uppercase tracking-widest text-text2 font-bold">{kpi.label}</div>
                            <div className={`font-mono text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</div>
                            <div className="text-[10px] text-text2 mt-1 font-mono">{kpi.sub}</div>
                        </div>
                    ))}
                </div>

                <div className="mb-4 flex items-end justify-between gap-4 flex-wrap">
                    <div>
                        <h2 className="font-['Syne'] text-lg font-bold text-white tracking-tight">Session roster</h2>
                        <p className="text-xs text-text2 mt-1 max-w-2xl">
                            One card per session code with mission brief, run budget, and live team status all in one place.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-5">
                    {sessionSummaries.map((s) => {
                        const team = gridData.find((t) => t.sessionCode === s.code) || null
                        const runPressure = s.capacityRuns > 0 ? Math.min(100, Math.round((s.totalRuns / s.capacityRuns) * 100)) : 0
                        const readyPct = s.teamCount > 0 ? Math.round((s.readyTeams / s.teamCount) * 100) : 0
                        const cfg = team?.bestRunPayload?.run?.config
                        const flags = [
                            team?.bestRunPayload?.resultObj?.diverged && 'Diverged',
                            team?.bestRunPayload?.resultObj?.vanished && 'Vanished',
                            team?.bestRunPayload?.resultObj?.flatlined && 'Flatlined',
                            team?.bestRunPayload?.resultObj?.overfit && 'Overfit',
                        ].filter(Boolean)

                        return (
                            <article
                                key={s.code}
                                className={`rounded-2xl border ${
                                    team?.isReady
                                        ? 'border-green/45 bg-gradient-to-b from-green/10 to-bg1/80'
                                        : 'border-white/10 bg-bg1/70'
                                } backdrop-blur-xl overflow-hidden flex flex-col shadow-lg shadow-black/25`}
                            >
                                <div className="px-4 pt-4 pb-3 border-b border-white/5 bg-gradient-to-r from-accent/10 via-transparent to-accent2/10">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm font-bold text-white">{s.code}</span>
                                                <span className="text-[10px] font-bold text-text2 bg-bg0/80 px-2 py-0.5 rounded border border-white/10">
                                                    M{s.missionNumber}
                                                </span>
                                            </div>
                                            <h3 className="font-['Syne'] text-base font-bold text-text0 mt-1 leading-snug">
                                                {s.missionTitle}
                                            </h3>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-[9px] uppercase text-text2">Timer</div>
                                            <div className="font-mono text-sm text-amber">{s.timeLimit ?? '—'} min</div>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-text1 mt-2 line-clamp-2 italic">&ldquo;{s.subtitle}&rdquo;</p>
                                </div>

                                <div className="p-4 flex-1 flex flex-col gap-3 text-[11px]">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="rounded-lg bg-bg0/60 border border-white/5 p-2">
                                            <div className="text-[9px] text-text2 uppercase">Win</div>
                                            <p className="text-text1 text-[10px] leading-snug mt-0.5 line-clamp-3">{s.winCondition}</p>
                                        </div>
                                        <div className="rounded-lg bg-bg0/60 border border-white/5 p-2">
                                            <div className="text-[9px] text-text2 uppercase">Stretch</div>
                                            <p className="text-text1 text-[10px] leading-snug mt-0.5 line-clamp-3">{s.stretchGoal}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-1 border-t border-white/5">
                                        <div className="flex justify-between text-[10px] font-mono text-text2">
                                            <span>
                                                Teams {s.teamCount} · Runs {s.totalRuns}/{s.maxRunsMission} cap each
                                            </span>
                                            <span>{runPressure}% budget</span>
                                        </div>
                                        <MeterBar value={s.totalRuns} max={s.capacityRuns} tone="accent" />
                                        <div className="flex justify-between text-[10px] font-mono text-text2">
                                            <span>Presentation</span>
                                            <span>
                                                {s.readyTeams}/{Math.max(1, s.teamCount)} ready ({readyPct}%)
                                            </span>
                                        </div>
                                        <MeterBar value={s.readyTeams} max={Math.max(1, s.teamCount)} tone="green" />
                                    </div>

                                    {!team ? (
                                        <div className="rounded-xl border border-dashed border-white/10 bg-bg1/40 px-4 py-6 text-center text-text2 text-sm">
                                            No roster for <span className="font-mono text-text1">{s.code}</span> yet.
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-start justify-between gap-3 pt-1 border-t border-white/5">
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-['Syne'] text-lg font-bold truncate">
                                                        {team.sessionCode || team.name || 'Unknown Session'}
                                                    </h4>
                                                    <p className="text-[10px] uppercase tracking-widest text-text2 mt-1 font-mono">
                                                        {team.isReady ? 'Submitted' : team.presentationDraft ? 'Draft' : 'Tuning'}
                                                    </p>
                                                </div>
                                                <div className="font-mono text-right">
                                                    <div className="text-[9px] uppercase text-text2">Score</div>
                                                    <div className="text-xl font-bold text-pink leading-none">{team.highestScore}</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="rounded-xl bg-bg0/50 border border-white/5 p-3">
                                                    <div className="text-[9px] uppercase text-text2 font-bold mb-1">Accuracy</div>
                                                    <div className="font-mono text-lg text-text1">{formatPct01(team.bestAccuracy)}</div>
                                                </div>
                                                <div className="rounded-xl bg-bg0/50 border border-white/5 p-3 text-right">
                                                    <div className="text-[9px] uppercase text-text2 font-bold mb-1">Runs</div>
                                                    <div className="font-mono text-lg text-text1">
                                                        {team.runsUsed}
                                                        <span className="text-text2 text-sm"> / {team.maxRuns === Infinity ? '∞' : team.maxRuns}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {team.missionWon && (
                                                    <span className="text-[9px] font-bold uppercase px-2 py-1 rounded bg-green/20 text-green border border-green/35">
                                                        Win ✓
                                                    </span>
                                                )}
                                                {team.stretchWon && (
                                                    <span className="text-[9px] font-bold uppercase px-2 py-1 rounded bg-accent/15 text-accent border border-accent/35">
                                                        Stretch ✓
                                                    </span>
                                                )}
                                                <span className="text-[9px] font-mono text-text2 border border-white/10 rounded px-2 py-1">
                                                    Gap val−train: {team.gap != null ? team.gap.toFixed(3) : '—'}
                                                </span>
                                            </div>

                                            <div>
                                                <div className="text-[9px] uppercase text-text2 font-bold mb-1">Val loss (best run)</div>
                                                <Sparkline data={team.lastRunValLoss} stroke="#34d399" />
                                            </div>

                                            {cfg && (
                                                <div>
                                                    <div className="text-[9px] uppercase text-text2 font-bold mb-2">Best-run hyperparameters</div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {[
                                                            ['lr', cfg.lr],
                                                            ['opt', cfg.optimizer],
                                                            ['bs', cfg.batchSize],
                                                            ['epochs', cfg.epochs],
                                                        ]
                                                            .filter(([, v]) => v != null && v !== '')
                                                            .map(([k, v]) => (
                                                                <span
                                                                    key={k}
                                                                    className="text-[10px] font-mono bg-bg0/70 border border-white/10 px-2 py-0.5 rounded"
                                                                >
                                                                    {k}: <span className="text-accent">{String(v)}</span>
                                                                </span>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}

                                            {flags.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {flags.map((f) => (
                                                        <span
                                                            key={f}
                                                            className="text-[9px] uppercase font-bold bg-red/15 text-red border border-red/30 px-2 py-0.5 rounded"
                                                        >
                                                            {f}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex flex-wrap gap-2 mt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const url = `${window.location.origin}/project?team=${encodeURIComponent(team.id)}`
                                                        window.open(url, '_blank', 'noopener,noreferrer')
                                                    }}
                                                    className="text-[10px] uppercase font-bold tracking-wider rounded-lg bg-accent/20 text-accent border border-accent/40 px-3 py-1.5 hover:bg-accent/30 transition"
                                                >
                                                    Open projector
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const url = `${window.location.origin}/project?team=${encodeURIComponent(team.id)}`
                                                        try {
                                                            await navigator.clipboard.writeText(url)
                                                        } catch {
                                                            window.prompt('Copy projector URL:', url)
                                                        }
                                                    }}
                                                    className="text-[10px] uppercase font-bold tracking-wider rounded-lg bg-white/5 text-text1 border border-white/10 px-3 py-1.5 hover:bg-white/10 transition"
                                                >
                                                    Copy projector link
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </article>
                        )
                    })}
                </div>
            </section>
        </main>
    )
}

export default AdminScreen
