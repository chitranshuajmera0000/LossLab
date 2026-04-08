function formatValue(value) {
	if (Array.isArray(value)) return value.length ? value.join(', ') : 'None'
	if (typeof value === 'number') {
		if (value > 0 && value < 0.001) return value.toExponential(2)
		if (!Number.isInteger(value)) return value.toFixed(3)
		return String(value)
	}
	if (value == null || value === '') return 'None'
	return String(value)
}

function titleCase(key) {
	return key
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (m) => m.toUpperCase())
}

function getTintClass(key, value, config) {
	const activation = config.activation
	const layers = Number(config.layers || 0)
	const lr = Number(config.lr || 0.001)

	if (key === 'init' && value === 'zeros') return 'bg-red/15 border-red/40'
	if (key === 'activation' && value === 'sigmoid' && layers >= 6) return 'bg-red/15 border-red/40'
	if (key === 'layers' && layers >= 7 && activation === 'sigmoid') return 'bg-red/15 border-red/40'

	if (key === 'init' && value === 'he' && ['relu', 'leaky', 'elu'].includes(activation)) {
		return 'bg-green/15 border-green/40'
	}
	if ((key === 'optimizer' || key === 'lr') && config.optimizer === 'adam' && lr <= 0.003) {
		return 'bg-green/15 border-green/40'
	}

	if (key === 'lr' && (lr > 0.1 || lr < 0.0003)) return 'bg-amber/15 border-amber/40'
	if (key === 'dropout' && Number(value) >= 0.5) return 'bg-amber/15 border-amber/40'

	return 'bg-bg3 border-border'
}

function getChangedParams(config, previousConfig) {
	if (!config || !previousConfig) return []
	return Object.keys(config).filter((key) => JSON.stringify(config[key]) !== JSON.stringify(previousConfig[key]))
}

function ConfigCard({ config, previousConfig, lockedParams = [], comparisonLabel = "KEY CHANGES THIS RUN" }) {
	if (!config) {
		return (
			<section className="rounded-xl border border-border bg-bg2 p-4 text-base text-text2 md:text-lg">
				No configuration found.
			</section>
		)
	}

	const changed = getChangedParams(config, previousConfig)
	const entries = Object.entries(config)

	return (
		<section className="max-w-full min-w-0 overflow-hidden rounded-xl border border-border bg-bg2 p-4 md:p-5">
			<header className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-text2 md:text-[13px]">
				FINAL CONFIGURATION
			</header>

			<div className="grid grid-cols-3 gap-2 md:gap-3">
				{entries.map(([key, value]) => {
					const isChanged = changed.includes(key)
					const isLocked = lockedParams.includes(key)
					return (
						<div
							key={key}
							className={`rounded border p-2.5 md:p-3 ${getTintClass(key, value, config)} ${isChanged ? 'border-l-4 border-l-green' : ''} ${isLocked ? 'opacity-80' : ''}`}
						>
							<div className="font-mono text-[10px] uppercase tracking-[0.1em] text-text2 md:text-[11px]">
								{titleCase(key)} {isLocked ? '• L' : ''}
							</div>
							<div className="mt-1 font-mono text-[15px] font-bold text-text0 md:text-[16px]">{formatValue(value)}</div>
						</div>
					)
				})}
			</div>

			<div className="mt-4 border-t border-border pt-3">
				<div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-text2 md:text-[13px]">{comparisonLabel}</div>
				<div className="flex flex-wrap gap-2">
					{changed.length === 0 ? (
						<span className="text-sm italic text-text2 md:text-base">No changes found</span>
					) : (
						changed.map((key) => (
							<span
								key={key}
								className="rounded-full border border-border2 bg-bg3 px-3 py-1.5 font-mono text-[12px] text-text1 md:text-[13px]"
							>
								{formatValue(previousConfig?.[key])} → {formatValue(config[key])}
							</span>
						))
					)}
				</div>
			</div>
		</section>
	)
}

export default ConfigCard
