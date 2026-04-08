import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import calculateScore from '../engine/scoring.js'
import { MISSIONS } from '../missions/missions.js'
import { LAB_TEAM_SESSION_CODES, getMissionForLabSessionCode } from '../config/labSessions.js'
import { lookupCurve } from '../engine/curveLookup.js'

const TEAM_CODES = LAB_TEAM_SESSION_CODES

function getMissionLimit(missionId) {
    const mission = MISSIONS.find(m => m.id === missionId)
    return mission?.maxRuns || Infinity
}

function getMission(missionId) {
    return MISSIONS.find(m => m.id === missionId) || MISSIONS[0]
}

/**
 * Generates detailed, instructor-quality presentation notes for a team
 * that couldn't solve their mission. Used by the Rescue Deck feature.
 */
function generateRescueNotes(team, syntheticBest = null, isSynthetic = false) {
    const mission = MISSIONS.find(m => m.id === team.missionId) || MISSIONS[0]
    const best = syntheticBest || team.bestRunPayload
    const cfg = best?.run?.config || {}
    const res = best?.resultObj || {}
    const acc = res.finalAccuracy || team.bestAccuracy || 0
    const accPct = (acc * 100).toFixed(1)
    const valLoss = res.finalValLoss?.toFixed(4) ?? '—'
    const trainLoss = res.finalTrainLoss?.toFixed(4) ?? '—'
    const gap = team.gap != null ? team.gap.toFixed(3) : '—'
    const runsUsed = team.runsUsed
    const missionTitle = mission.title || team.missionTitle

    // --- Approach note ---
    let approachLines = []
    approachLines.push(`Mission: ${missionTitle} — ${mission.concept || ''}`)
    approachLines.push(`Dataset: ${mission.dataset || 'N/A'}`)
    approachLines.push(`Failure mode: ${mission.failureMode || 'Multiple hyperparameter interactions'}`)
    approachLines.push('')
    approachLines.push(isSynthetic ? `Instructor Solving Config:` : `Default config started with:`)
    if (cfg.lr != null) approachLines.push(`  • Learning rate: ${cfg.lr}`)
    if (cfg.optimizer) approachLines.push(`  • Optimizer: ${cfg.optimizer}`)
    if (cfg.batchSize != null) approachLines.push(`  • Batch size: ${cfg.batchSize}`)
    if (cfg.layers != null) approachLines.push(`  • Layers: ${cfg.layers}`)
    if (cfg.dropout != null) approachLines.push(`  • Dropout: ${cfg.dropout}`)
    approachLines.push('')
    approachLines.push(`After ${runsUsed} experiment${runsUsed !== 1 ? 's' : ''}, best result: val acc ${accPct}% | val loss ${valLoss} | train loss ${trainLoss} | gap ${gap}`)
    if (team.missionWon) {
        approachLines.push('Win condition: ✓ MET')
    } else {
        approachLines.push(`Win condition: NOT MET (required: ${mission.winCondition || 'See mission brief'})`)
    }
    const approach = approachLines.join('\n')

    // --- What broke note ---
    let brokeLines = []
    brokeLines.push(`Root cause: ${mission.failureMode || 'The default hyperparameters create an unstable training regime.'}`)
    brokeLines.push('')
    if (res.diverged) {
        brokeLines.push('• DIVERGENCE: Loss increased instead of decreasing. The learning rate was too high — gradient steps overshot the minimum on every update, sending the model further from convergence each epoch.')
    }
    if (res.flatlined) {
        brokeLines.push('• FLATLINE: Accuracy stuck at ~10% (random chance). Zero-initialised weights caused perfect symmetry — all neurons compute identical gradients so no differentiation could occur. The network could not break symmetry.')
    }
    if (res.vanished) {
        brokeLines.push('• VANISHING GRADIENT: Deep sigmoid activations squeeze derivatives to near-zero. By the time the gradient reaches early layers it is too small to move the weights — only the final layers receive any learning signal.')
    }
    if (res.overfit) {
        brokeLines.push(`• OVERFITTING: Train loss ${trainLoss} vs val loss ${valLoss} — gap of ${gap}. The model memorised training noise rather than learning a generalizable boundary. Needs regularization, dropout or smaller capacity.`)
    }
    if (!res.diverged && !res.flatlined && !res.vanished && !res.overfit) {
        brokeLines.push(`• INSUFFICIENT LEARNING: The model stabilised but never reached the win threshold of ${(mission.winThreshold * 100).toFixed(0)}% accuracy. The hyperparameter combination (LR, optimizer, batch size) did not interact optimally for this loss landscape.`)
    }
    brokeLines.push('')
    brokeLines.push(`Key insight: ${mission.hint || 'All hyperparameters interact — changing one in isolation often trades one failure mode for another.'}`)
    const broke = brokeLines.join('\n')

    // --- Core concept note ---
    let conceptLines = []
    conceptLines.push(`Core ML concept: ${mission.concept || 'Hyperparameter interactions'}`)
    conceptLines.push('')
    conceptLines.push(`Win condition required: ${mission.winCondition}`)
    if (mission.stretchGoal) conceptLines.push(`Stretch goal: ${mission.stretchGoal}`)
    conceptLines.push('')
    conceptLines.push('What students needed to discover:')
    // Mission-specific explanations
    if (mission.id === 'exploder') {
        conceptLines.push('1. LR=2.0 with SGD is always explosive — the update step overwhelms the gradient signal')
        conceptLines.push('2. SGD (no momentum adaptation) amplifies gradient noise at small batches — optimizer must be changed')
        conceptLines.push('3. Batch size=1 means each gradient is computed from a single sample — noise is maximal. Need batch≥32')
        conceptLines.push('4. All three must be fixed together: lower LR + adaptive optimizer (Adam/RMSProp) + batch≥32')
    } else if (mission.id === 'flatliner') {
        conceptLines.push('1. Zero weight init → symmetry problem: all neurons output the same value, gradients are identical, no learning')
        conceptLines.push('2. Sigmoid saturates in deep networks — derivative approaches zero for large activations (vanishing gradient)')
        conceptLines.push('3. 7 hidden layers with sigmoid = gradient multiplied by <1 seven times → near-zero by layer 1')
        conceptLines.push('4. Fix order: init first (Xavier/He), then activation (ReLU), confirming two separate problems')
    } else if (mission.id === 'memorizer') {
        conceptLines.push('1. 6 layers × 256 neurons for 150 training samples = millions of parameters memorizing noise')
        conceptLines.push('2. No dropout = no regularization pressure, model perfectly fits train set')
        conceptLines.push('3. Batch=512 on 150 samples means the full dataset each step — no stochastic noise to help generalize')
        conceptLines.push('4. Must reduce capacity (layers/width) AND add regularization (dropout) simultaneously')
    } else if (mission.id === 'slowlearner') {
        conceptLines.push('1. SGD on noisy data oscillates — gets trapped in flat regions of the loss landscape')
        conceptLines.push('2. The optimal LR is different for every optimizer: Adam prefers 0.001, SGD needs 0.1+')
        conceptLines.push('3. Cosine/plateau schedulers change the effective LR over time — different optimizers respond differently')
        conceptLines.push('4. Must explore the optimizer × LR × scheduler space systematically to find the peak')
    } else if (mission.id === 'symmetrybreaker') {
        conceptLines.push('1. Small batch (8) with no dropout creates mild overfitting visible in the val-train gap')
        conceptLines.push('2. Dropout effectiveness depends on batch size — more dropout needed when batch noise is low')
        conceptLines.push('3. L2 and dropout approach regularization differently: L2 shrinks weights, dropout removes pathways')
        conceptLines.push('4. Both the accuracy AND the gap must be satisfied — improving one can worsen the other')
    } else {
        conceptLines.push('1. Hyperparameters interact multiplicatively — the combined effect is not the sum of individual effects')
        conceptLines.push('2. Fixing one parameter in isolation often shifts the problem rather than solving it')
        conceptLines.push('3. Systematic exploration (one change at a time, reading the curve) is more efficient than guessing')
    }
    const concept = conceptLines.join('\n')

    return { approach, broke, concept }
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
    const [resettingTeamId, setResettingTeamId] = useState(null)
    const [resetDialog, setResetDialog] = useState({ open: false, team: null })
    const [resetFeedback, setResetFeedback] = useState(null)
    const [syncStatus, setSyncStatus] = useState('connecting')
    const [lastSyncAt, setLastSyncAt] = useState(null)
    const [rescuingTeamId, setRescuingTeamId] = useState(null)
    const [rescueDialog, setRescueDialog] = useState({ open: false, team: null })

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

    const handleResetRuns = async (team) => {
        if (!team?.id) return
        const targetSessionCode = team.sessionCode || team.name
        if (!targetSessionCode) {
            setResetFeedback({ type: 'error', text: 'Missing session code for reset' })
            return
        }

        setResettingTeamId(team.id)
        try {
            // 1) Remove FK references to runs before deleting runs.
            const { error: presResetErr } = await supabase
                .from('presentations')
                .update({
                    is_submitted: false,
                    is_presenting: false,
                    submitted_at: null,
                    best_run_id: null,
                })
                .eq('session_code', targetSessionCode)
            if (presResetErr) throw presResetErr

            // 2) Delete dependent badges and runs for this session code.
            const { error: badgesErr } = await supabase
                .from('badges')
                .delete()
                .eq('session_code', targetSessionCode)
            if (badgesErr) throw badgesErr

            const { error: runsErr } = await supabase
                .from('runs')
                .delete()
                .eq('session_code', targetSessionCode)
            if (runsErr) throw runsErr

            // 3) Reset run counters for all team rows mapped to this session code.
            const { error: teamErr } = await supabase
                .from('teams')
                .update({ run_count: 0 })
                .eq('session_code', targetSessionCode)
            if (teamErr) throw teamErr

            setRuns((prev) => prev.filter((r) => r.session_code !== targetSessionCode))
            setTeams((prev) =>
                prev.map((t) =>
                    t.session_code === targetSessionCode ? { ...t, run_count: 0 } : t,
                ),
            )
            setPresentations((prev) =>
                prev.map((p) =>
                    p.session_code === targetSessionCode
                        ? { ...p, is_submitted: false, is_presenting: false, submitted_at: null, best_run_id: null }
                        : p,
                ),
            )

            // Force-refresh from DB to avoid stale UI if realtime lags.
            const [sessionsRes, teamsRes, runsRes, presRes] = await Promise.all([
                supabase.from('sessions').select('*').in('session_code', TEAM_CODES),
                supabase.from('teams').select('*').in('session_code', TEAM_CODES),
                supabase.from('runs').select('*').in('session_code', TEAM_CODES).order('run_number', { ascending: true }),
                supabase.from('presentations').select('*').in('session_code', TEAM_CODES),
            ])
            setSessions(sessionsRes.data || [])
            setTeams(teamsRes.data || [])
            setRuns(runsRes.data || [])
            setPresentations(presRes.data || [])

            setLastSyncAt(new Date())
            setResetFeedback({ type: 'success', text: `Runs reset for ${targetSessionCode}.` })
        } catch (err) {
            setResetFeedback({ type: 'error', text: err?.message || 'Failed to reset runs' })
        } finally {
            setResettingTeamId(null)
        }
    }

    const openResetDialog = (team) => {
        setResetDialog({ open: true, team })
    }

    const closeResetDialog = () => {
        setResetDialog({ open: false, team: null })
    }

    const confirmResetDialog = async () => {
        const team = resetDialog.team
        closeResetDialog()
        if (team) await handleResetRuns(team)
    }

    // ── Rescue Deck ──────────────────────────────────────────────────────────
    const WINNING_CONFIGS = {
        exploder: { lr: 0.001, optimizer: 'adam', batchSize: 64, epochs: 30 },
        flatliner: { lr: 0.001, optimizer: 'adam', activation: 'relu', init: 'he', batchSize: 32, layers: 7, epochs: 50 },
        memorizer: { lr: 0.001, optimizer: 'adam', activation: 'relu', layers: 2, width: 32, dropout: 0.5, batchSize: 32, epochs: 60 },
        slowlearner: { lr: 0.001, optimizer: 'adam', scheduler: 'cosine', epochs: 50 },
        symmetrybreaker: { lr: 0.001, optimizer: 'adam', dropout: 0.2, batchSize: 64, epochs: 60 }
    }

    // Auto-prepares a standalone rescue presentation for a team that couldn't solve the mission.
    // Opens in a NEW TAB at /rescue?d=<base64> — zero DB writes, zero interference
    // with the team's own session or presentation link.
    const handleRescueDeck = async (team) => {
        if (!team?.id) return
        setRescuingTeamId(team.id)
        try {
            const missionObj = MISSIONS.find(m => m.id === team.missionId) || MISSIONS[0]

            // Pull the raw run rows the team has recorded
            let teamRuns = runs.filter(r => r.team_id === team.id)

            // If the team made ZERO runs, we need a demonstration curve for the instructor to explain!
            // We simulate a WINNING config for their assigned mission.
            let syntheticBest = null
            let isSynthetic = false
            if (teamRuns.length === 0) {
                isSynthetic = true
                const winOveride = WINNING_CONFIGS[missionObj.id] || {}
                const cfg = { ...(missionObj.defaultConfig || {}), ...winOveride }
                const simResult = await lookupCurve(cfg, missionObj)
                const syntheticRun = {
                    id: 'synthetic-run-1',
                    team_id: team.id,
                    run_number: 1,
                    config: cfg,
                    train_loss: simResult.trainLoss,
                    val_loss: simResult.valLoss,
                    accuracy: simResult.accuracy,
                    final_train_loss: simResult.finalTrainLoss,
                    final_val_loss: simResult.finalValLoss,
                    final_accuracy: simResult.finalAccuracy,
                    diverged: simResult.diverged,
                    vanished: simResult.vanished,
                    flatlined: simResult.flatlined,
                    overfit: simResult.overfit,
                    score: 0
                }
                teamRuns = [syntheticRun]
                syntheticBest = {
                    run: syntheticRun,
                    resultObj: simResult
                }
            }

            const notes = generateRescueNotes(team, syntheticBest, isSynthetic)

            const urlPayload = {
                sessionCode: team.sessionCode,
                missionId: team.missionId,
                runs: teamRuns,
                notes,
            }

            // Encode as base64url (URL-safe, no padding issues)
            const json = JSON.stringify(urlPayload)
            const b64 = btoa(unescape(encodeURIComponent(json)))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '')

            const url = `${window.location.origin}/rescue?d=${b64}`
            window.open(url, '_blank', 'noopener,noreferrer')

            setResetFeedback({ type: 'success', text: `Rescue deck opened for ${team.sessionCode} ✓` })
        } catch (err) {
            setResetFeedback({ type: 'error', text: err?.message || 'Failed to open rescue deck' })
        } finally {
            setRescuingTeamId(null)
            setRescueDialog({ open: false, team: null })
        }
    }


    const openRescueDialog = (team) => setRescueDialog({ open: true, team })
    const closeRescueDialog = () => setRescueDialog({ open: false, team: null })

    useEffect(() => {
        if (!resetFeedback) return undefined
        const timer = setTimeout(() => setResetFeedback(null), 2600)
        return () => clearTimeout(timer)
    }, [resetFeedback])

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
                    Tune CNN Admin
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
                        Tune CNN Admin
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
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider ${syncStatus === 'live'
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
                                className={`rounded-2xl border ${team?.isReady
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
                                                    onClick={() => openResetDialog(team)}
                                                    disabled={resettingTeamId === team.id}
                                                    className="text-[10px] uppercase font-bold tracking-wider rounded-lg bg-red/15 text-red border border-red/40 px-3 py-1.5 hover:bg-red/25 transition disabled:opacity-50"
                                                >
                                                    {resettingTeamId === team.id ? 'Resetting...' : 'Reset runs'}
                                                </button>
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
                                                <button
                                                    type="button"
                                                    onClick={() => openRescueDialog(team)}
                                                    disabled={rescuingTeamId === team.id}
                                                    title="Auto-generate presentation notes and submit the deck on behalf of this team"
                                                    className="text-[10px] uppercase font-bold tracking-wider rounded-lg bg-amber/15 text-amber border border-amber/40 px-3 py-1.5 hover:bg-amber/25 transition disabled:opacity-50"
                                                >
                                                    {rescuingTeamId === team.id ? 'Preparing…' : '🛟 Rescue Deck'}
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

            {resetFeedback && (
                <div className="pointer-events-none fixed bottom-6 right-6 z-40">
                    <div
                        className={`rounded-xl border px-4 py-3 text-sm font-mono shadow-xl ${resetFeedback.type === 'success'
                            ? 'border-green/40 bg-green/10 text-green'
                            : 'border-red/40 bg-red/10 text-red'
                            }`}
                    >
                        {resetFeedback.text}
                    </div>
                </div>
            )}

            {resetDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-red/30 bg-bg1 p-5 shadow-2xl">
                        <h3 className="font-['Syne'] text-xl font-bold text-text0">Reset Team Runs</h3>
                        <p className="mt-2 text-sm text-text1 leading-relaxed">
                            Reset all run history for{' '}
                            <span className="font-mono text-red">
                                {resetDialog.team?.sessionCode || resetDialog.team?.name || 'this session'}
                            </span>
                            ?
                        </p>
                        <p className="mt-2 text-xs text-text2">
                            This removes runs and badges, clears submitted presentation state, and sets run count back to 0.
                        </p>

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeResetDialog}
                                className="rounded-lg border border-white/20 bg-bg2 px-3 py-2 text-xs uppercase tracking-wider text-text1 hover:bg-bg3"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmResetDialog}
                                className="rounded-lg border border-red/50 bg-red/20 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red hover:bg-red/30"
                            >
                                Confirm Reset
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {rescueDialog.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl border border-amber/30 bg-bg1 p-6 shadow-2xl">
                        <h3 className="font-['Syne'] text-xl font-bold text-text0">🛟 Rescue Deck</h3>
                        <p className="mt-2 text-sm text-text1 leading-relaxed">
                            Prepare the presentation for{' '}
                            <span className="font-mono text-amber">
                                {rescueDialog.team?.sessionCode || 'this team'}
                            </span>{' '}
                            on their behalf?
                        </p>
                        <div className="mt-3 rounded-xl border border-amber/20 bg-amber/5 px-4 py-3 text-xs text-amber/80 leading-relaxed space-y-1">
                            <p>• Generates detailed notes explaining the mission failure mode, what broke, and the core ML concept</p>
                            <p>• Marks the deck as <span className="font-bold">submitted</span> so it appears ready in the projector view</p>
                            <p>• Based on the team&apos;s best run data ({rescueDialog.team?.runsUsed ?? 0} runs, best acc {((rescueDialog.team?.bestAccuracy || 0) * 100).toFixed(1)}%)</p>
                            <p>• You can still edit the notes in the presentation screen after rescue</p>
                        </div>
                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeRescueDialog}
                                className="rounded-lg border border-white/20 bg-bg2 px-3 py-2 text-xs uppercase tracking-wider text-text1 hover:bg-bg3"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => handleRescueDeck(rescueDialog.team)}
                                disabled={rescuingTeamId === rescueDialog.team?.id}
                                className="rounded-lg border border-amber/50 bg-amber/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber hover:bg-amber/30 disabled:opacity-50"
                            >
                                {rescuingTeamId === rescueDialog.team?.id ? 'Preparing rescue deck…' : 'Yes, prepare rescue deck'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}

export default AdminScreen
