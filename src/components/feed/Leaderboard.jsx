
import { motion as Motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'

function rankColor(rank) {
  if (rank === 1) return 'text-yellow-400'
  if (rank === 2) return 'text-[#94a3b8]'
  if (rank === 3) return 'text-[#cd7f32]'
  return 'text2'
}

function accuracyColor(acc) {
  if (acc > 0.8) return 'text-green-500'
  if (acc > 0.7) return 'text-amber-400'
  return 'text2'
}

function statusBadge(status, runNumber) {
  if (status === 'presenting') {
    return <span className="bg-accent/20 text-accent px-2 py-0.5 rounded text-xs font-mono">Presenting</span>
  }
  if (status === 'submitted') {
    return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-mono">Submitted</span>
  }
  if (status === 'running') {
    return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-mono flex items-center gap-1"><span className="animate-pulse h-2 w-2 rounded-full bg-amber-400 inline-block" />Running... run {runNumber}</span>
  }
  return null
}

function pill(type, value) {
  if (!value) return null
  let color = 'bg-gray-100 text-gray-700'
  if (type === 'optimizer') {
    if (value === 'adam') color = 'bg-blue-100 text-blue-700'
    if (value === 'sgd') color = 'bg-amber-100 text-amber-700'
    if (value === 'rmsprop') color = 'bg-pink-100 text-pink-700'
  }
  if (type === 'activation') {
    if (value === 'relu') color = 'bg-green-100 text-green-700'
    if (value === 'tanh') color = 'bg-purple-100 text-purple-700'
    if (value === 'sigmoid') color = 'bg-amber-100 text-amber-700'
  }
  return <span className={clsx('rounded-full px-2 py-0.5 text-xs font-mono', color)}>{value}</span>
}


// Track previous ranks for each team
export default function Leaderboard({ leaderboard = [], presentingTeamId }) {
  return (
    <div className="bg1 border rounded-xl p-4 w-full">
      <div className="text2 text-[10px] uppercase font-mono mb-2 tracking-widest">LEADERBOARD</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text2 text-xs">
              <th className="text-left px-2 py-1">Rank</th>
              <th className="text-left px-2 py-1">Session Code</th>
              <th className="text-left px-2 py-1">Optimizer</th>
              <th className="text-left px-2 py-1">Activation</th>
              <th className="text-left px-2 py-1">Accuracy</th>
              <th className="text-left px-2 py-1">Val Loss</th>
              <th className="text-left px-2 py-1">Score</th>
              <th className="text-left px-2 py-1">Status</th>
            </tr>
          </thead>
          <AnimatePresence initial={false}>
            <tbody>
              {leaderboard.map((team, i) => {
                const rank = i + 1
                const isPresenting = team.id === presentingTeamId
                return (
                  <Motion.tr
                    key={team.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className={clsx('border-b border-border last:border-0', isPresenting && 'bg-accent/10')}
                  >
                    <td className={clsx('px-2 py-1 font-mono font-bold relative', rankColor(rank))}>
                      {rank}
                    </td>
                    <td className="px-2 py-1 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: team.color }} />
                      {team.name}
                    </td>
                    <td className="px-2 py-1">{pill('optimizer', team.optimizer)}</td>
                    <td className="px-2 py-1">{pill('activation', team.activation)}</td>
                    <td className={clsx('px-2 py-1 font-mono', accuracyColor(team.accuracy))}>{team.accuracy !== undefined ? (team.accuracy * 100).toFixed(1) + '%' : '-'}</td>
                    <td className="px-2 py-1 font-mono">{team.val_loss !== undefined ? team.val_loss.toFixed(4) : '-'}</td>
                    <td className="px-2 py-1 font-mono">{team.score !== undefined ? team.score : '-'}</td>
                    <td className="px-2 py-1">{statusBadge(team.status, team.run_number)}</td>
                  </Motion.tr>
                )
              })}
            </tbody>
          </AnimatePresence>
        </table>
      </div>
    </div>
  )
}
