import { Lock } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

const LAYER_OPTIONS = [2, 3, 4, 5, 6, 7, 8]
const WIDTH_OPTIONS = [16, 64, 128, 256]
const INIT_OPTIONS = ['zeros', 'random', 'xavier', 'he']
const SCHEDULER_OPTIONS = ['none', 'step', 'cosine', 'plateau']
const REG_OPTIONS = ['none', 'l1', 'l2', 'both']
const OPTIMIZER_OPTIONS = ['sgd', 'momentum', 'rmsprop', 'adam']
const ACTIVATION_OPTIONS = ['sigmoid', 'tanh', 'relu', 'leaky', 'elu']
const BATCH_OPTIONS = [1, 8, 32, 128, 512]
const DROPOUT_OPTIONS = [0.0, 0.1, 0.2, 0.3, 0.5, 0.7]
const FILTER_OPTIONS = [1, 3, 5, 7]
const NUM_FILTER_OPTIONS = [16, 32, 64, 128, 256]
const POOL_OPTIONS = ['none', 'max', 'avg', 'global']
const POOL_PLACE_OPTIONS = ['every', 'every2', 'end']
const BN_OPTIONS = ['none', 'before', 'after']
const SKIP_OPTIONS = ['none', 'every2', 'every3']
const CONV_LAYER_OPTIONS = [2, 4, 6, 8, 10, 12]
const AUGMENTATION_OPTIONS = ['flip', 'crop', 'jitter', 'rotation', 'blur', 'cutout']

function titleCase(value) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function lrToSlider(lr) {
  const minLog = -4
  const maxLog = 1
  const clamped = Math.max(0.0001, Math.min(10, Number(lr || 0.001)))
  return (Math.log10(clamped) - minLog) / (maxLog - minLog)
}

function sliderToLr(position) {
  const minLog = -4
  const maxLog = 1
  const logValue = minLog + Number(position) * (maxLog - minLog)
  return Number((10 ** logValue).toPrecision(6))
}

function formatLr(lr) {
  if (lr < 0.001) return lr.toExponential(2)
  return Number(lr).toFixed(4)
}

function lrColor(lr) {
  if (lr > 0.5) return 'text-red'
  if (lr >= 0.1) return 'text-amber'
  if (lr >= 0.001 && lr <= 0.01) return 'text-green'
  return 'text-text1'
}

function LockedWrapper({ locked, label, children, missionId }) {
  const [shake, setShake] = useState(false)
  const handleLockedClick = () => {
    if (!locked) return
    setShake(true)
    setTimeout(() => setShake(false), 300)
  }
  return (
    <div
      className={`space-y-2 ${locked ? 'opacity-40 cursor-not-allowed' : ''} ${shake ? 'animate-shake' : ''}`}
      title={locked ? `Locked for Mission ${missionId}` : undefined}
      onClick={handleLockedClick}
    >
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.08em] text-text2">
        <span>{label}</span>
        {locked ? <Lock size={12} /> : null}
      </div>
      {children}
      {/* Tooltip */}
      {locked && shake && (
        <div className="absolute left-full ml-2 top-0 bg-bg3 text-xs text2 rounded px-2 py-1 shadow border border-border z-50">
          Locked for Mission {missionId}
        </div>
      )}
    </div>
  )
}

function Segmented({ options, value, onChange, locked, formatter }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-bg2 p-1">
      {options.map((option) => {
        const active = option === value
        const text = formatter ? formatter(option) : titleCase(String(option))
        return (
          <button
            type="button"
            key={String(option)}
            disabled={locked}
            onClick={() => onChange(option)}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${active ? 'bg-accent text-white' : 'bg-bg3 text-text1 hover:bg-bg4'
              } disabled:cursor-not-allowed`}
          >
            {text}
          </button>
        )
      })}
    </div>
  )
}

function MultiSelectSegmented({ options, value = [], onToggle, locked }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-bg2 p-1">
      {options.map((option) => {
        const active = value.includes(option)
        return (
          <button
            key={option}
            type="button"
            disabled={locked}
            onClick={() => onToggle(option)}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${active ? 'bg-accent text-white' : 'bg-bg3 text-text1 hover:bg-bg4'
              } disabled:cursor-not-allowed`}
          >
            {titleCase(option)}
          </button>
        )
      })}
    </div>
  )
}

