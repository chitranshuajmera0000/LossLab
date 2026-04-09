import { normalizeAccuracy, normalizeScore } from '../utils/metricsNormalization.js'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function countUnique(runs, selector) {
  return new Set(runs.map(selector).filter((value) => value !== undefined && value !== null)).size
}

function getFirstThresholdEpoch(trainLoss, threshold) {
  return trainLoss.findIndex((loss) => 1 / (1 + Math.exp(6 * (loss - 0.45))) >= threshold)
}

function getMissionBonus(missionId, result, config, allRuns) {
  const gap = result.finalValLoss - result.finalTrainLoss
  const optimizerCount = countUnique(allRuns, (run) => run.config?.optimizer)
  const batchCount = countUnique(allRuns, (run) => run.config?.batchSize)

  switch (missionId) {
    case 'exploder':
      return result.diverged ? -150 : clamp(Math.round((0.9 - config.lr) * 180), -60, 180)
    case 'flatliner':
      return result.vanished || result.flatlined ? 40 : Math.round(result.finalAccuracy * 120)
    case 'memorizer':
      return Math.max(0, Math.round((0.12 - gap) * 1800))
    case 'slowlearner':
      return optimizerCount >= 3 ? 180 : optimizerCount === 2 ? 90 : optimizerCount === 1 ? 30 : 0
    case 'symmetrybreaker':
      return Math.max(0, Math.round((0.1 - gap) * 1800))
    default:
      return 0
  }
}

export default function calculateScore(config, result, allRuns = [], missionConfig = {}) {
  const safeFinalAccuracy = normalizeAccuracy(result?.finalAccuracy)
  const { diverged, vanished, flatlined, trainLoss } = result
  const gap = result.finalValLoss - result.finalTrainLoss
  const missionId = missionConfig.id || 'default'
  const runCount = allRuns.length + 1
  const runsIncludingCurrent = [...allRuns, { config, finalAccuracy: safeFinalAccuracy }]
  const previousBestAccuracy = allRuns.reduce((best, run) => Math.max(best, normalizeAccuracy(run.finalAccuracy || 0)), 0)
  const previousBadges = allRuns.reduce((acc, run) => acc.concat(run.badges || []), [])

  const accuracyPoints = Math.round(safeFinalAccuracy * 1000)
  const stabilityBonus = diverged || flatlined ? 0 : Math.round((1 - clamp(gap, 0, 1)) * 120)

  const firstConvergedEpoch = getFirstThresholdEpoch(trainLoss, 0.8)
  const speedBonus = firstConvergedEpoch !== -1 && firstConvergedEpoch < 12 ? 220 : 0
  const explorationBonus = runCount <= 2 ? 120 : Math.min(220, countUnique(runsIncludingCurrent, (run) => run.config?.optimizer) * 60)
  const missionBonus = getMissionBonus(missionId, result, config, runsIncludingCurrent)
  const stretchBonus = typeof missionConfig.stretchFn === 'function' && missionConfig.stretchFn(result, runsIncludingCurrent) ? 400 : 0
  const gapPenalty = gap > 0.08 ? Math.round(-260 * (gap - 0.08)) : 0

  const total = normalizeScore(accuracyPoints + stabilityBonus + speedBonus + explorationBonus + missionBonus + stretchBonus + gapPenalty)

  const breakdown = {
    accuracyPoints,
    stabilityBonus,
    speedBonus,
    explorationBonus,
    missionBonus,
    stretchBonus,
    gapPenalty,
  }

  const scoreBreakdownLabels = [
    { key: 'accuracyPoints', label: 'Acc. points', value: accuracyPoints },
    { key: 'stabilityBonus', label: 'Stability', value: stabilityBonus },
    { key: 'speedBonus', label: 'Speed', value: speedBonus },
    { key: 'explorationBonus', label: 'Exploration', value: explorationBonus },
    { key: 'missionBonus', label: 'Mission fit', value: missionBonus },
    { key: 'stretchBonus', label: 'Stretch goal', value: stretchBonus },
    { key: 'gapPenalty', label: 'Generalization gap', value: gapPenalty },
  ]

  const badges = []
  const newBadges = []
  const addBadge = (badgeKey, condition) => {
    if (!condition) return
    badges.push(badgeKey)
    if (!previousBadges.includes(badgeKey)) newBadges.push(badgeKey)
  }

  addBadge('goldilocks', config.lr >= 0.0008 && config.lr <= 0.003 && safeFinalAccuracy > 0.82)
  addBadge('exploder', diverged)
  addBadge('flatliner', vanished || flatlined)
  addBadge('speedrunner', firstConvergedEpoch !== -1 && firstConvergedEpoch < 10)
  addBadge('scientist', countUnique(runsIncludingCurrent, (run) => run.config?.optimizer) >= 3)
  addBadge('comeback', safeFinalAccuracy > 0.8 && previousBestAccuracy < 0.35)
  addBadge('eagle_eye', config.filterSize === 3 && allRuns.length === 0 && safeFinalAccuracy > 0.8)
  addBadge('smooth_op',
    trainLoss.length >= 20 &&
    (() => {
      const lastLosses = trainLoss.slice(-20)
      const mean = lastLosses.reduce((sum, value) => sum + value, 0) / lastLosses.length
      const variance = lastLosses.reduce((sum, value) => sum + (value - mean) ** 2, 0) / lastLosses.length
      return Math.sqrt(variance) < 0.05
    })(),
  )
  addBadge('deep_diver', config.convLayers >= 10 && safeFinalAccuracy > 0.7)
  addBadge('methodical', runCount >= 4 && countUnique(runsIncludingCurrent, (run) => run.config?.batchSize) >= 3)
  addBadge('first_blood', runCount === 1 && safeFinalAccuracy > 0.8)
  addBadge('no_hints', !diverged && !vanished && !flatlined && safeFinalAccuracy > 0.85)
  addBadge('perfectionist', safeFinalAccuracy > 0.92 && gap < 0.04)
  addBadge('marathon', runCount >= 8)

  return {
    total,
    breakdown,
    scoreBreakdownLabels,
    badges,
    newBadges,
  }
}

