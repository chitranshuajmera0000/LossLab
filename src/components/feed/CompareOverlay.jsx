import { X } from 'lucide-react'
import { Chart, Line } from 'react-chartjs-2'
import clsx from 'clsx'

// Helper: config diff
function configRows(a, b) {
  const params = [
    'optimizer', 'activation', 'lr', 'init', 'layers', 'batchSize', 'dropout', 'regularization'
  ]
  return params.map((key) => ({
    key,
    a: a?.config?.[key],
    b: b?.config?.[key],
    diff: a?.config?.[key] !== b?.config?.[key],
  }))
}

export default function CompareOverlay({ teamA, teamB, onClose }) {
  if (!teamA || !teamB) return null
  // Chart data
  const chartData = {
    labels: teamA.bestRun?.train_loss?.map((_, i) => i + 1) || [],
    datasets: [
      {
        label: `${teamA.team.name} Train Loss`,
        data: teamA.bestRun?.train_loss || [],
        borderColor: teamA.team.color,
        backgroundColor: teamA.team.color,
        tension: 0.3,
        borderWidth: 2,
        fill: false,
      },
      {
        label: `${teamA.team.name} Val Loss`,
        data: teamA.bestRun?.val_loss_curve || [],
        borderColor: teamA.team.color,
        borderDash: [6, 4],
        backgroundColor: teamA.team.color,
        tension: 0.3,
        borderWidth: 2,
        fill: false,
        opacity: 0.5,
      },
      {
        label: `${teamB.team.name} Train Loss`,
        data: teamB.bestRun?.train_loss || [],
        borderColor: '#ec4899',
        backgroundColor: '#ec4899',
        tension: 0.3,
        borderWidth: 2,
        fill: false,
      },
      {
        label: `${teamB.team.name} Val Loss`,
        data: teamB.bestRun?.val_loss_curve || [],
        borderColor: '#ec4899',
        borderDash: [6, 4],
        backgroundColor: '#ec4899',
        tension: 0.3,
        borderWidth: 2,
        fill: false,
        opacity: 0.5,
      },
    ],
  }
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { display: false },
      y: { display: true, title: { display: true, text: 'Loss' } },
    },
    elements: {
      line: { borderJoinStyle: 'round' },
      point: { radius: 0 },
    },
  }

  const rows = configRows(teamA.bestRun, teamB.bestRun)

  return (
    <div className="fixed inset-0 z-50 bg-bg0/95 backdrop-blur flex flex-col items-center justify-center">
      {/* Close button */}
      <button className="absolute top-6 right-8 text2 hover:text1" onClick={onClose}>
        <X size={32} />
      </button>
      {/* Title */}
      <div className="text-2xl font-bold mb-2">{teamA.team.name} vs {teamB.team.name}</div>
      {/* Chart */}
      <div className="w-full max-w-2xl h-[400px] bg1 rounded-xl p-6 flex flex-col items-center">
        <Line data={chartData} options={chartOptions} height={400} />
        {/* Legend */}
        <div className="flex gap-6 mt-4 text-sm">
          <span className="flex items-center gap-2"><span className="inline-block w-4 h-2 rounded bg-[var(--teamA)]" style={{ background: teamA.team.color }} />{teamA.team.name}</span>
          <span className="flex items-center gap-2"><span className="inline-block w-4 h-2 rounded bg-pink-400" />{teamB.team.name}</span>
        </div>
      </div>
      {/* Config diff */}
      <div className="w-full max-w-2xl mt-8 bg1 rounded-xl p-6">
        <div className="font-mono text-xs text2 mb-2">CONFIG COMPARISON</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text2">
              <th className="text-left px-2 py-1">Param</th>
              <th className="text-left px-2 py-1">{teamA.team.name}</th>
              <th className="text-left px-2 py-1">{teamB.team.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={clsx(row.diff && 'bg-bg3')}>
                <td className="px-2 py-1 font-mono text-xs text2">{row.key}</td>
                <td className="px-2 py-1 font-mono">{row.a ?? '-'}</td>
                <td className="px-2 py-1 font-mono">{row.b ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