function ControlPanel({
  config,
  onConfigChange,
  lockedParams = [],
  missionId,
  onRun,
  isAnimating,
  currentEpoch,
  lastAccuracy,
  runFeedback,
  isRunLimitReached = false,
  runsUsed = 0,
  maxRuns = null,
}) {
  const [charging, setCharging] = useState(false)
  const chargeRef = useRef()

  function isLocked(param) {
    return lockedParams.includes(param)
  }

  const sliderValue = lrToSlider(config.lr)
  const cnnKeys = [
    'filterSize',
    'numFilters',
    'pooling',
    'poolingPlacement',
    'batchNorm',
    'skipConnections',
    'convLayers',
    'augmentation',
  ]
  const showCnn = cnnKeys.some((key) => !isLocked(key))

  const handleRunClick = () => {
    if (isAnimating || charging) return
    setCharging(true)
    chargeRef.current = setTimeout(() => {
      setCharging(false)
      if (onRun) onRun()
    }, 300)
  }

  useEffect(() => () => chargeRef.current && clearTimeout(chargeRef.current), [])

  return (
    <aside className="w-[260px] min-w-[260px] h-full overflow-y-auto border-r border-white/10 bg-bg1/40 backdrop-blur-xl flex flex-col gap-4 p-4 shadow-[4px_0_24px_rgba(0,0,0,0.2)] z-10 relative">
      <div className="sticky top-0 z-50 -mx-4 -mt-4 bg-bg1/95 p-4 pb-4 backdrop-blur-xl border-b border-white/5 shadow-md flex flex-col gap-3">
        <div className="text-[10px] uppercase tracking-[0.12em] text-text2">
          Mission: {missionId}
          {maxRuns != null && (
            <span className={`ml-2 font-mono ${isRunLimitReached ? 'text-red-400' : 'text-text2'}`}>
              {runsUsed}/{maxRuns} runs
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleRunClick}
          disabled={isAnimating || charging || isRunLimitReached}
          title={isRunLimitReached ? `Run limit of ${maxRuns} reached for this mission` : undefined}
          className={`w-full rounded-xl border px-3 py-3 text-sm font-bold text-white transition-all duration-300 relative overflow-hidden shadow-lg hover:-translate-y-0.5 active:translate-y-0 ${isRunLimitReached
              ? 'border-red-500/50 bg-red-500/20 cursor-not-allowed opacity-60'
              : runFeedback === 'done'
                ? 'border-green/80 bg-green/80 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                : 'border-accent/50 bg-gradient-to-r from-accent/30 to-accent2/30 hover:border-accent hover:from-accent/50 hover:to-accent2/50 hover:shadow-[0_0_25px_rgba(34,211,238,0.5)]'
            } disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-lg`}
        >
          {/* Charging bar */}
          {charging && (
            <span className="absolute left-0 top-0 h-full bg-amber-400/60 z-10 animate-charging" style={{ width: '100%' }} />
          )}
          <span className={charging ? 'relative z-20' : ''}>
            {isRunLimitReached
              ? `✗ Run limit reached (${maxRuns})`
              : isAnimating
                ? `● Training... epoch ${currentEpoch}`
                : runFeedback === 'done'
                  ? `✓ ${lastAccuracy}%`
                  : charging
                    ? 'Charging...' : '▶ Run Training'}
          </span>
        </button>
      </div>
      <LockedWrapper locked={isLocked('lr')} label="Learning Rate" missionId={missionId}>
        <div className="flex items-center justify-between text-xs">
          <span className="text-text2">0.0001</span>
          <span className={`font-mono ${lrColor(config.lr)}`}>{formatLr(config.lr)}</span>
          <span className="text-text2">10</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          disabled={isLocked('lr')}
          value={sliderValue}
          onChange={e => onConfigChange('lr', sliderToLr(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gradient-to-r from-red via-green to-red"
        />
      </LockedWrapper>
      <LockedWrapper locked={isLocked('epochs')} label="Epochs" missionId={missionId}>
        <div className="flex items-center justify-between text-xs text-text1">
          <span>{config.epochs}</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          disabled={isLocked('epochs')}
          value={config.epochs}
          onChange={e => onConfigChange('epochs', Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-bg4"
        />
      </LockedWrapper>
      <LockedWrapper locked={isLocked('dropout')} label="Dropout" missionId={missionId}>
        <div className="text-xs text-text1">{Math.round((config.dropout || 0) * 100)}%</div>
        <input
          type="range"
          min={0}
          max={DROPOUT_OPTIONS.length - 1}
          step={1}
          disabled={isLocked('dropout')}
          value={Math.max(0, DROPOUT_OPTIONS.indexOf(config.dropout || 0))}
          onChange={e => onConfigChange('dropout', DROPOUT_OPTIONS[Number(e.target.value)])}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-bg4"
        />
      </LockedWrapper>
      <LockedWrapper locked={isLocked('batchSize')} label="Batch Size" missionId={missionId}>
        <Segmented
          options={BATCH_OPTIONS}
          value={config.batchSize}
          onChange={value => onConfigChange('batchSize', value)}
          locked={isLocked('batchSize')}
          formatter={value => String(value)}
        />
      </LockedWrapper>
      <LockedWrapper locked={isLocked('optimizer')} label="Optimizer" missionId={missionId}>
        <Segmented
          options={OPTIMIZER_OPTIONS}
          value={config.optimizer}
          onChange={value => onConfigChange('optimizer', value)}
          locked={isLocked('optimizer')}
        />
      </LockedWrapper>
      <LockedWrapper locked={isLocked('activation')} label="Activation" missionId={missionId}>
        <Segmented
          options={ACTIVATION_OPTIONS}
          value={config.activation}
          onChange={value => onConfigChange('activation', value)}
          locked={isLocked('activation')}
        />
        <div className="text-[10px] text-amber">• Sigmoid may vanish in deep nets</div>
      </LockedWrapper>
      <LockedWrapper locked={isLocked('layers')} label="Layers" missionId={missionId}>
        <Segmented
          options={LAYER_OPTIONS}
          value={config.layers}
          onChange={value => onConfigChange('layers', value)}
          locked={isLocked('layers')}
          formatter={value => String(value)}
        />
      </LockedWrapper>
      <LockedWrapper locked={isLocked('width')} label="Width" missionId={missionId}>
        <Segmented
          options={WIDTH_OPTIONS}
          value={config.width}
          onChange={value => onConfigChange('width', value)}
          locked={isLocked('width')}
          formatter={value => String(value)}
        />
      </LockedWrapper>
      <LockedWrapper locked={isLocked('init')} label="Weight Init" missionId={missionId}>
        <Segmented
          options={INIT_OPTIONS}
          value={config.init}
          onChange={value => onConfigChange('init', value)}
          locked={isLocked('init')}
        />
        <div className="text-[10px] text-red">• Zeros prevents symmetry breaking</div>
      </LockedWrapper>
      <LockedWrapper locked={isLocked('scheduler')} label="Scheduler" missionId={missionId}>
        <Segmented
          options={SCHEDULER_OPTIONS}
          value={config.scheduler}
          onChange={value => onConfigChange('scheduler', value)}
          locked={isLocked('scheduler')}
        />
      </LockedWrapper>
      <LockedWrapper locked={isLocked('regularization')} label="Regularization">
        <Segmented
          options={REG_OPTIONS}
          value={config.regularization}
          onChange={value => onConfigChange('regularization', value)}
          locked={isLocked('regularization')}
        />
      </LockedWrapper>
      {showCnn && (
        <div className="space-y-4 rounded-lg border border-border bg-bg2 p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-text2">CNN Params</div>
          <LockedWrapper locked={isLocked('filterSize')} label="Filter Size">
            <Segmented
              options={FILTER_OPTIONS}
              value={config.filterSize}
              onChange={value => onConfigChange('filterSize', value)}
              locked={isLocked('filterSize')}
              formatter={value => `${value}x${value}`}
            />
          </LockedWrapper>
          <LockedWrapper locked={isLocked('numFilters')} label="Num Filters">
            <Segmented
              options={NUM_FILTER_OPTIONS}
              value={config.numFilters}
              onChange={value => onConfigChange('numFilters', value)}
              locked={isLocked('numFilters')}
              formatter={value => String(value)}
            />
          </LockedWrapper>
          <LockedWrapper locked={isLocked('pooling')} label="Pooling">
            <Segmented
              options={POOL_OPTIONS}
              value={config.pooling}
              onChange={value => onConfigChange('pooling', value)}
              locked={isLocked('pooling')}
            />
          </LockedWrapper>
          <LockedWrapper locked={isLocked('poolingPlacement')} label="Pooling Placement">
            <Segmented
              options={POOL_PLACE_OPTIONS}
              value={config.poolingPlacement}
              onChange={value => onConfigChange('poolingPlacement', value)}
              locked={isLocked('poolingPlacement')}
              formatter={value => ({ every: 'Every', every2: 'Every 2', end: 'End Only' }[value])}
            />
          </LockedWrapper>
          <LockedWrapper locked={isLocked('batchNorm')} label="Batch Norm">
            <Segmented
              options={BN_OPTIONS}
              value={config.batchNorm}
              onChange={value => onConfigChange('batchNorm', value)}
              locked={isLocked('batchNorm')}
              formatter={value => ({ none: 'None', before: 'Before ReLU', after: 'After ReLU' }[value])}
            />
          </LockedWrapper>
          <LockedWrapper locked={isLocked('skipConnections')} label="Skip Connections">
            <Segmented
              options={SKIP_OPTIONS}
              value={config.skipConnections}
              onChange={value => onConfigChange('skipConnections', value)}
              locked={isLocked('skipConnections')}
              formatter={value => ({ none: 'None', every2: 'Every 2', every3: 'Every 3' }[value])}
            />
          </LockedWrapper>
          <LockedWrapper locked={isLocked('convLayers')} label="Conv Layers">
            <Segmented
              options={CONV_LAYER_OPTIONS}
              value={config.convLayers}
              onChange={value => onConfigChange('convLayers', value)}
              locked={isLocked('convLayers')}
              formatter={value => String(value)}
            />
          </LockedWrapper>
          <LockedWrapper locked={isLocked('augmentation')} label="Augmentation">
            <MultiSelectSegmented
              options={AUGMENTATION_OPTIONS}
              value={config.augmentation || []}
              onToggle={option => {
                const set = new Set(config.augmentation || [])
                if (set.has(option)) set.delete(option)
                else set.add(option)
                onConfigChange('augmentation', Array.from(set))
              }}
              locked={isLocked('augmentation')}
            />
          </LockedWrapper>
        </div>
      )}
    </aside>
  )
}

export default ControlPanel