// Test block
if (import.meta.env?.DEV) {
  // Dynamic imports for testing
  const runTests = async () => {
    try {
      const resolveParams = (await import('./resolveParams.js')).default
      const applyInteractions = (await import('./interactions.js')).default
      const simulate = (await import('./simulate.js')).default
      const generateDiagnostics = (await import('./diagnostics.js')).default

      console.log('🧪 Engine Tests Starting...\n')

      // Test 1: resolveParams
      console.log('📋 Test 1: resolveParams')
      const testConfig1 = {
        lr: 0.001,
        optimizer: 'adam',
        activation: 'relu',
        layers: 4,
        width: 128,
        init: 'he',
        dropout: 0.0,
        regularization: 'l2',
        batchSize: 32,
        scheduler: 'cosine',
        epochs: 20,
        filterSize: null,
        numFilters: null,
        pooling: null,
        poolingPlacement: null,
        batchNorm: null,
        skipConnections: null,
        augmentation: null,
        convLayers: null,
      }
      const params1 = resolveParams(testConfig1)
      console.log('✓ Config resolved:', { L0: params1.L0, Lfloor: params1.Lfloor, decay: params1.decay })

      // Test 2: applyInteractions
      console.log('\n🔗 Test 2: applyInteractions')
      const params2 = { ...params1 }
      applyInteractions(params2, testConfig1)
      console.log('✓ Interactions applied:', { decayAfter: params2.decay, LfloorAfter: params2.Lfloor })

      // Test 3: simulate
      console.log('\n🎬 Test 3: simulate')
      const result = simulate(testConfig1)
      console.log('✓ Simulation complete:', {
        finalTrainLoss: result.finalTrainLoss.toFixed(3),
        finalValLoss: result.finalValLoss.toFixed(3),
        finalAccuracy: (result.finalAccuracy * 100).toFixed(1) + '%',
        epochs: result.epochs,
      })

      // Test 4: generateDiagnostics
      console.log('\n🔍 Test 4: generateDiagnostics')
      const diagnostics = generateDiagnostics(testConfig1, result)
      console.log(`✓ Generated ${diagnostics.length} diagnostic(s):`)
      diagnostics.forEach((d) => console.log(`  [${d.type.toUpperCase()}] ${d.title}`))

      // Test 5: calculateScore
      console.log('\n🏆 Test 5: calculateScore')
      const score = calculateScore(testConfig1, result, [], { stretchGoal: 0.92 })
      console.log('✓ Score calculated:', {
        total: score.total,
        badges: score.badges.length > 0 ? score.badges.join(', ') : 'none',
        newBadges: score.newBadges.length > 0 ? score.newBadges.join(', ') : 'none',
      })

      // Test divergence case
      console.log('\n⚡ Test 6: Divergence (high LR)')
      const divergeConfig = { ...testConfig1, lr: 5.0, epochs: 10 }
      const divergeResult = simulate(divergeConfig)
      console.log('✓ Divergence test:', {
        diverged: divergeResult.diverged,
        finalLoss: divergeResult.finalTrainLoss.toFixed(3),
      })

      // Test flatline case
      console.log('\n📊 Test 7: Flatline (zeros init)')
      const flatConfig = { ...testConfig1, init: 'zeros', epochs: 10 }
      const flatResult = simulate(flatConfig)
      console.log('✓ Flatline test:', {
        flatlined: flatResult.flatlined,
        trainLossRange: [flatResult.trainLoss[0].toFixed(3), flatResult.trainLoss[flatResult.trainLoss.length - 1].toFixed(3)],
      })

      console.log('\n✅ All engine tests passed!\n')
    } catch (e) {
      console.error('❌ Test error:', e.message)
    }
  }

  // Run tests after module loads
  runTests()
}
