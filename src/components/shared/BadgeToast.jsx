import { motion as Motion } from 'framer-motion'
import { BADGES } from '../../lib/badges.js'

// Usage: toast.custom(<BadgeToast badge={BADGES.exploder} />)
function BadgeToast({ badge, badgeKey }) {
	const resolvedBadge = badge || (badgeKey ? BADGES[badgeKey] : null)
	if (!resolvedBadge) return null
	return (
		<Motion.div
			initial={{ x: 200, opacity: 0 }}
			animate={{ x: 0, opacity: 1 }}
			exit={{ x: 200, opacity: 0 }}
			transition={{ type: 'spring', stiffness: 400, damping: 30 }}
			className="w-[180px] bg-bg2 rounded-xl border p-3 flex flex-col gap-1 shadow-lg relative"
			style={{ borderLeft: `3px solid ${resolvedBadge.color}` }}
		>
			<div className="text2 text-[8px] uppercase font-mono tracking-widest mb-1">BADGE UNLOCKED</div>
			<div className="flex items-center gap-2 mb-1">
				<span style={{ fontSize: 24 }}>{resolvedBadge.icon}</span>
				<span className="font-bold text-[14px]" style={{ color: resolvedBadge.color }}>{resolvedBadge.name}</span>
			</div>
			<div className="text2 text-[11px] leading-tight">{resolvedBadge.description}</div>
		</Motion.div>
	)
}

export default BadgeToast
