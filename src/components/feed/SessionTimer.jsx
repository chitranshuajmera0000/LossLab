import { useEffect, useState } from 'react'
import clsx from 'clsx'

function pad(n) {
  return n < 10 ? '0' + n : n
}

export default function SessionTimer({ timerStart, durationMinutes }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const start = timerStart ? new Date(timerStart).getTime() : 0
  const duration = (durationMinutes || 0) * 60 * 1000
  const end = start + duration
  const remaining = Math.max(0, Math.floor((end - now) / 1000))

  let color = 'text1'
  let pulse = ''
  if (remaining <= 120) {
    color = 'text-red-500'
    pulse = 'animate-pulse-fast'
  } else if (remaining <= 300) {
    color = 'text-amber-400'
    pulse = 'animate-pulse'
  }

  // Expired
  if (remaining <= 0) {
    return <span className="font-mono text-[18px] text-red-500 font-bold">TIME</span>
  }

  const mm = pad(Math.floor(remaining / 60))
  const ss = pad(remaining % 60)

  return (
    <span className={clsx('font-mono text-[18px] font-bold', color, pulse)}>
      {mm}:{ss}
    </span>
  )
}

// Tailwind pulse animations
// .animate-pulse-fast { animation: pulse 0.7s cubic-bezier(0.4,0,0.6,1) infinite; }
