/**
 * curveLookup.js — src/engine/curveLookup.js
 *
 * Drop-in async replacement for simulate().
 * Returns real pre-computed training curves from Kaggle grid-search JSON.
 * Falls back to the parametric simulate() engine on any miss.
 *
 * HOW TO WIRE IN:
 *   In useSimulation.js, change ONE line:
 *     was:  import simulate from '../engine/simulate.js'
 *     now:  import { lookupCurve as simulate } from '../engine/curveLookup.js'
 *
 *   runSimulation is already async so nothing else changes.
 */

import simulateFallback from './simulate.js'

// Lazy loaders — JSON only fetched when that mission is first played.
// NOTE: 'exploder' (Mission 1) intentionally excluded — the parametric engine
// enforces the correct failure modes (sgd+small-batch must fail without fixing
// all 3 params). Real Kaggle data shows low-LR configs converging regardless
// of batch size, which breaks the pedagogical requirement.
const LOADERS = {
  flatliner: () => import('../data/flatliner_curves.json'),
  memorizer: () => import('../data/memorizer_curves.json'),
  slowlearner: () => import('../data/slowlearner_curves.json'),
  symmetrybreaker: () => import('../data/symmetrybreaker_curves.json'),
}

const CACHE = {}

async function loadData(missionId) {
  if (CACHE[missionId]) return CACHE[missionId]
  const loader = LOADERS[missionId]
  if (!loader) return null
  try {
    const mod = await loader()
    CACHE[missionId] = mod.default ?? mod
    return CACHE[missionId]
  } catch (e) {
    console.warn(`[curveLookup] Could not load "${missionId}":`, e.message)
    return null
  }
}

// LR grid used during Kaggle training — snap slider value to nearest point
const LR_GRID = [0.0001, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0]
function snapLR(lr) {
  return LR_GRID.reduce((b, v) => Math.abs(v - lr) < Math.abs(b - lr) ? v : b)
}

// Keys that were part of the training grid (no null CNN params)
const GRID_KEYS = [
  'activation', 'batchNorm', 'batchSize', 'dropout',
  'init', 'layers', 'lr', 'optimizer',
  'regularization', 'scheduler', 'width',
]

function makeKey(config, defaultConfig) {
  const merged = { ...(defaultConfig ?? {}), ...config }
  const entry = {}
  for (const k of GRID_KEYS) {
    const v = merged[k]
    if (v !== null && v !== undefined) {
      entry[k] = k === 'lr' ? snapLR(v) : v
    }
  }
  // Sort keys — must match Python's sort_keys=True
  let keyStr = JSON.stringify(Object.fromEntries(Object.keys(entry).sort().map(k => [k, entry[k]])))

  // Match Python json.dumps float formatting for grid values that end in .0
  keyStr = keyStr.replace(/"dropout":0([,}])/g, '"dropout":0.0$1')
  keyStr = keyStr.replace(/"lr":1([,}])/g, '"lr":1.0$1')
  keyStr = keyStr.replace(/"lr":2([,}])/g, '"lr":2.0$1')

  return keyStr
}

function deriveResult(tl, vl, ac, missionId, config) {
  const epochs = tl.length
  const finalTrainLoss = tl[epochs - 1]
  const finalValLoss = vl[epochs - 1]
  const finalAccuracy = ac[epochs - 1]
  const gap = finalValLoss - finalTrainLoss
  const diverged = Math.max(...tl) > 4.0
  const flatlined = finalAccuracy < 0.15 && Math.max(...ac) < 0.2
  const bestTrainLoss = Math.min(...tl)
  const explodeEpoch = diverged ? tl.findIndex(l => l > 4) : 3

  let plateauEpoch = null
  for (let i = 4; i < tl.length; i++) {
    if (tl[i - 4] - tl[i] < 0.01) { plateauEpoch = i; break }
  }

  return {
    trainLoss: tl, valLoss: vl, accuracy: ac, epochs,
    finalTrainLoss, finalValLoss, finalAccuracy,
    diverged, vanished: flatlined, overfit: gap > 0.12, flatlined,
    plateauEpoch, bestTrainLoss, rescuedEpoch: null,
    missionId: missionId ?? null,
    config: config ?? null,
    params: {
      L0: tl[0], Lfloor: bestTrainLoss, decay: 0.08,
      noiseScale: 0.04, noiseMultiplier: 1.0,
      explode: diverged, explodeEpoch,
      vanishing: flatlined, flatline: flatlined,
      overfit: gap > 0.12, overfitEpoch: 20, spikeEpoch: null,
    },
    phases: tl.map((loss, i) => ({
      epoch: i + 1,
      phase: i < 2 ? 'warmup' : i >= epochs - 5 ? 'fine-tune' : 'core',
      effectiveLr: 0, trainLoss: loss, valLoss: vl[i], accuracy: ac[i],
    })),
    effectiveLrHistory: new Array(epochs).fill(0),
  }
}

// Main export — async, signature matches simulate(config, missionConfig)
export async function lookupCurve(config, missionConfig = {}) {
  const missionId = missionConfig?.id
  if (!missionId || !LOADERS[missionId]) {
    const r = simulateFallback(config, missionConfig)
    return { ...r, config }
  }

  const data = await loadData(missionId)
  if (!data) {
    console.warn(`[curveLookup] No data for "${missionId}", using simulate()`)
    const r = simulateFallback(config, missionConfig)
    return { ...r, config }
  }

  const key = makeKey(config, missionConfig.defaultConfig ?? {})
  const entry = data[key]
  if (!entry) {
    console.warn(`[curveLookup] Key miss for "${missionId}" (lr→${snapLR(config.lr)}), using simulate()`)
    const r = simulateFallback(config, missionConfig)
    return { ...r, config }
  }

  return deriveResult(entry.tl, entry.vl, entry.ac, missionId, config)
}

// Preload a mission's JSON before first run — call on session join
export async function preloadMission(missionId) {
  if (!CACHE[missionId]) await loadData(missionId)
}

// Returns the snapped LR value for optional UI display
export function getSnappedLR(lr) { return snapLR(lr) }
