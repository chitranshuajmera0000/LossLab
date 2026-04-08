/**
 * Resolves configuration into simulation parameters.
 * Pure function: no side effects, no imports.
 */
export default function resolveParams(config, rng = Math.random) {
  // Base values
  let params = {
    L0: 2.4,
    Lfloor: 0.12,
    decay: 0.08,
    noiseScale: 0.04,
    explode: false,
    explodeEpoch: 3,
    vanishing: false,
    overfit: false,
    overfitEpoch: 20,
    flatline: false,
    noiseMultiplier: 1.0,
    spikeEpoch: null,
  }

  // LEARNING RATE MAPPINGS
  const { lr } = config
  if (lr >= 1.5) {
    params.explode = true
    params.explodeEpoch = Math.floor(rng() * 4 + 2) // rand(2,5)
    params.noiseScale *= 3
  } else if (lr > 0.5) {
    params.noiseScale *= 2
    params.decay *= 0.5
  } else if (lr >= 0.01 && lr <= 0.1) {
    // baseline
  } else if (lr >= 0.001 && lr < 0.01) {
    params.decay *= 0.85
  } else if (lr < 0.0005) {
    params.decay *= 0.2
  }

  // OPTIMIZER MAPPINGS
  const { optimizer } = config
  if (optimizer === 'adam') {
    params.decay *= 1.4
    params.noiseScale *= 0.6
    params.Lfloor *= 0.85
  } else if (optimizer === 'rmsprop') {
    params.decay *= 1.2
    params.noiseScale *= 0.8
  } else if (optimizer === 'momentum') {
    params.decay *= 1.05
    params.noiseScale *= 1.0
  } else if (optimizer === 'sgd') {
    params.decay *= 0.55
    params.noiseScale *= 2.2
    params.Lfloor *= 1.1
    // SGD + small batch: non-adaptive updates can't overcome high gradient variance.
    // Raise Lfloor so accuracy can't cross win threshold without fixing batchSize too.
    if (config.batchSize < 32) {
      params.Lfloor = Math.max(params.Lfloor, 0.55) // blocks ~acc > 0.80 ceiling
    }
  }

  // ACTIVATION MAPPINGS (only apply when layers >= 4)
  const { activation, layers } = config
  if (layers >= 4) {
    if (activation === 'sigmoid') {
      params.vanishing = true
      params.Lfloor = Math.max(params.Lfloor, 1.4)
      params.decay *= 0.15
    } else if (activation === 'tanh') {
      if (layers >= 6) {
        params.vanishing = true
        params.Lfloor = Math.max(params.Lfloor, 0.9)
      }
      params.decay *= 0.5
    } else if (activation === 'relu') {
      // baseline
    } else if (activation === 'leaky') {
      params.Lfloor *= 0.92
      params.decay *= 1.05
    } else if (activation === 'elu') {
      params.Lfloor *= 0.9
      params.decay *= 1.08
    }
  }

  // WEIGHT INIT MAPPINGS
  const { init } = config
  if (init === 'zeros') {
    params.flatline = true
    params.decay = 0
    params.Lfloor = params.L0
  } else if (init === 'random') {
    params.noiseScale *= 1.3
  } else if (init === 'xavier') {
    // baseline
  } else if (init === 'he') {
    if (['relu', 'leaky', 'elu'].includes(activation)) {
      params.decay *= 1.15
    } else if (['sigmoid', 'tanh'].includes(activation)) {
      params.noiseScale *= 1.4
    }
  }

  // DROPOUT MAPPINGS
  const { dropout } = config
  if (dropout === 0.0) {
    if (config.batchSize < 32 && layers > 3) {
      params.overfit = true
      params.overfitEpoch = 15
    }
  } else if (dropout >= 0.4 && dropout <= 0.6) {
    params.Lfloor *= 1.15
  } else if (dropout > 0.6) {
    params.Lfloor *= 1.5
    params.decay *= 0.6
  }

  // BATCH SIZE MAPPINGS
  // Bug 4 fix: small batch sizes prevent full convergence — Adam's adaptive
  // rates can't fully cancel batch noise without a large batch.
  const { batchSize } = config
  if (batchSize === 1) {
    params.noiseMultiplier = 4.0
    params.Lfloor = Math.max(params.Lfloor, 0.48) // floor: acc won't exceed ~0.82 without batch fix
  } else if (batchSize === 8) {
    params.noiseMultiplier = 2.0
    params.Lfloor = Math.max(params.Lfloor, 0.25) // softer floor for batch=8
  } else if (batchSize === 32) {
    params.noiseMultiplier = 1.0
  } else if (batchSize === 128) {
    params.noiseMultiplier = 0.5
    params.decay *= 0.9
  } else if (batchSize === 512) {
    params.noiseMultiplier = 0.2
    params.overfit = true
    params.overfitEpoch = 10
  }

  // SCHEDULER MAPPINGS
  const { scheduler } = config
  if (scheduler === 'cosine') {
    params.decay *= 1.25
  } else if (scheduler === 'step') {
    params.decay *= 1.1
  } else if (scheduler === 'plateau') {
    params.decay *= 1.15
  }

  // CNN PARAM MAPPINGS (only apply if not null)
  const { filterSize, pooling, poolingPlacement, batchNorm, skipConnections, augmentation, convLayers } = config

  if (filterSize !== null) {
    if (filterSize === 1) {
      params.Lfloor *= 1.8
      params.decay *= 0.3
    } else if (filterSize === 3) {
      // baseline
    } else if (filterSize === 5) {
      params.Lfloor *= 1.1
      params.noiseScale *= 1.2
    } else if (filterSize === 7) {
      params.Lfloor *= 1.3
      params.overfit = true
      params.overfitEpoch = 12
    }
  }

  if (pooling !== null) {
    if (pooling === 'none') {
      params.overfit = true
      params.overfitEpoch = 8
    } else if (pooling === 'max') {
      // baseline
    } else if (pooling === 'avg') {
      params.Lfloor *= 0.95
    } else if (pooling === 'global') {
      params.Lfloor *= 0.88
      params.overfit = false
    }
  }

  if (poolingPlacement !== null) {
    if (poolingPlacement === 'every') {
      params.Lfloor *= 1.4
      params.decay *= 0.7
    } else if (poolingPlacement === 'every2') {
      // baseline
    } else if (poolingPlacement === 'end') {
      params.Lfloor *= 0.92
    }
  }

  if (batchNorm !== null) {
    if (batchNorm === 'none') {
      if (layers > 5) {
        params.noiseScale *= 1.5
      }
    } else if (batchNorm === 'before') {
      params.decay *= 1.2
      params.noiseScale *= 0.7
    } else if (batchNorm === 'after') {
      params.decay *= 1.1
      params.noiseScale *= 0.8
    }
  }

  if (skipConnections !== null) {
    if (skipConnections === 'none') {
      if (convLayers > 8) {
        params.Lfloor *= 1.5
        params.vanishing = true
      }
    } else if (skipConnections === 'every2') {
      params.decay *= 1.3
      params.Lfloor *= 0.85
    } else if (skipConnections === 'every3') {
      params.decay *= 1.15
      params.Lfloor *= 0.9
    }
  }

  if (augmentation !== null && Array.isArray(augmentation)) {
    if (augmentation.includes('flip')) {
      params.Lfloor *= 0.95
    }
    if (augmentation.includes('crop')) {
      params.Lfloor *= 0.93
    }
    if (augmentation.includes('jitter')) {
      params.noiseScale *= 1.1
      params.Lfloor *= 0.97
    }
    if (augmentation.includes('rotation')) {
      params.noiseScale *= 1.15
    }
    if (augmentation.length > 3) {
      params.noiseScale *= 1.4
    }
  }

  return params
}
