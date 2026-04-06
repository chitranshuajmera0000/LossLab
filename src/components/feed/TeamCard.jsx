import { motion as Motion } from 'framer-motion'
import { Check, Star, Loader2, ArrowLeftRight } from 'lucide-react'
import clsx from 'clsx'

// Helper: color for accuracy
function accuracyColor(acc) {
  if (acc > 0.8) return 'text-green-500'
  if (acc > 0.7) return 'text-amber-400'
  return 'text2'
}

// Helper: border classes
function borderClass({ isPresenting, rank, isSubmitted }) {
  if (isPresenting) return 'border-accent shadow-[0_0_8px_2px_rgba(56,189,248,0.2)]'
  if (rank === 1 && isSubmitted) return 'border-green-500 shadow-[0_0_8px_2px_rgba(34,197,94,0.15)]'
  if (!isSubmitted) return 'border-dashed opacity-70'
  return 'border-border'
}

// Helper: pill color
function pillColor(type, value) {
  if (type === 'optimizer') {
    if (value === 'adam') return 'bg-blue-100 text-blue-700'
    if (value === 'sgd') return 'bg-amber-100 text-amber-700'
    if (value === 'rmsprop') return 'bg-pink-100 text-pink-700'
    return 'bg-gray-100 text-gray-700'
  }
  if (type === 'activation') {
    if (value === 'relu') return 'bg-green-100 text-green-700'
    if (value === 'tanh') return 'bg-purple-100 text-purple-700'
    if (value === 'sigmoid') return 'bg-amber-100 text-amber-700'
    return 'bg-gray-100 text-gray-700'
  }
  if (type === 'init') {
    if (value === 'he') return 'bg-cyan-100 text-cyan-700'
    if (value === 'xavier') return 'bg-pink-100 text-pink-700'
    return 'bg-gray-100 text-gray-700'
  }
  return 'bg-gray-100 text-gray-700'
}

// Helper: team color dot
function TeamDot({ color }) {
  return <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: color }} />
}

// Helper: sparkline SVG
function Sparkline({ data }) {
  if (!data || data.length < 2) return <svg height="32" width="100%" />
  const w = 120, h = 32
  const min = Math.min(...data), max = Math.max(...data)
  const norm = (v) => h - ((v - min) / (max - min + 1e-6)) * (h - 6) - 3
  const points = data.map((v, i) => [3 + (w - 6) * (i / (data.length - 1)), norm(v)])
  const d = points.map((p, i) => i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`).join(' ')
  return (
    <svg width={w} height={h} className="block">
      <path d={d} stroke="#22c55e" strokeWidth="2" fill="none" />
    </svg>
  )
}

export default function TeamCard({
  team,
  bestRun,
  rank,
  isPresenting,
  isSubmitted,
  onCompare,
  compareSelected,
}) {
  // Loading bar animation for training
  const loadingBar = (
    <div className="w-full h-2 bg-border rounded mt-2 overflow-hidden">
      <div className="h-2 bg-amber-300 animate-pulse" style={{ width: '60%' }} />
    </div>
  )

  // Rank badge
  let rankBadge = null
  if (isPresenting) {
    rankBadge = (
      <span className="absolute top-2 right-2 bg-accent text-white text-xs px-2 py-1 rounded font-mono shadow">Presenting</span>
    )
  } else if (rank === 1 && isSubmitted) {
    rankBadge = (
      <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded font-mono shadow flex items-center gap-1"><Star size={14} className="-ml-1" />#1</span>
    )
  } else if (rank && isSubmitted) {
    rankBadge = (
      <span className="absolute top-2 right-2 bg-bg3 text2 text-xs px-2 py-1 rounded font-mono shadow">#{rank}</span>
    )
  }

  // Accuracy display
  let accuracyDisplay
  if (isSubmitted && bestRun) {
    accuracyDisplay = (
      <div className={clsx('text-[28px] font-mono font-bold text-center', accuracyColor(bestRun.final_accuracy))}>
        {(bestRun.final_accuracy * 100).toFixed(1)}%
      </div>
    )
  } else {
    accuracyDisplay = (
      <div className="text2 text-center text-[14px] flex flex-col items-center">
        Training... run {bestRun?.run_number || 1}
        {loadingBar}
      </div>
    )
  }

  // Stats row
  const stats = isSubmitted && bestRun ? [
    { label: 'Train', value: bestRun.train_accuracy },
    { label: 'Val', value: bestRun.val_accuracy },
    { label: 'Score', value: bestRun.score },
  ] : []

  // Config pills
  const config = bestRun?.config || {}
  const pills = [
    { type: 'optimizer', value: config.optimizer },
    { type: 'activation', value: config.activation },
    { type: 'init', value: config.init },
  ].filter((p) => p.value)

  // Concept tag
  const concept = bestRun?.notes?.concept
  const conceptTag = isSubmitted && concept ? (
    <div className="italic text2 text-[11px] mt-2 truncate" title={concept}>
      {concept.length > 60 ? concept.slice(0, 60) + '…' : concept}
    </div>
  ) : null

  // Sparkline
  const sparkline = bestRun?.accuracy_curve ? <Sparkline data={bestRun.accuracy_curve} /> : <div className="h-8" />

  // Compare button
  const compareBtn = (
    <button
      className={clsx(
        'absolute bottom-2 right-2 text-xs px-2 py-1 rounded flex items-center gap-1 border',
        compareSelected ? 'bg-accent text-white border-accent' : 'bg-bg3 text2 border-border',
      )}
      onClick={onCompare}
      title={compareSelected ? 'Remove from comparison' : 'Add to comparison'}
    >
      <ArrowLeftRight size={14} /> Compare
    </button>
  )

  return (
    <Motion.div
      layout
      className={clsx(
        'relative bg2 rounded-xl p-4 border transition-all',
        borderClass({ isPresenting, rank, isSubmitted })
      )}
    >
      {/* Top row: team dot + name + rank badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 font-bold text-[14px]">
          <TeamDot color={team.color} />
          {team.name}
        </div>
        {rankBadge}
      </div>

      {/* Accuracy center */}
      <div className="my-2">{accuracyDisplay}</div>

      {/* Stats row */}
      {isSubmitted && (
        <div className="flex gap-2 justify-center text-xs text2 mb-2">
          {stats.map((s) => (
            <span key={s.label} className="bg-bg3 rounded px-2 py-0.5 font-mono">{s.label}: {s.value}</span>
          ))}
        </div>
      )}

      {/* Config pills */}
      <div className="flex gap-2 flex-wrap justify-center mb-2">
        {pills.map((p) => (
          <span key={p.type} className={clsx('rounded-full px-2 py-0.5 text-xs font-mono', pillColor(p.type, p.value))}>
            {p.value}
          </span>
        ))}
      </div>

      {/* Sparkline */}
      <div className="w-full">{sparkline}</div>

      {/* Concept tag */}
      {conceptTag}

      {/* Compare button */}
      {compareBtn}
    </Motion.div>
  )
}
