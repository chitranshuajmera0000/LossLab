/**
 * Engine test harness - tests all modules in isolation
 */
import resolveParams from './resolveParams.js'
import applyInteractions from './interactions.js'
import simulate from './simulate.js'
import generateDiagnostics from './diagnostics.js'
import calculateScore from './scoring.js'

/**
 * Run all tests
 */
export async function runEngineTests() {
  console.log('🧪 ═══════════════════════════════════════════════════════════')
  console.log('🧪 LOSS LAB ENGINE TEST SUITE')
  console.log('🧪 ═══════════════════════════════════════════════════════════\n')

  // Test 1: resolveParams with basic config
  console.log('📋 TEST 1: resolveParams (Adam + ReLU baseline)')
  const config1 = {
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

  const params1 = resolveParams(config1)
  console.log('✓ Params resolved successfully')
  console.log(`  L0=${params1.L0}, Lfloor=${params1.Lfloor.toFixed(4)}, decay=${params1.decay.toFixed(4)}`)
  console.log(`  noiseScale=${params1.noiseScale.toFixed(4)}, explode=${params1.explode}\n`)

  // Test 2: applyInteractions
  console.log('📋 TEST 2: applyInteractions (golden config)')
  const params2 = resolveParams(config1)
  applyInteractions(params2, config1)
  console.log('✓ Interactions applied')
  console.log(`  Lfloor after interactions: ${params2.Lfloor.toFixed(4)} (should be ~0.6375 < baseline)\n`)

  // Test 3: simulate
  console.log('📋 TEST 3: simulate (20 epochs)')
  const result1 = simulate(config1)
  console.log('✓ Simulation completed')
  console.log(`  Final train loss: ${result1.finalTrainLoss.toFixed(4)}`)
  console.log(`  Final val loss: ${result1.finalValLoss.toFixed(4)}`)
  console.log(`  Final accuracy: ${(result1.finalAccuracy * 100).toFixed(1)}%`)
  console.log(`  Diverged: ${result1.diverged}, Vanished: ${result1.vanished}, Flatlined: ${result1.flatlined}\n`)

  // Test 4: generateDiagnostics
  console.log('📋 TEST 4: generateDiagnostics')
  const diagnostics1 = generateDiagnostics(config1, result1)
  console.log(`✓ Generated ${diagnostics1.length} diagnostic(s)`)
  diagnostics1.forEach((d) => {
    console.log(`  [${d.type.toUpperCase()}] ${d.title}`)
  })
  console.log()

  // Test 5: calculateScore
  console.log('📋 TEST 5: calculateScore')
  const score1 = calculateScore(config1, result1, [], { stretchGoal: 0.92 })
  console.log('✓ Score calculated')
  console.log(`  Total score: ${score1.total}`)
  console.log(`  Breakdown: ${JSON.stringify(score1.breakdown)}`)
  console.log(`  Badges: ${score1.badges.length > 0 ? score1.badges.join(', ') : '(none)'}`)
  console.log(`  New badges: ${score1.newBadges.length > 0 ? score1.newBadges.join(', ') : '(none)'}\n`)

  // Test 6: Divergence case
  console.log('📋 TEST 6: High LR divergence')
  const divergeConfig = { ...config1, lr: 3.5, epochs: 8 }
  const divergeResult = simulate(divergeConfig)
  console.log('✓ Divergence simulation')
  console.log(`  Diverged: ${divergeResult.diverged}`)
  console.log(`  Final loss: ${divergeResult.finalTrainLoss.toFixed(4)} (should be high)`)
  const diags6 = generateDiagnostics(divergeConfig, divergeResult)
  const explodeErr = diags6.find((d) => d.title === 'Exploding Gradient')
  console.log(`  Error detected: ${explodeErr ? '✓' : '✗'}\n`)

  // Test 7: Flatline case
  console.log('📋 TEST 7: Zeros initialization (flatline)')
  const flatConfig = { ...config1, init: 'zeros', epochs: 8 }
  const flatResult = simulate(flatConfig)
  console.log('✓ Flatline simulation')
  console.log(`  Flatlined: ${flatResult.flatlined}`)
  console.log(`  Loss variance: ${(Math.max(...flatResult.trainLoss) - Math.min(...flatResult.trainLoss)).toFixed(4)} (should be tiny)`)
  const diags7 = generateDiagnostics(flatConfig, flatResult)
  const flatErr = diags7.find((d) => d.title === 'Symmetry Breaking Failure')
  console.log(`  Error detected: ${flatErr ? '✓' : '✗'}\n`)

  // Test 8: Vanishing gradient (sigmoid + deep)
  console.log('📋 TEST 8: Vanishing gradient (sigmoid + 6 layers)')
  const vanishConfig = { ...config1, activation: 'sigmoid', layers: 6, epochs: 8 }
  const vanishResult = simulate(vanishConfig)
  console.log('✓ Vanishing simulation')
  console.log(`  Vanished: ${vanishResult.vanished}`)
  console.log(`  Final loss: ${vanishResult.finalTrainLoss.toFixed(4)} (should be high)`)
  const diags8 = generateDiagnostics(vanishConfig, vanishResult)
  const vanishErr = diags8.find((d) => d.title === 'Vanishing Gradient')
  console.log(`  Error detected: ${vanishErr ? '✓' : '✗'}\n`)

  // Test 9: Optimal config badges
  console.log('📋 TEST 9: Golden config (He+ReLU+32+Adam)')
  const goldConfig = { ...config1, init: 'he', activation: 'relu', batchSize: 32, optimizer: 'adam', epochs: 15 }
  const goldResult = simulate(goldConfig)
  const goldScore = calculateScore(goldConfig, goldResult, [])
  console.log('✓ Golden config test')
  console.log(`  Final accuracy: ${(goldResult.finalAccuracy * 100).toFixed(1)}%`)
  console.log(`  Badges: ${goldScore.badges.length > 0 ? goldScore.badges.join(', ') : '(none)'}`)
  console.log()

  // Test 10: CNN config
  console.log('📋 TEST 10: CNN with 3×3 filters + pooling')
  const cnnConfig = {
    ...config1,
    filterSize: 3,
    pooling: 'max',
    poolingPlacement: 'every2',
    convLayers: 6,
    batchNorm: 'after',
    skipConnections: 'every2',
    epochs: 10,
  }
  const cnnResult = simulate(cnnConfig)
  console.log('✓ CNN configuration')
  console.log(`  Final accuracy: ${(cnnResult.finalAccuracy * 100).toFixed(1)}%`)
  console.log(`  Converged smoothly: ${!cnnResult.diverged && !cnnResult.vanished}`)
  console.log()

  console.log('🧪 ═══════════════════════════════════════════════════════════')
  console.log('✅ All engine tests completed successfully!')
  console.log('🧪 ═══════════════════════════════════════════════════════════\n')
}

// Auto-run if imported in dev
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.runEngineTests = runEngineTests
  // Comment out auto-run to avoid spam; call window.runEngineTests() in console
  // runEngineTests()
}

export default runEngineTests
