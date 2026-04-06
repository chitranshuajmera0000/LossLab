import clsx from 'clsx'

function shimmerClass() {
	return 'animate-shimmer bg-gradient-to-r from-bg3 via-bg4 to-bg3 bg-[length:200%_100%]'
}

export function TeamCardSkeleton() {
	return (
		<div className={clsx('bg2 rounded-xl p-4 border border-border w-full h-[220px] mb-2', shimmerClass())} />
	)
}

export function LeaderboardRowSkeleton() {
	return (
		<div className={clsx('w-full h-8 rounded bg-bg3 mb-2', shimmerClass())} />
	)
}

export function CurveSkeleton() {
	return (
		<div className={clsx('w-full h-[180px] rounded bg-bg3', shimmerClass())} />
	)
}

function LoadingSkeleton() {
	return (
		<div className="min-h-screen bg-bg0 p-6">
			<div className="animate-pulse space-y-4">
				<div className="h-14 rounded-xl border border-border bg-bg2" />
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div className="h-64 rounded-xl border border-border bg-bg2" />
					<div className="h-64 rounded-xl border border-border bg-bg2" />
				</div>
				<div className="h-80 rounded-xl border border-border bg-bg2" />
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
					<div className="h-48 rounded-xl border border-border bg-bg2" />
					<div className="h-48 rounded-xl border border-border bg-bg2" />
					<div className="h-48 rounded-xl border border-border bg-bg2" />
				</div>
			</div>
		</div>
	)
}

export default LoadingSkeleton
