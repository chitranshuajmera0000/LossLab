import { MISSIONS } from '../missions/missions.js'

/**
 * Fixed lab layout: TEAM01 → first mission, TEAM02 → second, … (same order as MISSIONS).
 * Used wherever DB `mission_id` might be missing or duplicated for pre-seeded sessions.
 */
export const LAB_TEAM_SESSION_CODES = MISSIONS.map((_, i) => `TEAM0${i + 1}`)

export function getMissionIdForLabSessionCode(sessionCode) {
    if (!sessionCode || typeof sessionCode !== 'string') return null
    const upper = sessionCode.toUpperCase()
    const idx = LAB_TEAM_SESSION_CODES.indexOf(upper)
    if (idx >= 0 && idx < MISSIONS.length) return MISSIONS[idx].id
    return null
}

export function getMissionForLabSessionCode(sessionCode) {
    const id = getMissionIdForLabSessionCode(sessionCode)
    if (!id) return null
    return MISSIONS.find((m) => m.id === id) ?? null
}
