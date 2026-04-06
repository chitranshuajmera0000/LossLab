import { motion as Motion } from 'framer-motion'
import { Info } from 'lucide-react'
import { resolveThinkingPrompt } from '../../engine/diagnostics.js'

const ICONS = {
	ok: { icon: '✓', color: 'text-green' },
	warn: { icon: '⚠', color: 'text-amber' },
	error: { icon: '✕', color: 'text-red' },
	info: { icon: 'ℹ', color: 'text-accent' },
}

function Diagnostics({ diagnostics = [], mission, runCount = 0 }) {
	const thinkingPrompt = resolveThinkingPrompt(mission, runCount)

	return (
		<Motion.section
			initial={{ opacity: 0, y: 16 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
			className="rounded-xl border border-border bg-bg1"
		>
			{thinkingPrompt && (
				<div className="border-b border-border bg-bg0 px-3 py-3">
					<div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-accent">Thinking prompt (pre-run)</div>
					<p className="text-sm leading-6 text-text1">{thinkingPrompt}</p>
				</div>
			)}

			<header className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm font-semibold text-text0">
				<span>Diagnostics (post-run)</span>
				<Info size={14} className="text-text2" />
			</header>

			<div className="divide-y divide-border">
				{diagnostics.length === 0 ? (
					<div className="px-3 py-3 text-xs text-text2">Run training to view diagnostics.</div>
				) : (
					diagnostics.map((diag, idx) => {
						const ui = ICONS[diag.type] || ICONS.info
						return (
							<div key={`${diag.title}-${idx}`} className="grid grid-cols-[18px_1fr] gap-2 px-3 py-2.5">
								<div className={`pt-0.5 text-sm ${ui.color}`}>{ui.icon}</div>
								<div>
									<div className="text-[12px] font-bold text-text0">{diag.title}</div>
									<p className="mt-0.5 text-[11px] leading-[1.5] text-text1">{diag.message}</p>
								</div>
							</div>
						)
					})
				)}
			</div>
		</Motion.section>
	)
}

export default Diagnostics
