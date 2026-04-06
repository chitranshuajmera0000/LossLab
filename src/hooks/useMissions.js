import MISSIONS from '../missions'

/**
 * useMissions hook
 * Returns all missions and helpers
 */
import { useMemo } from 'react'

export function useMissions() {
  // In a real app, this could fetch from API or context
  // Here, just return the static MISSIONS array
  return useMemo(() => ({ missions: MISSIONS }), [])
}

export default useMissions
