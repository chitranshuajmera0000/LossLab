import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { getMission } from '../missions/index.js'
import { getMissionIdForLabSessionCode } from '../config/labSessions.js'

export function useFeed(sessionCode) {
  const [teams, setTeams] = useState([])
  const [runs, setRuns] = useState([])
  const [sessionData, setSessionData] = useState(null)
  const [presentationsByTeam, setPresentationsByTeam] = useState({})
  const [isLoading, setIsLoading] = useState(Boolean(sessionCode))
  const [realtimeStatus, setRealtimeStatus] = useState(sessionCode ? 'connecting' : 'idle')
  const [reconnectNonce, setReconnectNonce] = useState(0)

  const channelRef = useRef(null)

  const reconnectRealtime = useCallback(() => {
    setRealtimeStatus('connecting')
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    setReconnectNonce((value) => value + 1)
    return { ok: true }
  }, [])

  useEffect(() => {
    if (!sessionCode) {
      return
    }

    let isMounted = true

    async function initFeed() {
      try {
        // 1. Fetch session
        const { data: sess } = await supabase
          .from('sessions')
          .select('*')
          .eq('session_code', sessionCode)
          .single()

        if (isMounted && sess) {
          setSessionData(sess)
        }

        // 2. Fetch teams
        const { data: teamsData } = await supabase
          .from('teams')
          .select('*')
          .eq('session_code', sessionCode)
          .order('id')

        if (isMounted && teamsData) {
          setTeams(teamsData)
        }

        // 3. Fetch all runs
        const { data: runsData } = await supabase
          .from('runs')
          .select('*')
          .eq('session_code', sessionCode)
          .order('created_at', { ascending: false })

        if (isMounted && runsData) {
          setRuns(runsData)
        }

        // 4. Fetch presentations to derive presenter + submission status
        const { data: presentations } = await supabase
          .from('presentations')
          .select('*')
          .eq('session_code', sessionCode)
        if (isMounted && presentations) {
          const map = {}
          presentations.forEach((row) => {
            map[row.team_id] = row
          })
          setPresentationsByTeam(map)
        }

        // 5. keep team run counts fresh for realtime badges/status
        if (isMounted && teamsData) {
          setTeams(teamsData)
        }

        if (isMounted) {
          setIsLoading(false)
          setupRealtimeSubscriptions()
        }
      } catch (err) {
        console.error('Feed init error:', err)
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    function setupRealtimeSubscriptions() {
      const channel = supabase.channel(`feed:${sessionCode}`)

      // Subscribe to new and updated runs
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'runs',
          filter: `session_code=eq.${sessionCode}`,
        },
        (payload) => {
          if (!isMounted) return

          if (payload.eventType === 'INSERT') {
            const newRun = payload.new
            setRuns((prev) => [newRun, ...prev])
            return
          }

          if (payload.eventType === 'UPDATE') {
            const updatedRun = payload.new
            setRuns((prev) => prev.map((run) => (run.id === updatedRun.id ? updatedRun : run)))
          }
        },
      )

      // Subscribe to team changes
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: `session_code=eq.${sessionCode}`,
        },
        (payload) => {
          if (!isMounted) return

          if (payload.eventType === 'INSERT') {
            setTeams((prev) => [...prev, payload.new])
            return
          }

          if (payload.eventType === 'UPDATE') {
            setTeams((prev) => prev.map((team) => (team.id === payload.new.id ? payload.new : team)))
          }
        },
      )

      // Subscribe to presentation updates
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'presentations',
          filter: `session_code=eq.${sessionCode}`,
        },
        (payload) => {
          if (!isMounted) return

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updated = payload.new
            setPresentationsByTeam((prev) => ({
              ...prev,
              [updated.team_id]: updated,
            }))
          }
        },
      )

      // Subscribe to session updates (reveal_mode)
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `session_code=eq.${sessionCode}`,
        },
        (payload) => {
          if (isMounted) {
            const updated = payload.new
            setSessionData(updated)
          }
        },
      )

      channel.subscribe((status) => {
        if (!isMounted) return
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected')
          return
        }
        if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('error')
          return
        }
        if (status === 'CLOSED') {
          setRealtimeStatus('disconnected')
        }
      })
      channelRef.current = channel
    }

    initFeed()

    return () => {
      isMounted = false
      setRealtimeStatus('disconnected')
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [sessionCode, reconnectNonce])

  const teamMap = useMemo(() => {
    return teams.reduce((map, team) => {
      map[team.id] = team
      return map
    }, {})
  }, [teams])

  const bestRuns = useMemo(() => {
    const result = {}
    for (const team of teams) {
      const teamRuns = runs.filter((run) => run.team_id === team.id)
      result[team.id] = teamRuns.sort((a, b) => (b.final_accuracy || 0) - (a.final_accuracy || 0))[0] || null
    }
    return result
  }, [teams, runs])

  const leaderboard = useMemo(() => {
    const rows = teams.map((team) => {
      const bestRun = bestRuns[team.id]
      const presentation = presentationsByTeam[team.id]
      return {
        id: team.id,
        name: team.team_name,
        color: team.color,
        accuracy: bestRun?.final_accuracy || 0,
        val_loss: bestRun?.final_val_loss,
        score: bestRun?.score || 0,
        optimizer: bestRun?.config?.optimizer,
        activation: bestRun?.config?.activation,
        run_number: bestRun?.run_number || team.run_count || 0,
        status: presentation?.is_presenting ? 'presenting' : presentation?.is_submitted ? 'submitted' : team.run_count > 0 ? 'running' : 'idle',
      }
    })

    return rows.sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0)
      return (b.accuracy || 0) - (a.accuracy || 0)
    })
  }, [teams, bestRuns, presentationsByTeam])

  const presentingTeamId =
    Object.values(presentationsByTeam).find((row) => row?.is_presenting)?.team_id || null
  const presenter = presentingTeamId ? teamMap[presentingTeamId] || null : null

  const mission = sessionData
    ? getMission(getMissionIdForLabSessionCode(sessionCode) ?? sessionData.mission_id)
    : null
  const dataset = mission ? { name: mission.dataset } : null
  const totalTeams = teams.length
  const submittedCount = teams.filter((team) => bestRuns[team.id]).length
  const timerStart = sessionData?.created_at || sessionData?.started_at || null
  const storedSession = (() => {
    try {
      return JSON.parse(localStorage.getItem('losslab_session') || 'null')
    } catch {
      return null
    }
  })()
  const durationMinutes =
    sessionData?.duration_minutes ??
    sessionData?.duration ??
    (storedSession?.sessionCode === sessionCode ? storedSession?.sessionDuration : null) ??
    mission?.timeLimit ??
    null
  const toggleRevealMode = async () => {
    if (!sessionCode || !sessionData) return { error: 'No active session' }
    const nextRevealMode = !(sessionData.reveal_mode ?? false)
    const { error } = await supabase
      .from('sessions')
      .update({ reveal_mode: nextRevealMode })
      .eq('session_code', sessionCode)
    if (error) return { error: error.message || 'Failed to update reveal mode' }
    return { revealMode: nextRevealMode }
  }

  const endSession = async () => {
    if (!sessionCode) return { error: 'No active session' }
    const { error } = await supabase
      .from('sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('session_code', sessionCode)
    if (error) return { error: error.message || 'Failed to end session' }
    return { ended: true }
  }

  return {
    teams,
    runs,
    leaderboard,
    sessionData,
    presentingTeam: presenter,
    revealMode: sessionData?.reveal_mode ?? false,
    isLoading,
    bestRuns,
    mission,
    dataset,
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
  }
}

export default useFeed
