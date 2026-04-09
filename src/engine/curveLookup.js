import simulate from './simulate.js'

// Engine-only adapter kept for compatibility with older imports.
export async function lookupCurve(config, missionConfig = {}) {
  return simulate(config, missionConfig)
}

export async function preloadMission(missionId) {
  void missionId
}

export function getSnappedLR(lr) {
  return Number(lr)
}
