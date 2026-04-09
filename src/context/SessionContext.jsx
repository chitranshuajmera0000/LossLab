/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'
import { supabase, generateSessionCode } from '../lib/supabase.js'
import { getMission } from '../missions/index.js'
import { getMissionIdForLabSessionCode } from '../config/labSessions.js'

const SessionContext = createContext(null)

const STORAGE_KEY = 'losslab_session'

export function SessionProvider({ children }) {
  const [sessionCode, setSessionCode] = useState(null)
  const [team, setTeam] = useState(null)
  const [mission, setMission] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRestoring, setIsRestoring] = useState(true)
  const [error, setError] = useState(null) 

  /**
   * Join an existing session using session code only (one team row per session code).
   */
  const joinSession = useCallback(async ({ code }) => {
    setIsLoading(true)
    setError(null)

    try {
      // 1. Validate session exists and is active
      const { data: sessionData, error: sessionErr } = await supabase
        .from('sessions')
        .select('session_code,mission_id,instructor_name,is_active')
        .eq('session_code', code)
        .single()

      if (sessionErr || !sessionData) return { error: 'not_found' }
      if (!sessionData.is_active) return { error: 'inactive' }

      const resolvedMissionId =
        getMissionIdForLabSessionCode(code) ?? sessionData.mission_id
      const missionObj = getMission(resolvedMissionId)

      // 2. Reuse existing team row for this session code if present.
      const { data: existingTeams, error: existingTeamsErr } = await supabase
        .from('teams')
        .select('*')
        .eq('session_code', code)
        .order('created_at', { ascending: true })
        .limit(1)

      if (existingTeamsErr) throw existingTeamsErr

      let teamData = existingTeams?.[0] || null

      if (!teamData) {
        // 3. First join for this session code — create canonical team row.
        const { data: newTeam, error: teamErr } = await supabase
          .from('teams')
          .insert([{ session_code: code, team_name: code, color: '#4f8ef7' }])
          .select('*')
          .single()

        if (teamErr) throw teamErr
        teamData = newTeam
      }

      // 4. Persist to localStorage and set state
      const sessionState = {
        teamId: teamData.id,
        sessionCode: code,
        color: teamData.color,
        missionId: resolvedMissionId,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionState))

      setSessionCode(code)
      setTeam(teamData)
      setMission(missionObj)

      return { team: teamData, session: sessionData, mission: missionObj, resumed: !!existingTeams?.length }
    } catch (err) {
      const msg = err.message || 'Failed to join session'
      setError(msg)
      return { error: msg }
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Create a new session as instructor
   */
  const createSession = useCallback(async ({ missionId, instructorName, duration }) => {
    setIsLoading(true)
    setError(null)

    try {
      const missionObj = getMission(missionId)
      const code = generateSessionCode()

      const { data: sessionData, error: sessionErr } = await supabase
        .from('sessions')
        .insert([
          {
            session_code: code,
            mission_id: missionId,
            instructor_name: instructorName,
            is_active: true,
          },
        ])
        .select('session_code,mission_id,instructor_name,is_active')
        .single()

      if (sessionErr) throw sessionErr

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sessionCode: code,
          missionId,
        }),
      )

      setSessionCode(code)
      setMission(missionObj)

      return { code, session: sessionData, mission: missionObj, duration }
    } catch (err) {
      setError(err.message || 'Failed to create session')
      return { error: err.message || 'Failed to create session' }
    } finally {
      setIsLoading(false)
    }
  }, [])
  const restoreSession = useCallback(async () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return false

    try {
      const state = JSON.parse(stored)

      // Verify team still exists in DB
      const { data: teamData, error: teamErr } = await supabase
        .from('teams')
        .select('id,team_name,color,run_count')
        .eq('id', state.teamId)
        .single()

      if (teamErr || !teamData) {
        localStorage.removeItem(STORAGE_KEY)
        return false
      }

      // Restore state (lab codes always map to a fixed mission order)
      const resolvedMissionId =
        getMissionIdForLabSessionCode(state.sessionCode) ?? state.missionId
      setSessionCode(state.sessionCode)
      setTeam(teamData)
      setMission(getMission(resolvedMissionId))
      if (resolvedMissionId !== state.missionId) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...state, missionId: resolvedMissionId }),
        )
      }

      return true
    } catch {
      localStorage.removeItem(STORAGE_KEY)
      return false
    }
  }, [])

  /**
   * Save a run to the database
   */
  const saveRun = useCallback(
    async (runData) => {
      if (!team) throw new Error('No team joined')

      const runPayload = {
        team_id: team.id,
        session_code: sessionCode,
        run_number: team.run_count + 1,
        config: runData.config,
        train_loss: runData.trainLoss ?? [],
        val_loss: runData.valLoss ?? [],
        accuracy: runData.accuracy ?? [],
        final_train_loss: runData.finalTrainLoss ?? 0,
        final_val_loss: runData.finalValLoss ?? 0,
        final_accuracy: runData.finalAccuracy ?? 0,
        score: runData.score ?? 0,
        diverged: runData.diverged ?? false,
        vanished: runData.vanished ?? false,
        overfit: runData.overfit ?? false,
        flatlined: runData.flatlined ?? false,
      }

      try {
        if (!navigator.onLine) throw new Error('offline')
        const { data: run, error: runErr } = await supabase
          .from('runs')
          .insert([runPayload])
          .select('*')
          .single()
        if (runErr) throw runErr
        await supabase
          .from('teams')
          .update({ run_count: team.run_count + 1 })
          .eq('id', team.id)
        // Update local state so next run_number increments correctly
        setTeam((prev) => ({ ...prev, run_count: (prev?.run_count || 0) + 1 }))
        return run
      } catch (err) {
        const message = String(err?.message || '').toLowerCase()
        const isNetworkLikeFailure =
          err.message === 'offline' ||
          !navigator.onLine ||
          message.includes('failed to fetch') ||
          message.includes('networkerror') ||
          message.includes('network request failed') ||
          message.includes('fetch') ||
          message.includes('timeout')

        // Network-restricted/offline fallback: save locally so training flow remains usable.
        if (isNetworkLikeFailure) {
          const pendingKey = 'losslab_pending_runs'
          const pending = JSON.parse(localStorage.getItem(pendingKey) || '[]')
          localStorage.setItem(pendingKey, JSON.stringify([...pending, runPayload]))
          if (window.toast) window.toast('Saved locally — will sync when reconnected', { type: 'info' })
          else if (window?.toast) window.toast('Saved locally — will sync when reconnected')
          // Still increment local count so subsequent offline runs get correct run_number
          setTeam((prev) => ({ ...prev, run_count: (prev?.run_count || 0) + 1 }))
          return { ...runPayload, id: `local-${Date.now()}` }
        }
        setError(err.message || 'Failed to save run')
        throw err
      }
    },
    [team, sessionCode],
  )

  // Sync pending runs on reconnect
  useEffect(() => {
    function flushPending() {
      const pendingKey = 'losslab_pending_runs'
      const pending = JSON.parse(localStorage.getItem(pendingKey) || '[]')
      if (!pending.length) return
      Promise.all(
        pending.map(async (run) => {
          try {
            await supabase.from('runs').insert([run])
            await supabase.from('teams').update({ run_count: (team?.run_count || 0) + 1 }).eq('id', run.team_id)
          } catch {
            // Keep syncing remaining rows; individual row failures are non-fatal.
            return null
          }
        })
      ).then(() => {
        if (window.toast) window.toast(`Synced ${pending.length} pending runs`, { type: 'success' })
        else if (window?.toast) window.toast(`Synced ${pending.length} pending runs`)
        localStorage.removeItem(pendingKey)
      })
    }
    window.addEventListener('online', flushPending)
    if (navigator.onLine) flushPending()
    return () => window.removeEventListener('online', flushPending)
  }, [team])

  /**
   * Save badges for a team
   */
  const saveBadges = useCallback(
    async (badgeKeys, runId) => {
      if (!team) throw new Error('No team joined')

      try {
        const badgeRows = badgeKeys.map((key) => ({
          team_id: team.id,
          session_code: sessionCode,
          badge_key: key,
          run_id: runId,
        }))

        const { error: badgeErr } = await supabase
          .from('badges')
          .upsert(badgeRows, { onConflict: 'team_id,badge_key' })

        if (badgeErr) throw badgeErr
      } catch (err) {
        setError(err.message || 'Failed to save badges')
        throw err
      }
    },
    [team, sessionCode],
  )

  /**
   * Save or update presentation
   */
  const savePresentation = useCallback(
    async (notes, bestRunId) => {
      if (!team) throw new Error('No team joined')

      try {
        const { error: err } = await supabase
          .from('presentations')
          .upsert([
            {
              team_id: team.id,
              session_code: sessionCode,
              best_run_id: bestRunId,
              note_approach: notes?.approach || '',
              note_broke: notes?.broke || '',
              note_concept: notes?.concept || '',
            },
          ], { onConflict: 'team_id' })

        if (err) throw err
      } catch (err) {
        setError(err.message || 'Failed to save presentation')
        throw err
      }
    },
    [team, sessionCode],
  )

  /**
   * Submit presentation
   */
  const submitPresentation = useCallback(async () => {
    if (!team) throw new Error('No team joined')

    try {
      const { error: err } = await supabase
        .from('presentations')
        .update({ is_submitted: true, submitted_at: new Date().toISOString() })
        .eq('team_id', team.id)

      if (err) throw err
    } catch (err) {
      setError(err.message || 'Failed to submit presentation')
      throw err
    }
  }, [team])

  /**
   * Set presenting flag
   */
  const setPresenting = useCallback(
    async (isPresenting) => {
      if (!team) throw new Error('No team joined')

      try {
        const { error: err } = await supabase
          .from('presentations')
          .update({ is_presenting: isPresenting })
          .eq('team_id', team.id)

        if (err) throw err
      } catch (err) {
        setError(err.message || 'Failed to update presenting status')
        throw err
      }
    },
    [team],
  )

  useEffect(() => {
    restoreSession().finally(() => {
      setIsRestoring(false)
    })
  }, [restoreSession])

  const value = useMemo(
    () => ({
      sessionCode,
      team,
      mission,
      isLoading,
      isRestoring,
      error,
      joinSession,
      createSession,
      restoreSession,
      saveRun,
      saveBadges,
      savePresentation,
      submitPresentation,
      setPresenting,
      setMission,
    }),
    [sessionCode, team, mission, isLoading, isRestoring, error, joinSession, createSession, restoreSession, saveRun, saveBadges, savePresentation, submitPresentation, setPresenting, setMission],
  )


  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSessionContext() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSessionContext must be used within a SessionProvider')
  }
  return context
}

export default SessionProvider
