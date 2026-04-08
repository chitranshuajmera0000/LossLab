function formatPct(value) {
  return `${(value * 100).toFixed(1)}%`
}

function makeDiagnostic(type, title, message, insight) {
  return { type, title, message, insight: insight || message }
}

const MISSION_PROMPTS = {
  exploder: {
    diverged: 'Which is driving instability more in this run: the LR range, optimizer scaling, or gradient noise from batch size?',
    plateau: 'If the curve is stable but not improving, what combination would increase progress without reintroducing explosion?',
  },
  flatliner: {
    flatline: 'Is this still symmetry lock, or did you uncover saturation in deeper layers after fixing initialization?',
    vanished: 'At this depth, what activation-init pairing preserves gradient magnitude best in early layers?',
  },
  memorizer: {
    overfit: 'Which single change reduces memorization pressure most without collapsing useful capacity?',
  },
  slowlearner: {
    plateau: 'Have you tested this optimizer at its own LR range, or reused an LR tuned for another optimizer?',
  },
  symmetrybreaker: {
    overfit: 'If regularization improved gap but hurt accuracy, which capacity setting should be adjusted next?',
    plateau: 'Which regularization and batch combination gives signal without over-constraining the model?',
  },
}

function withMissionPrompt(missionId, kind, fallback) {
  const extra = MISSION_PROMPTS[missionId]?.[kind]
  if (!extra) return fallback
  return `${fallback} ${extra}`
}

export function resolveThinkingPrompt(missionConfig = {}, runCount = 0) {
  const stages = Array.isArray(missionConfig?.stages) ? missionConfig.stages : []
  if (stages.length === 0) return missionConfig?.hint || null

  const unlocked = stages
    .filter((stage) => typeof stage?.runThreshold === 'number' && stage.runThreshold <= runCount)
    .sort((a, b) => b.runThreshold - a.runThreshold)

  if (unlocked.length > 0) {
    return unlocked[0].message
  }

  return stages[0]?.message || missionConfig?.hint || null
}

export function generateInsight(config, result, missionConfig = {}) {
  const gap = result.finalValLoss - result.finalTrainLoss
  const missionName = missionConfig.title || 'this run'
  const missionId = missionConfig.id

  if (result.diverged) {
    return withMissionPrompt(
      missionId,
      'diverged',
      `For ${missionName}, the step size is still too aggressive. What changes if you reduce LR first, then reintroduce momentum or a scheduler only after the curve stops blowing up?`,
    )
  }

  if (result.flatlined) {
    return withMissionPrompt(
      missionId,
      'flatline',
      `For ${missionName}, the model is not changing enough to escape symmetry. Which parameter breaks identical paths between neurons: initialization, activation, or width?`,
    )
  }

  if (result.vanished) {
    return withMissionPrompt(
      missionId,
      'vanished',
      `For ${missionName}, the early layers are probably not receiving a usable gradient. If you keep depth fixed, which activation-init pair gives the strongest signal to the first layers?`,
    )
  }

  if (gap > 0.12) {
    return withMissionPrompt(
      missionId,
      'overfit',
      `For ${missionName}, train and validation are separating. What is the smallest regularization change that narrows the gap without pushing accuracy down too far?`,
    )
  }

  if (result.plateauEpoch != null) {
    return withMissionPrompt(
      missionId,
      'plateau',
      `For ${missionName}, the run flattened partway through. What happened around epoch ${result.plateauEpoch + 1}, and which scheduler behavior should respond to that stall?`,
    )
  }

  return `For ${missionName}, the curve is moving in the right direction. What single parameter change would test whether this improvement is robust or just noise?`
}

