/**
 * LossLab — missions.js
 *
 * All structural fields (winFn, stretchFn, winThreshold, gapThreshold,
 * explorationRequirement, stages, lockedParams, defaultConfig) are unchanged
 * from the working version. Only narrative fields updated to match redesign.
 */

export const MISSIONS = [
  // ─── Mission 1 ────────────────────────────────────────────
  {
    id: 'exploder',
    number: 1,
    title: 'The Runaway',
    subtitle: 'Something is wrong. The curve goes up, not down.',
    dataset: '2D Moons — 2 classes, 400 points, linearly inseparable',
    description:
      'The model is supposed to learn a boundary. Instead the loss is climbing and accuracy is stuck near chance. You have four parameters you can change. Your first instinct will probably make one metric better and a different one worse. That is expected — there is more than one thing wrong here. Figure out what is broken, in what order to fix it, and why the first fix alone is not enough.',
    winCondition: 'Val accuracy > 82% with a stable (non-diverging) loss curve',
    stretchGoal: 'Val accuracy > 90% — all four params must be tuned as a system, not independently',
    winThreshold: 0.82,
    stretchThreshold: 0.9,
    winFn: (r) => r.finalAccuracy > 0.82 && !r.diverged && r.config?.batchSize >= 32 && r.config?.lr < 1.0,
    stretchFn: (r) => r.finalAccuracy > 0.9 && !r.diverged && r.config?.batchSize >= 32 && r.config?.lr < 1.0,
    stages: [
      { runThreshold: 0, message: 'The curve is going up. Before you touch anything: what does a rising loss curve usually mean? What is the model doing wrong on each step?' },
      { runThreshold: 3, message: 'If your first fix stabilized the curve but accuracy is still stuck — instability was only one of the problems. What else could prevent a stable model from learning?' },
      { runThreshold: 6, message: 'Think about what batch size 1 means geometrically. Each step is based on one example. What does that do to the direction of the gradient? What would a larger batch change about that?' },
    ],
    lockedParams: [
      'activation', 'layers', 'width', 'init', 'dropout', 'regularization',
      'filterSize', 'numFilters', 'pooling', 'batchNorm',
      'skipConnections', 'augmentation', 'convLayers',
    ],
    defaultConfig: {
      lr: 2.0,
      optimizer: 'sgd',
      activation: 'relu',
      layers: 4,
      width: 64,
      init: 'he',
      dropout: 0.1,
      regularization: 'none',
      batchSize: 1,
      scheduler: 'none',
      epochs: 30,
      filterSize: null, numFilters: null, pooling: null, poolingPlacement: null,
      batchNorm: 'none', skipConnections: null, augmentation: null, convLayers: null,
    },
    maxRuns: 25,
    timeLimit: 25,
    concept: 'Gradient instability — LR, optimizer, and batch size interact multiplicatively',
    failureMode: 'LR=2.0 + SGD + batch=1 — gradient steps are explosive and noisy simultaneously',
    hint: 'Each optimizer expects a different LR range. The same LR behaves very differently across optimizers. What does that tell you about the order in which to fix things?',
  },

  // ─── Mission 2 ────────────────────────────────────────────
  {
    id: 'flatliner',
    number: 2,
    title: 'The Ghost Network',
    subtitle: 'The model is "training" but nothing is actually changing.',
    dataset: 'Concentric Rings — 3 classes, 600 points',
    description:
      'Accuracy has been at 33% for 20 epochs. Loss is barely moving. The optimizer is fine, the learning rate is reasonable, the architecture looks normal on paper. Yet the network is essentially doing nothing. Something upstream of the gradient update is broken — the signal is disappearing before it can do any work. You have four parameters to investigate. The first thing you fix will probably reveal that there was a second problem hiding underneath it.',
    winCondition: 'Val accuracy > 83% with no flatline/vanish failure',
    stretchGoal: 'Val accuracy > 90% with stable learning — requires resolving all hidden failures',
    winThreshold: 0.83,
    stretchThreshold: 0.9,
    winFn: (r) => r.finalAccuracy > 0.83 && !r.flatlined && !r.vanished,
    stretchFn: (r) => r.finalAccuracy > 0.9 && !r.flatlined && !r.vanished,
    stages: [
      { runThreshold: 0, message: 'Every neuron has identical weights and produces identical outputs. What does backpropagation compute when all activations are the same?' },
      { runThreshold: 2, message: 'The curve is moving now but still not learning effectively. Is this the same problem as before, or a different one that was hiding?' },
      { runThreshold: 5, message: 'At 7 layers, what happens to a gradient signal that gets multiplied by a number less than 1 seven times in a row? How does activation choice change that multiplier?' },
    ],
    lockedParams: [
      'optimizer', 'lr', 'width', 'batchSize', 'scheduler', 'regularization', 'dropout',
      'filterSize', 'numFilters', 'pooling',
      'skipConnections', 'augmentation', 'convLayers',
    ],
    defaultConfig: {
      lr: 0.001,
      optimizer: 'adam',
      activation: 'sigmoid',
      layers: 7,
      width: 64,
      init: 'zeros',
      dropout: 0.1,
      regularization: 'none',
      batchSize: 32,
      scheduler: 'none',
      epochs: 50,
      filterSize: null, numFilters: null, pooling: null, poolingPlacement: null,
      batchNorm: 'none', skipConnections: null, augmentation: null, convLayers: null,
    },
    maxRuns: 25,
    timeLimit: 25,
    concept: 'Dead neurons — weight init, activation saturation, and depth interact in sequence',
    failureMode: 'Zeros init kills all gradients (dead symmetry) — fix it and discover two more problems',
    hint: 'The curve went flat in three different ways across your runs. They look the same on the chart but have completely different causes. Which diagnostic message changed between run 1 and run 3?',
  },

  // ─── Mission 3 ────────────────────────────────────────────
  {
    id: 'memorizer',
    number: 3,
    title: 'The Imposter',
    subtitle: 'Train: 97%. Val: 61%. This model learned something — but not what you think.',
    dataset: 'Noisy Grid — 2 classes, 150 train / 750 test',
    description:
      'The model converges beautifully on the training set. But validation accuracy is mediocre and getting worse as training continues. The model has learned something — just not the signal you wanted. You have five parameters to adjust. Be careful: the most obvious fixes will trade one problem for another. This is not a problem you can solve with a single parameter change.',
    winCondition: 'Val accuracy > 74% AND train-val gap < 12%',
    stretchGoal: 'Val accuracy > 82% AND gap < 4% — the sweet spot is narrow and requires all 5 params',
    winThreshold: 0.74,
    stretchThreshold: 0.82,
    gapThreshold: 0.12,
    winFn: (r) => {
      const gap = r.finalValLoss - r.finalTrainLoss
      return r.finalAccuracy > 0.74 && gap < 0.12
    },
    stretchFn: (r) => {
      const gap = r.finalValLoss - r.finalTrainLoss
      return r.finalAccuracy > 0.82 && gap < 0.04
    },
    stages: [
      { runThreshold: 0, message: 'The training curve looks perfect. The validation curve disagrees. What does it mean for a model to "know" the training data but not the test data?' },
      { runThreshold: 3, message: 'You changed one thing and the gap got smaller but accuracy dropped. Or accuracy stayed but the gap widened. What does that tell you about satisfying both conditions simultaneously?' },
      { runThreshold: 7, message: 'This model has 6 layers of 256 units for 150 training examples. How many parameters does a model actually need to learn a 2-class boundary? What happens to all the excess capacity?' },
    ],
    lockedParams: [
      'optimizer', 'lr', 'activation', 'init', 'scheduler',
      'filterSize', 'numFilters', 'pooling', 'batchNorm',
      'skipConnections', 'augmentation', 'convLayers',
    ],
    defaultConfig: {
      lr: 0.001,
      optimizer: 'adam',
      activation: 'relu',
      layers: 6,
      width: 256,
      init: 'he',
      dropout: 0.0,
      regularization: 'none',
      batchSize: 512,
      scheduler: 'none',
      epochs: 60,
      filterSize: null, numFilters: null, pooling: null, poolingPlacement: null,
      batchNorm: 'none', skipConnections: null, augmentation: null, convLayers: null,
    },
    maxRuns: 25,
    timeLimit: 25,
    concept: 'Overfitting — model capacity, regularization, and batch size must be balanced simultaneously',
    failureMode: '6-layer width=256 network + no regularization + batch=512 memorizes training noise perfectly',
    hint: 'You have two separate problems: the model is too large for the dataset, AND it has no pressure to generalize. Fixing only one gives you a different kind of wrong answer.',
  },

  // ─── Mission 4 ────────────────────────────────────────────
  {
    id: 'slowlearner',
    number: 4,
    title: 'The Plateau Hunter',
    subtitle: 'The curve flattens at 68% every time. No matter what you try.',
    dataset: 'Noisy Moons — 2 classes, 800 points, 18% label noise',
    description:
      'Every run plateaus. Sometimes early, sometimes late, always around the same accuracy ceiling. The model is learning — just not past a certain point. You have three parameters: learning rate, optimizer, and scheduler. The ceiling is not fixed — it moves depending on which combination you use. The win condition requires demonstrating that you explored the space, not just finding a good number by luck.',
    winCondition: 'Val accuracy > 76% AND at least 3 different optimizers tried',
    stretchGoal: 'Val accuracy > 84% — requires the specific optimizer × LR × scheduler combination that beats all others',
    winThreshold: 0.76,
    stretchThreshold: 0.84,
    explorationRequirement: { key: 'optimizer', count: 3, label: 'Optimizers tried' },
    winFn: (r, runs) =>
      r.finalAccuracy > 0.76 && new Set(runs.map((x) => x.config?.optimizer).filter(Boolean)).size >= 3,
    stretchFn: (r) => r.finalAccuracy > 0.84,
    stages: [
      { runThreshold: 0, message: 'The model hit a ceiling. Before raising LR to push through it: is the plateau from LR being too small, or from the optimizer\'s update rule on noisy data?' },
      { runThreshold: 4, message: 'You have tried the same optimizer at multiple LRs. What is the shape of the accuracy-vs-LR curve? Is there a peak, or does it keep improving?' },
      { runThreshold: 8, message: 'You have now tried at least two optimizers. Did the optimal LR change when you changed optimizer? Why would different optimizers want different LRs on the same task?' },
    ],
    lockedParams: [
      'layers', 'width', 'activation', 'init', 'dropout', 'regularization', 'batchSize',
      'filterSize', 'numFilters', 'pooling', 'batchNorm',
      'skipConnections', 'augmentation', 'convLayers',
    ],
    defaultConfig: {
      lr: 0.05,
      optimizer: 'sgd',
      activation: 'relu',
      layers: 3,
      width: 64,
      init: 'he',
      dropout: 0.1,
      regularization: 'none',
      batchSize: 32,
      scheduler: 'none',
      epochs: 50,
      filterSize: null, numFilters: null, pooling: null, poolingPlacement: null,
      batchNorm: 'none', skipConnections: null, augmentation: null, convLayers: null,
    },
    maxRuns: 25,
    timeLimit: 30,
    concept: 'Optimizer convergence profiles — optimal LR is different for every optimizer, scheduler changes which optimizer wins',
    failureMode: 'SGD on noisy data plateaus from oscillation — not from gradient problems, from landscape problems',
    hint: 'When you switched optimizer, did you also adjust the learning rate? The LR that is correct for SGD will likely cause different behavior for Adam. Build a table: optimizer × LR × final accuracy.',
  },

  // ─── Mission 5 ────────────────────────────────────────────
  {
    id: 'symmetrybreaker',
    number: 5,
    title: 'The Mirage',
    subtitle: 'Val accuracy is 74%. You need 76%. It should be easy. It is not.',
    dataset: 'Overlapping Gaussians — 3 classes, 300 train / 900 test',
    description:
      'The default config almost works. Val accuracy sits around 74% and the curve looks healthy — no explosion, no flatline, no obvious failure. But the win condition requires 76% AND gap below 10%, and something is preventing both from being satisfied at once. Every change you make seems to improve one metric while worsening the other. Five parameters are available. The puzzle is finding where both conditions are satisfied simultaneously.',
    winCondition: 'Val accuracy > 76% AND train-val gap < 10%',
    stretchGoal: 'Val accuracy > 84% AND gap < 5% — requires finding the batch × dropout tradeoff',
    winThreshold: 0.76,
    stretchThreshold: 0.84,
    gapThreshold: 0.10,
    winFn: (r) => {
      const gap = r.finalValLoss - r.finalTrainLoss
      return r.finalAccuracy > 0.76 && gap < 0.10
    },
    stretchFn: (r) => {
      const gap = r.finalValLoss - r.finalTrainLoss
      return r.finalAccuracy > 0.84 && gap < 0.05
    },
    stages: [
      { runThreshold: 0, message: 'The gap is the problem, not the accuracy. What is the gap measuring exactly? Which of your five parameters directly controls the pressure on the model to generalize?' },
      { runThreshold: 3, message: 'You added regularization and something got worse. Which metric — accuracy or gap? What does that tell you about how this regularization method affects the model?' },
      { runThreshold: 6, message: 'Small batches have noisy gradients — a form of implicit regularization. If you increase batch size (reducing that implicit noise), does that change how much explicit regularization you need?' },
    ],
    lockedParams: [
      'optimizer', 'lr', 'activation', 'init', 'scheduler',
      'filterSize', 'numFilters', 'pooling', 'batchNorm',
      'skipConnections', 'augmentation', 'convLayers',
    ],
    defaultConfig: {
      lr: 0.001,
      optimizer: 'adam',
      activation: 'relu',
      layers: 5,
      width: 128,
      init: 'he',
      dropout: 0.0,
      regularization: 'none',
      batchSize: 8,
      scheduler: 'none',
      epochs: 60,
      filterSize: null, numFilters: null, pooling: null, poolingPlacement: null,
      batchNorm: 'none', skipConnections: null, augmentation: null, convLayers: null,
    },
    maxRuns: 25,
    timeLimit: 25,
    concept: 'Regularization interactions — dropout effectiveness depends on batch size; L2 and dropout have different roles',
    failureMode: 'Small batch + no dropout creates overfit that looks mild but violates the gap condition',
    hint: 'Dropout and L2 regularization push back against overfitting in different ways. The amount of dropout that helps with batch=8 is different from what helps with batch=128. Why would batch size change how much dropout you need?',
  },

]

export default MISSIONS
