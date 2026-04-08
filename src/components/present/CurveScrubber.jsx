import { useMemo, useState } from 'react'
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

const verticalLinePlugin = {
	id: 'scrubberLine',
	afterDraw(chart, _args, pluginOptions) {
		const index = pluginOptions?.index ?? 0
		const xScale = chart.scales.x
		const yScale = chart.scales.y
		if (!xScale || !yScale) return

		const x = xScale.getPixelForValue(index)
		const { ctx } = chart
		ctx.save()
		ctx.strokeStyle = '#fbbf24'
		ctx.setLineDash([4, 4])
		ctx.lineWidth = 1
		ctx.beginPath()
		ctx.moveTo(x, yScale.top)
		ctx.lineTo(x, yScale.bottom)
		ctx.stroke()
		ctx.restore()
	},
}

function normalizeBestRun(bestRun) {
	if (!bestRun) return null
	return {
		trainLoss: bestRun.train_loss || bestRun.trainLoss || bestRun.result?.trainLoss || [],
		valLoss: bestRun.val_loss || bestRun.valLoss || bestRun.result?.valLoss || [],
		accuracy: bestRun.accuracy || bestRun.result?.accuracy || [],
		epochs: bestRun.epochs || bestRun.result?.epochs || (bestRun.accuracy || []).length,
	}
}

function CurveScrubber({ bestRun }) {
	const normalized = useMemo(() => normalizeBestRun(bestRun), [bestRun])
	const [epochIndex, setEpochIndex] = useState(0)

	if (!normalized) {
		return (
			<section className="rounded-xl border border-border bg-bg2 p-4 text-base text-text2 md:text-lg">
				No run available for curve scrubber yet.
			</section>
		)
	}

	const total = normalized.epochs || 1
	const labels = Array.from({ length: total }, (_, i) => i + 1)

	const data = {
		labels,
		datasets: [
			{
				label: 'Train Loss',
				data: normalized.trainLoss,
				borderColor: '#4f8ef7',
				borderWidth: 2,
				pointRadius: 0,
				tension: 0.25,
				yAxisID: 'y',
			},
			{
				label: 'Val Loss',
				data: normalized.valLoss,
				borderColor: '#f87171',
				borderWidth: 2,
				borderDash: [4, 4],
				pointRadius: 0,
				tension: 0.25,
				yAxisID: 'y',
			},
			{
				label: 'Accuracy',
				data: normalized.accuracy,
				borderColor: '#34d399',
				borderWidth: 2,
				pointRadius: 0,
				tension: 0.25,
				yAxisID: 'y1',
			},
		],
	}

	const options = {
		responsive: true,
		maintainAspectRatio: false,
		animation: false,
		plugins: {
			legend: {
				display: true,
				position: 'bottom',
				align: 'start',
				labels: {
					color: '#a8adc8',
					usePointStyle: true,
					pointStyle: 'line',
					boxWidth: 28,
					boxHeight: 10,
					padding: 16,
					font: {
						size: 14,
						weight: '600',
					},
				},
			},
			scrubberLine: { index: epochIndex },
			tooltip: {
				backgroundColor: '#111420',
				borderColor: '#252a40',
				borderWidth: 1,
				titleColor: '#e8eaf6',
				bodyColor: '#a8adc8',
			},
		},
		scales: {
			x: {
				ticks: { color: '#5c6285', font: { size: 13 } },
				grid: { color: '#1e2338' },
			},
			y: {
				min: 0,
				max: 3,
				position: 'left',
				ticks: { color: '#5c6285', font: { size: 13 } },
				grid: { color: '#1e2338' },
			},
			y1: {
				min: 0,
				max: 1,
				position: 'right',
				ticks: { color: '#5c6285', font: { size: 13 } },
				grid: { drawOnChartArea: false },
			},
		},
	}

	const train = normalized.trainLoss[epochIndex] ?? 0
	const acc = (normalized.accuracy[epochIndex] ?? 0) * 100

	return (
		<section className="max-w-full min-w-0 overflow-hidden rounded-xl border border-border bg-bg2 p-4 md:p-5">
			<header className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-text2 md:text-[14px]">
				Curve Scrubber
			</header>

			<div className="relative h-[300px] w-full max-w-full min-w-0 overflow-hidden md:h-[340px]">
				<Line data={data} options={options} plugins={[verticalLinePlugin]} />
			</div>

			<div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
				<input
					type="range"
					min={0}
					max={Math.max(0, total - 1)}
					step={1}
					value={epochIndex}
					onChange={(e) => setEpochIndex(Number(e.target.value))}
					className="h-3 w-full cursor-pointer appearance-none rounded-lg bg-border2"
				/>

				<div className="flex flex-wrap items-center gap-2 font-mono text-sm md:text-[15px]">
					<span className="rounded-md bg-bg3 px-3 py-1.5 text-text2">
						Epoch {epochIndex + 1} / {total}
					</span>
					<span className="rounded-md bg-accent/20 px-3 py-1.5 text-accent">Train Loss: {train.toFixed(3)}</span>
					<span className="rounded-md bg-green/20 px-3 py-1.5 text-green">Accuracy: {acc.toFixed(1)}%</span>
				</div>
			</div>
		</section>
	)
}

export default CurveScrubber
