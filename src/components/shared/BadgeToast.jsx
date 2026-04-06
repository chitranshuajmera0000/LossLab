import { motion as Motion } from 'framer-motion'

// Usage: toast.custom(<BadgeToast badge={BADGES.exploder} />)
function BadgeToast({ badge }) {
	if (!badge) return null
	return (
		<Motion.div
			initial={{ x: 200, opacity: 0 }}
			animate={{ x: 0, opacity: 1 }}
			exit={{ x: 200, opacity: 0 }}
			transition={{ type: 'spring', stiffness: 400, damping: 30 }}
			className="w-[180px] bg-bg2 rounded-xl border p-3 flex flex-col gap-1 shadow-lg relative"
			style={{ borderLeft: `3px solid ${badge.color}` }}
		>
			<div className="text2 text-[8px] uppercase font-mono tracking-widest mb-1">BADGE UNLOCKED</div>
			<div className="flex items-center gap-2 mb-1">
				<span style={{ fontSize: 24 }}>{badge.icon}</span>
				<span className="font-bold text-[14px]" style={{ color: badge.color }}>{badge.name}</span>
			</div>
			<div className="text2 text-[11px] leading-tight">{badge.description}</div>
		</Motion.div>
	)
}

export default BadgeToast