export default function generateDiagnostics(config, result, missionConfig = {}) {
  const diagnostics = []
  const missionId = missionConfig.id
  const { params, diverged, vanished, flatlined, finalTrainLoss, finalValLoss, finalAccuracy } = result
  const { lr, activation, layers, filterSize, poolingPlacement, convLayers, skipConnections, init, batchNorm } = config
  const gap = finalValLoss - finalTrainLoss

  if (diverged) {
    diagnostics.push(
      makeDiagnostic(
        'error',
        'Why did the curve blow up?',
        withMissionPrompt(
          missionId,
          'diverged',
          `The loss crossed its stable range around epoch ${params.explodeEpoch + 1}. What would happen if you dropped LR by an order of magnitude before touching anything else?`,
        ),
        `Lower the step size first, then test whether the optimizer still needs help.`,
      ),
    )
  }

  if (flatlined) {
    diagnostics.push(
      makeDiagnostic(
        'error',
        'What is keeping every neuron identical?',
        withMissionPrompt(
          missionId,
          'flatline',
          'The run never escaped its starting symmetry. Which choice would create different gradients across units: a new init, a new activation, or a smaller width?',
        ),
        'Break symmetry before asking the network to learn a richer representation.',
      ),
    )
  }

  if (vanished) {
    diagnostics.push(
      makeDiagnostic(
        'error',
        'Where did the gradient disappear?',
        withMissionPrompt(
          missionId,
          'vanished',
          `With ${activation} across ${layers} layers, the early signal becomes tiny. If depth is fixed, which pairing would preserve more magnitude in the first half of the network?`,
        ),
        'Choose an activation and initialization that preserve variance through depth.',
      ),
    )
  }

  if (!diverged && !flatlined && result.overfit && gap > 0.12) {
    diagnostics.push(
      makeDiagnostic(
        'warn',
        'Why is validation drifting away?',
        withMissionPrompt(
          missionId,
          'overfit',
          `Train loss is ${finalTrainLoss.toFixed(3)} while validation is ${finalValLoss.toFixed(3)}. What changes would reduce memorization without erasing the signal you already learned?`,
        ),
        'Look for the smallest regularization or capacity change that closes the gap.',
      ),
    )
  }

  if (result.plateauEpoch != null) {
    diagnostics.push(
      makeDiagnostic(
        'warn',
        'What should happen after the plateau?',
        withMissionPrompt(
          missionId,
          'plateau',
          `The run stalled around epoch ${result.plateauEpoch + 1}. Which scheduler behavior helps after progress slows: hold steady, decay faster, or warm restart?`,
        ),
        'Use the plateau as the cue for an intentional learning-rate change.',
      ),
    )
  }

  if (filterSize === 1) {
    diagnostics.push(
      makeDiagnostic(
        'warn',
        'Can a 1×1 filter read spatial structure?',
        'That setting preserves channels but ignores neighborhood context. What pattern would a larger receptive field reveal that this filter cannot?',
        'Use a kernel that can actually observe the local pattern the task needs.',
      ),
    )
  }

  if (poolingPlacement === 'every' && convLayers > 6) {
    diagnostics.push(
      makeDiagnostic(
        'warn',
        'Are you shrinking the map too early?',
        `Pooling after every layer on a ${convLayers}-layer stack can erase detail too fast. What changes if pooling happens later?`,
        'Delay spatial compression until the representation has enough structure.',
      ),
    )
  }

  if (skipConnections === 'none' && convLayers >= 10) {
    diagnostics.push(
      makeDiagnostic(
        'warn',
        'How do early layers stay reachable?',
        'In a deeper CNN, what path lets gradients bypass the long chain so the first blocks still get useful updates?',
        'Skip connections help preserve signal flow in deep stacks.',
      ),
    )
  }

  if (batchNorm && batchNorm !== 'none' && config.batchSize < 16) {
    diagnostics.push(
      makeDiagnostic(
        'warn',
        'What do tiny batches do to normalization?',
        'If the statistics are noisy, which should change first: batch size, warmup, or normalization placement?',
        'Stabilize the statistics before reading the curve too literally.',
      ),
    )
  }

  if (init === 'he' && ['relu', 'leaky', 'elu'].includes(activation)) {
    diagnostics.push(
      makeDiagnostic(
        'ok',
        'Why does this pairing behave well?',
        `He initialization matches ${activation} by preserving variance through ${layers} layers. What does that suggest about the next parameter you should vary?`,
        'The init and activation are aligned; explore the remaining hyperparameters.',
      ),
    )
  }

  if (config.optimizer === 'adam' && lr <= 0.003) {
    diagnostics.push(
      makeDiagnostic(
        'ok',
        'What makes this optimizer stable?',
        `Adam at LR=${lr} is usually forgiving. If performance is still weak, which other knob is now the bottleneck?`,
        'When the optimizer is no longer the problem, move to capacity, regularization, or batch size.',
      ),
    )
  }

  if (finalAccuracy > 0.85) {
    diagnostics.push(
      makeDiagnostic(
        'ok',
        'What changed enough to cross the threshold?',
        `Final accuracy is ${formatPct(finalAccuracy)} with a gap of ${formatPct(Math.max(0, gap))}. Which configuration choice made the biggest difference?`,
        'Use the strongest improvement as a clue for the next controlled experiment.',
      ),
    )
  }

  return diagnostics
}
