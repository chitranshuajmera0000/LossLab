import {
	CategoryScale,
	Chart as ChartJS,
	Filler,
	Legend,
	LineElement,
	LinearScale,
	PointElement,
	Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

function withOpacity(hex, alpha) {
	const r = Number.parseInt(hex.slice(1, 3), 16)
	const g = Number.parseInt(hex.slice(3, 5), 16)
	const b = Number.parseInt(hex.slice(5, 7), 16)
	return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function TrainingCurve({ animatedData, allRuns, changePoints = [], changeEvents = [], runForPhases = null }) {
	const epochCount = Math.max(animatedData.trainLoss.length, 1)
	const labels = Array.from({ length: epochCount }, (_, i) => i + 1)
	const activeRun = runForPhases || allRuns[allRuns.length - 1]
	const phaseMarkers = []
	const phases = activeRun?.result?.phases || []
	let previousPhase = null
	phases.forEach((item) => {
		if (item.phase !== previousPhase) {
			phaseMarkers.push({ epoch: item.epoch, label: item.phase, lr: item.effectiveLr })
			previousPhase = item.phase
		}
	})

	const ghostRuns = allRuns.slice(0, Math.max(0, allRuns.length - 1))
	const ghostDatasets = ghostRuns.flatMap((run) => {
		const train = run.result?.trainLoss || []
		const val = run.result?.valLoss || []
		const acc = run.result?.accuracy || []
		return [
			{
				data: train,
				borderColor: withOpacity('#4f8ef7', 0.15),
				borderWidth: 1,
				pointRadius: 0,
				tension: 0.25,
				yAxisID: 'y',
			},
			{
				data: val,
				borderColor: withOpacity('#f87171', 0.15),
				borderDash: [4, 4],
				borderWidth: 1,
				pointRadius: 0,
				tension: 0.25,
				yAxisID: 'y',
			},
			{
				data: acc,
				borderColor: withOpacity('#34d399', 0.15),
				borderWidth: 1,
				pointRadius: 0,
				tension: 0.25,
				yAxisID: 'y1',
			},
		]
	})

	const data = {
		labels,
		datasets: [
			...ghostDatasets,
			{
				label: 'Train Loss',
				data: animatedData.trainLoss,
				borderColor: '#4f8ef7',
				borderWidth: 2,
				pointRadius: 0,
				tension: 0.28,
				yAxisID: 'y',
			},
			{
				label: 'Val Loss',
				data: animatedData.valLoss,
				borderColor: '#f87171',
				borderDash: [4, 4],
				borderWidth: 2,
				pointRadius: 0,
				tension: 0.28,
				yAxisID: 'y',
			},
			{
				label: 'Accuracy',
				data: animatedData.accuracy,
				borderColor: '#34d399',
				borderWidth: 2,
				pointRadius: 0,
				tension: 0.28,
				yAxisID: 'y1',
			},
		],
	}

	const options = {
		responsive: true,
		maintainAspectRatio: false,
		animation: false,
		plugins: {
			legend: { display: false },
			tooltip: {
				backgroundColor: 'rgba(9, 11, 20, 0.85)',
				borderColor: 'rgba(255, 255, 255, 0.1)',
				borderWidth: 1,
				titleColor: '#f8fafc',
				bodyColor: '#cbd5e1',
				titleFont: { family: 'JetBrains Mono', size: 11 },
				bodyFont: { family: 'JetBrains Mono', size: 11 },
			},
		},
		scales: {
			x: {
				ticks: { color: '#5c6285' },
				grid: { color: '#1e2338' },
			},
			y: {
				min: 0,
				max: 3,
				position: 'left',
				title: { display: true, text: 'Loss', color: '#5c6285' },
				ticks: { color: '#5c6285' },
				grid: { color: '#1e2338' },
			},
			y1: {
				min: 0,
				max: 1,
				position: 'right',
				title: { display: true, text: 'Accuracy', color: '#5c6285' },
				ticks: { color: '#5c6285' },
				grid: { drawOnChartArea: false, color: '#1e2338' },
			},
		},
	}

	return (
		<div className="relative rounded-2xl border border-white/5 bg-bg1/50 backdrop-blur-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
			<div className="relative h-[320px] w-full">
				<Line data={data} options={options} />
				<svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
					{changePoints.map((epoch, idx) => {
						const x = epochCount > 1 ? ((epoch - 1) / (epochCount - 1)) * 100 : 0
						return (
							<line key={`cp-line-${epoch}-${idx}`} x1={x} y1="0" x2={x} y2="100" stroke="#5c6285" strokeDasharray="2,2" strokeWidth="0.35" />
						)
					})}
					{changeEvents.map((event, idx) => {
						const x = epochCount > 1 ? ((event.epoch - 1) / (epochCount - 1)) * 100 : 0
						const stroke = event.type === 'explode' ? '#f87171' : event.type === 'overfit' ? '#ef5da8' : '#fbbf24'
						return (
							<line key={`line-e-${event.type}-${event.epoch}-${idx}`} x1={x} y1="12" x2={x} y2="92" stroke={stroke} strokeDasharray="3,3" strokeWidth="0.5" opacity="0.8" />
						)
					})}
					{phaseMarkers.map((marker, idx) => {
						const x = epochCount > 1 ? ((marker.epoch - 1) / (epochCount - 1)) * 100 : 0
						return (
							<line key={`line-p-${marker.label}-${marker.epoch}-${idx}`} x1={x} y1="6" x2={x} y2="92" stroke="#34d399" strokeDasharray="2,3" strokeWidth="0.4" opacity="0.5" />
						)
					})}
				</svg>

				{/* HTML Overlay for Text Labels */}
				<div className="pointer-events-none absolute inset-0 overflow-visible">
					{changePoints.map((epoch, idx) => {
						const x = epochCount > 1 ? ((epoch - 1) / (epochCount - 1)) * 100 : 0
						return (
							<div key={`dot-${epoch}-${idx}`} className="absolute bottom-[2%] h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]" style={{ left: `${x}%` }} />
						)
					})}

					{phaseMarkers.map((marker, idx) => {
						const x = epochCount > 1 ? ((marker.epoch - 1) / (epochCount - 1)) * 100 : 0
						const topOffset = idx % 2 === 0 ? '0px' : '16px'
						const alignClass = x < 10 ? 'left-0 origin-left' : x > 90 ? 'right-0 origin-right' : 'left-1/2 -translate-x-1/2 origin-center'
						const style = x < 10 ? { left: `${x}%`, top: topOffset } : x > 90 ? { right: `${100 - x}%`, top: topOffset } : { left: `${x}%`, top: topOffset }

						return (
							<div key={`p-${idx}`} className={`absolute ${alignClass} px-0.5`} style={style}>
								<div className="font-mono text-[10px] sm:text-[11px] font-bold tracking-[0.1em] text-green drop-shadow-md uppercase whitespace-nowrap">
									{marker.label}
								</div>
							</div>
						)
					})}

					{changeEvents.map((event, idx) => {
						const x = epochCount > 1 ? ((event.epoch - 1) / (epochCount - 1)) * 100 : 0
						const colorClass = event.type === 'explode' ? 'border-red text-red shadow-[0_0_8px_rgba(248,113,113,0.3)]' : event.type === 'overfit' ? 'border-pink text-pink shadow-[0_0_8px_rgba(239,93,168,0.3)]' : 'border-amber text-amber shadow-[0_0_8px_rgba(251,191,36,0.3)]'
						const topOffset = idx % 2 === 0 ? '36px' : '56px'
						const alignClass = x < 10 ? 'left-0 origin-left' : x > 90 ? 'right-0 origin-right' : 'left-1/2 -translate-x-1/2 origin-center'
						const style = x < 10 ? { left: `${x}%`, top: topOffset } : x > 90 ? { right: `${100 - x}%`, top: topOffset } : { left: `${x}%`, top: topOffset }

						return (
							<div key={`e-${idx}`} className={`absolute ${alignClass} px-1`} style={style}>
								<div className={`rounded-full border bg-[#0b0f1a]/95 px-2 py-0.5 font-mono text-[8px] sm:text-[9px] font-bold backdrop-blur-md uppercase whitespace-nowrap ${colorClass}`}>
									{event.label}
								</div>
							</div>
						)
					})}
				</div>
			</div>

			<div className="mt-3 flex items-center gap-4 text-xs text-text1">
				<div className="flex items-center gap-2">
					<span className="h-3 w-3 rounded-sm bg-accent" />
					<span>Train Loss</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="h-3 w-3 rounded-sm bg-red" />
					<span>Val Loss</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="h-3 w-3 rounded-sm bg-green" />
					<span>Accuracy</span>
				</div>
				{phaseMarkers.length > 0 && (
					<div className="ml-auto text-text2">
						{phaseMarkers[phaseMarkers.length - 1].label} phase
					</div>
				)}
			</div>
		</div >
	)
}

export default TrainingCurve
