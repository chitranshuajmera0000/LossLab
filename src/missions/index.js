import MISSIONS from './missions.js'

/**
 * Get a mission by ID
 * @param {string} id - Mission ID
 * @returns {object} Mission object
 * @throws Error if mission not found
 */
export function getMission(id) {
  const mission = MISSIONS.find((m) => m.id === id)
  if (!mission) {
    throw new Error(`Mission not found: ${id}`)
  }
  return mission
}

/**
 * Get default config for a mission
 * Returns a deep copy to avoid mutations
 * @param {string} missionId - Mission ID
 * @returns {object} Default config
 */
export function getDefaultConfig(missionId) {
  const mission = getMission(missionId)
  return JSON.parse(JSON.stringify(mission.defaultConfig))
}

/**
 * Check if a parameter is locked in a mission
 * @param {string} missionId - Mission ID
 * @param {string} paramKey - Parameter key to check
 * @returns {boolean}
 */
export function isParamLocked(missionId, paramKey) {
  const mission = getMission(missionId)
  return mission.lockedParams.includes(paramKey)
}

/**
 * Check if win condition is met
 * @param {string} missionId - Mission ID
 * @param {object} result - Simulation result
 * @param {array} allRuns - Array of all previous runs with configs
 * @returns {boolean}
 */
export function checkWinCondition(missionId, result, allRuns = []) {
  const mission = getMission(missionId)
  return mission.winFn(result, allRuns)
}

/**
 * Check if stretch goal is met
 * @param {string} missionId - Mission ID
 * @param {object} result - Simulation result
 * @param {array} allRuns - Array of all previous runs
 * @returns {boolean}
 */
export function checkStretchGoal(missionId, result, allRuns = []) {
  const mission = getMission(missionId)
  return mission.stretchFn(result, allRuns)
}

/**
 * Get mission progress from run history
 * @param {string} missionId - Mission ID
 * @param {array} allRuns - Array of run objects with structure:
 *   { config, finalAccuracy, finalValLoss, finalTrainLoss, diverged, vanished, flatlined, trainLoss }
 * @returns {object} Progress metrics
 */
export function getMissionProgress(missionId, allRuns = []) {
  const runsUsed = allRuns.length
  const bestAccuracy = allRuns.length > 0 ? Math.max(...allRuns.map((r) => r.finalAccuracy || 0)) : 0

  // Check win condition
  let winAchieved = false
  if (allRuns.length > 0) {
    const latestRun = allRuns[allRuns.length - 1]
    const latestResult = latestRun.result || latestRun
    winAchieved = checkWinCondition(missionId, latestResult, allRuns)
  }

  // Check stretch goal
  let stretchAchieved = false
  if (allRuns.length > 0) {
    const latestRun = allRuns[allRuns.length - 1]
    const latestResult = latestRun.result || latestRun
    stretchAchieved = checkStretchGoal(missionId, latestResult, allRuns)
  }

  // Count unique optimizers used
  const uniqueOptimizers = new Set(allRuns.map((r) => r.config?.optimizer).filter(Boolean))

  // Count unique batch sizes used
  const uniqueBatchSizes = new Set(allRuns.map((r) => r.config?.batchSize).filter((b) => b !== undefined))

  return {
    runsUsed,
    bestAccuracy,
    winAchieved,
    stretchAchieved,
    uniqueOptimizers: uniqueOptimizers.size,
    uniqueBatchSizes: uniqueBatchSizes.size,
  }
}

// Export missions for direct access
export { default as MISSIONS } from './missions.js'

export default MISSIONS
