/**
 * Applies compound interaction effects to parameters.
 * Modifies params in place and returns it.
 */
export default function applyInteractions(params, config) {
  const { lr, optimizer, activation, init, dropout, batchSize, layers, width, filterSize, convLayers, poolingPlacement, batchNorm, skipConnections, augmentation } = config

  // 1. sgd + lr>0.1 → noiseScale*=2.5
  if (optimizer === 'sgd' && lr > 0.1) {
    params.noiseScale *= 2.5
  }

  // 2. sigmoid + layers>4 → vanishing=true, Lfloor=max(1.6,Lfloor)
  if (activation === 'sigmoid' && layers > 4) {
    params.vanishing = true
    params.Lfloor = Math.max(1.6, params.Lfloor)
  }

  // 3. zeros + any → flatline=true (override everything)
  if (init === 'zeros') {
    params.flatline = true
  }

  // 4. dropout>0.5 + batchSize<32 → Lfloor*=1.6
  if (dropout > 0.5 && batchSize < 32) {
    params.Lfloor *= 1.6
  }

  // 5. he + relu + layers>3 → decay*=1.2 (optimal pairing bonus)
  if (init === 'he' && activation === 'relu' && layers > 3) {
    params.decay *= 1.2
  }

  // 6. adam + cosine → decay*=1.35
  if (optimizer === 'adam' && config.scheduler === 'cosine') {
    params.decay *= 1.35
  }

  // 7. batchSize=1 + lr>0.1 → noiseScale*=5, explode=true
  if (batchSize === 1 && lr > 0.1) {
    params.noiseScale *= 5
    params.explode = true
  }

  // 8. relu + he + batchSize=32 + adam → Lfloor*=0.75 (golden config bonus)
  if (activation === 'relu' && init === 'he' && batchSize === 32 && optimizer === 'adam') {
    params.Lfloor *= 0.75
  }

  // 9. filterSize=1 + convLayers>4 → Lfloor=max(1.9, Lfloor)
  if (filterSize === 1 && convLayers > 4) {
    params.Lfloor = Math.max(1.9, params.Lfloor)
  }

  // 10. poolingPlacement='every' + convLayers>6 → decay*=0.4, Lfloor*=1.6
  if (poolingPlacement === 'every' && convLayers > 6) {
    params.decay *= 0.4
    params.Lfloor *= 1.6
  }

  // 11. batchNorm='none' + layers>8 → spikeEpoch=rand(8,12)
  if (batchNorm === 'none' && layers > 8) {
    // Use deterministic PRNG based on layer count for reproducibility
    params.spikeEpoch = Math.floor(((layers * 7) % 5) + 8)
  }

  // 12. skipConnections='none' + convLayers>=10 → Lfloor*=1.8, decay*=0.2
  if (skipConnections === 'none' && convLayers >= 10) {
    params.Lfloor *= 1.8
    params.decay *= 0.2
  }

  // 13. augmentation.length>3 + width<64 → Lfloor*=1.4 (capacity too small)
  if (augmentation !== null && Array.isArray(augmentation) && augmentation.length > 3 && width < 64) {
    params.Lfloor *= 1.4
  }

  // 14. batchNorm + batchSize<16 → spikeEpoch=rand(6,10)
  if (batchNorm !== null && batchNorm !== 'none' && batchSize < 16) {
    params.spikeEpoch = Math.floor(((batchSize * 11) % 5) + 6)
  }

  return params
}
