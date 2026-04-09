import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import calculateScore from '../engine/scoring.js'
import { MISSIONS } from '../missions/missions.js'
import { getMissionForLabSessionCode } from '../config/labSessions.js'
import { normalizeAccuracy, normalizeScore, normalizeSeries } from '../utils/metricsNormalization.js'

export function processRunsForMission(runsData, mission) {
    const processedRuns = []
    for (const r of runsData || []) {
        const resultObj = {
            trainLoss: r.train_loss || [],
            valLoss: r.val_loss || [],
            accuracy: normalizeSeries(r.accuracy || []),
            finalAccuracy: normalizeAccuracy(r.final_accuracy || 0),
            finalTrainLoss: r.final_train_loss || 0,
            finalValLoss: r.final_val_loss || 0,
            diverged: r.diverged || false,
            vanished: r.vanished || false,
            overfit: r.overfit || false,
            flatlined: r.flatlined || false,
            epochs: Array.isArray(r.train_loss) ? r.train_loss.length : 0,
        }
        const nextScore = mission
            ? calculateScore(r.config, resultObj, processedRuns, mission)
            : { total: normalizeScore(r.score), breakdown: [], badges: [], scoreBreakdownLabels: [] }
        processedRuns.push({
            ...r,
            final_accuracy: normalizeAccuracy(r.final_accuracy || 0),
            score: normalizeScore(r.score),
            result: resultObj,
            fullScore: nextScore,
        })
    }
    return processedRuns
}

function pickBestRun(processedRuns) {
    if (!processedRuns.length) return null
    return processedRuns.reduce((best, run) =>
        (run.final_accuracy || 0) > (best.final_accuracy || 0) ? run : best,
    )
}

/**
 * Loads team, mission (from lab session code), runs, notes + realtime updates for the presentation deck.
 */
export function usePresentationDeckData(teamId) {
    const channelRef = useRef(null)
    const missionRef = useRef(null)

    const [isLoading, setIsLoading] = useState(Boolean(teamId))
    const [notFound, setNotFound] = useState(false)
    const [teamRow, setTeamRow] = useState(null)
    const [mission, setMission] = useState(null)
    const [allRuns, setAllRuns] = useState([])
    const [bestRun, setBestRun] = useState(null)
    const [notes, setNotes] = useState({ approach: '', broke: '', concept: '' })

    useEffect(() => {
        let active = true

        if (!teamId) {
            setIsLoading(false)
            setNotFound(false)
            setTeamRow(null)
            setMission(null)
            setAllRuns([])
            setBestRun(null)
            setNotes({ approach: '', broke: '', concept: '' })
            return
        }

        async function load() {
            setIsLoading(true)
            setNotFound(false)

            const { data: teamData, error: teamErr } = await supabase
                .from('teams')
                .select('*')
                .eq('id', teamId)
                .maybeSingle()

            if (!active) return

            if (teamErr || !teamData) {
                setNotFound(true)
                setTeamRow(null)
                setMission(null)
                setAllRuns([])
                setBestRun(null)
                setIsLoading(false)
                return
            }

            const missionObj =
                getMissionForLabSessionCode(teamData.session_code) ?? MISSIONS[0]
            missionRef.current = missionObj
            setTeamRow(teamData)
            setMission(missionObj)

            const { data: runsData } = await supabase
                .from('runs')
                .select('*')
                .eq('team_id', teamId)
                .order('run_number', { ascending: true })

            const { data: presentation } = await supabase
                .from('presentations')
                .select('note_approach,note_broke,note_concept')
                .eq('team_id', teamId)
                .maybeSingle()

            if (!active) return

            const processed = processRunsForMission(runsData, missionObj)
            setAllRuns(processed)
            setBestRun(pickBestRun(processed))
            setNotes({
                approach: presentation?.note_approach || '',
                broke: presentation?.note_broke || '',
                concept: presentation?.note_concept || '',
            })
            setIsLoading(false)
        }

        load()

        const channel = supabase.channel(`present:${teamId}`)

        channel.on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'runs',
                filter: `team_id=eq.${teamId}`,
            },
            async () => {
                const m = missionRef.current
                const { data: runsData } = await supabase
                    .from('runs')
                    .select('*')
                    .eq('team_id', teamId)
                    .order('run_number', { ascending: true })
                const processed = processRunsForMission(runsData, m)
                setAllRuns(processed)
                setBestRun(pickBestRun(processed))
            },
        )

        channel.on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'presentations',
                filter: `team_id=eq.${teamId}`,
            },
            (payload) => {
                setNotes({
                    approach: payload.new.note_approach || '',
                    broke: payload.new.note_broke || '',
                    concept: payload.new.note_concept || '',
                })
            },
        )

        channel.subscribe()
        channelRef.current = channel

        return () => {
            active = false
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
        }
    }, [teamId])

    return {
        isLoading,
        notFound,
        teamRow,
        mission,
        allRuns,
        bestRun,
        notes,
    }
}
