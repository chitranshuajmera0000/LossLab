import resolveParams from './resolveParams.js'
import applyInteractions from './interactions.js'

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function simpleHash(str) {
  let hash = 0
  for (let index = 0; index < str.length; index += 1) {
    hash = Math.imul(31, hash) + str.charCodeAt(index)
    hash |= 0
  }
  return hash
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function getMissionProfile(missionConfig = {}) {
  switch (missionConfig.id) {
    case 'exploder':
      return { warmup: 2, core: 0.9, fineTune: 0.55, plateauThreshold: 0.012, rescueBoost: 0.7 }
    case 'flatliner':
      return { warmup: 3, core: 0.8, fineTune: 0.5, plateauThreshold: 0.01, rescueBoost: 0.6 }
    case 'memorizer':
      return { warmup: 2, core: 1.0, fineTune: 0.7, plateauThreshold: 0.009, rescueBoost: 0.65 }
    case 'slowlearner':
      return { warmup: 2, core: 0.95, fineTune: 0.75, plateauThreshold: 0.011, rescueBoost: 0.75 }
    case 'symmetrybreaker':
      return { warmup: 2, core: 0.88, fineTune: 0.62, plateauThreshold: 0.01, rescueBoost: 0.7 }
    default:
      return { warmup: 2, core: 0.92, fineTune: 0.68, plateauThreshold: 0.01, rescueBoost: 0.7 }
  }
}

function getPhase(epoch, totalEpochs, rescuedEpoch, plateauEpoch) {
  if (rescuedEpoch !== null && epoch >= rescuedEpoch) return 'rescue'
  if (plateauEpoch !== null && epoch >= plateauEpoch) return 'plateau-watch'
  if (epoch < 2) return 'warmup'
  if (epoch >= Math.max(0, totalEpochs - 5)) return 'fine-tune'
  return 'core'
}

function schedulerMultiplier(scheduler, progress, plateauTriggered) {
  if (scheduler === 'cosine') {
    return 0.55 + 0.45 * Math.cos(Math.PI * progress)
  }

  if (scheduler === 'step') {
    return progress > 0.55 ? 0.65 : 1
  }

  if (scheduler === 'plateau') {
    return plateauTriggered ? 0.5 : 1
  }

  return 1
}

function applyMissionDifficulty(params, config, missionConfig = {}) {
  const missionId = missionConfig.id || null

  // Global difficulty bump so convergence requires cleaner configs.
  params.Lfloor *= 1.06
  params.decay *= 0.92
  params.noiseScale *= 1.1

  if (config.batchSize <= 8) {
    params.noiseScale *= 1.2
  }

  if (!missionId) return params

  if (missionId === 'exploder') {
    if (config.optimizer === 'sgd' && config.batchSize < 32) {
      params.noiseScale *= 1.35
      params.Lfloor = Math.max(params.Lfloor, 0.62)
    }
    if (config.lr >= 0.5) {
      params.explode = true
      params.explodeEpoch = Math.min(params.explodeEpoch, 4)
    }
  }

  if (missionId === 'flatliner') {
    if (!['he', 'xavier'].includes(config.init)) {
      params.flatline = params.flatline || config.init === 'zeros'
      params.decay *= 0.75
      params.Lfloor = Math.max(params.Lfloor, 0.95)
    }
    if (!['relu', 'leaky', 'elu'].includes(config.activation)) {
      params.vanishing = true
      params.Lfloor = Math.max(params.Lfloor, 1.05)
      params.decay *= 0.65
    }
  }

  if (missionId === 'memorizer') {
    if ((config.layers >= 4 || config.width >= 128) && config.dropout < 0.2) {
      params.overfit = true
      params.overfitEpoch = Math.min(params.overfitEpoch, 9)
      params.Lfloor *= 1.08
    }
    if (config.regularization === 'none') {
      params.noiseScale *= 1.15
    }
  }

  if (missionId === 'slowlearner') {
    if (config.scheduler === 'none') {
      params.decay *= 0.72
      params.Lfloor = Math.max(params.Lfloor, 0.34)
    }
    if (config.optimizer === 'sgd' && config.lr < 0.01) {
      params.decay *= 0.7
      params.Lfloor = Math.max(params.Lfloor, 0.4)
    }
  }

  if (missionId === 'symmetrybreaker') {
    if (config.batchSize < 32 && config.dropout < 0.2) {
      params.overfit = true
      params.overfitEpoch = Math.min(params.overfitEpoch, 10)
      params.noiseScale *= 1.1
    }
    if (config.regularization === 'none') {
      params.Lfloor *= 1.05
    }
  }

  return params
}

export default function simulate(config, missionConfig = {}) {
  const configStr = JSON.stringify({ config, missionId: missionConfig.id || null })
  const rng = mulberry32(simpleHash(configStr))

  let params = resolveParams(config, rng)
  params = applyInteractions(params, config)
  params = applyMissionDifficulty(params, config, missionConfig)

  const missionProfile = getMissionProfile(missionConfig)
  const epochs = Math.max(1, config.epochs || missionConfig.defaultConfig?.epochs || 30)

  const trainLoss = []
  const valLoss = []
  const accuracy = []
  const phases = []
  const effectiveLrHistory = []

  let prevLoss = params.L0
  let prevAcc = 0.1
  let diverged = false
  let plateauEpoch = null
  let rescuedEpoch = null
  let rescueTriggered = false
  let bestLoss = params.L0

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const progress = epoch / Math.max(1, epochs - 1)
    const phase = getPhase(epoch, epochs, rescuedEpoch, plateauEpoch)
    const phaseMultiplier =
      phase === 'warmup'
        ? missionProfile.warmup
        : phase === 'fine-tune'
          ? missionProfile.fineTune
          : phase === 'rescue'
            ? missionProfile.rescueBoost
            : phase === 'plateau-watch'
              ? 0.35
              : missionProfile.core

    let effectiveLr = config.lr * phaseMultiplier
    effectiveLr *= schedulerMultiplier(config.scheduler, progress, plateauEpoch !== null)

    if (config.optimizer === 'adam') effectiveLr *= 0.72
    if (config.optimizer === 'rmsprop') effectiveLr *= 0.8
    if (config.optimizer === 'momentum') effectiveLr *= 0.9
    if (config.optimizer === 'sgd') effectiveLr *= 1.12

    if (config.batchSize === 1) effectiveLr *= 1.2
    if (config.batchSize >= 128) effectiveLr *= 0.85

    effectiveLrHistory.push(effectiveLr)

    let tLoss
    let vLoss
    let acc

    if (params.flatline) {
      tLoss = params.L0 + (rng() - 0.5) * 0.015
      vLoss = tLoss + 0.015 + (rng() - 0.5) * 0.01
      acc = 0.1 + rng() * 0.02
    } else if (params.explode && epoch >= params.explodeEpoch) {
      tLoss = Math.min(prevLoss * (1.45 + rng() * 0.45), 8)
      vLoss = tLoss * (1.05 + rng() * 0.08)
      acc = Math.max(0.05, prevAcc - 0.06)
      diverged = true
    } else {
      const learningDrive = params.decay * Math.log1p(1 + effectiveLr * 35)
      const capacityPressure = Math.max(0.72, 1 - Math.max(0, config.width - 64) / 700)
      const noiseFloor = params.noiseScale * params.noiseMultiplier * (0.85 + rng() * 0.3)
      const phaseNoise = phase === 'warmup' ? 1.2 : phase === 'fine-tune' ? 0.65 : phase === 'rescue' ? 0.8 : 1

      const decayAmount = learningDrive * capacityPressure * phaseNoise
      const baseLoss = Math.max(params.Lfloor, prevLoss - decayAmount)
      const oscillation = (rng() - 0.5) * noiseFloor * (1.2 - progress * 0.5)

      tLoss = Math.max(0.01, baseLoss + oscillation)

      const overfitDelta =
        params.overfit && epoch > params.overfitEpoch
          ? (epoch - params.overfitEpoch) * (0.0045 + rng() * 0.001)
          : 0

      const missionGapMultiplier = missionConfig.id === 'memorizer' ? 1.5 : missionConfig.id === 'symmetrybreaker' ? 1.2 : 1
      vLoss = tLoss + overfitDelta * missionGapMultiplier + 0.008 + rng() * 0.01

      if (!rescueTriggered && config.scheduler === 'plateau' && epoch >= 5) {
        const lastFour = trainLoss.slice(-4)
        if (lastFour.length === 4) {
          const improvement = lastFour[0] - lastFour[3]
          if (improvement < missionProfile.plateauThreshold) {
            plateauEpoch = epoch
            rescueTriggered = true
            rescuedEpoch = Math.min(epochs - 1, epoch + 2)
            tLoss += 0.05
            vLoss += 0.04
            effectiveLr *= 0.6
          }
        }
      }

      if (params.vanishing) {
        tLoss = Math.max(params.Lfloor, tLoss + 0.02 + (rng() - 0.5) * 0.008)
        vLoss = tLoss + 0.012 + rng() * 0.01
      }

      acc = 1 / (1 + Math.exp(6 * (tLoss - 0.45)))
      acc = clamp(acc, 0.08, 0.985)

      if (progress > 0.65 && !diverged && !params.flatline) {
        acc = clamp(acc + Math.max(0, 0.04 - (tLoss - params.Lfloor) * 0.12), 0.08, 0.99)
      }
    }

    if (tLoss < bestLoss) bestLoss = tLoss

    trainLoss.push(tLoss)
    valLoss.push(vLoss)
    accuracy.push(acc)
    phases.push({
      epoch: epoch + 1,
      phase,
      effectiveLr: Number(effectiveLr.toFixed(6)),
      trainLoss: Number(tLoss.toFixed(4)),
      valLoss: Number(vLoss.toFixed(4)),
      accuracy: Number(acc.toFixed(4)),
    })

    prevLoss = tLoss
    prevAcc = acc
  }

  const finalTrainLoss = trainLoss[trainLoss.length - 1]
  const finalValLoss = valLoss[valLoss.length - 1]
  const finalAccuracy = accuracy[accuracy.length - 1]
  const gap = finalValLoss - finalTrainLoss

  return {
    trainLoss,
    valLoss,
    accuracy,
    phases,
    effectiveLrHistory,
    plateauEpoch,
    finalTrainLoss,
    finalValLoss,
    finalAccuracy,
    diverged,
    vanished: params.vanishing,
    overfit: gap > 0.12,
    flatlined: params.flatline,
    params,
    config,
    epochs,
    missionId: missionConfig.id || null,
    bestTrainLoss: bestLoss,
    rescuedEpoch,
  }
}
