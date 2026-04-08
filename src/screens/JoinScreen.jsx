
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { toast } from 'react-hot-toast'

export default function JoinScreen() {
	const navigate = useNavigate()
	const { joinSession } = useSession()

	const [joinCode, setJoinCode] = useState('')
	const [joinError, setJoinError] = useState('')
	const [joinLoading, setJoinLoading] = useState(false)

	const handleJoin = async (e) => {
		e.preventDefault()
		setJoinError('')
		if (joinCode.length !== 6) {
			setJoinError('Session code must be 6 characters')
			return
		}
		setJoinLoading(true)
		const { error, resumed } = await joinSession({
			code: joinCode.toUpperCase(),
		})
		setJoinLoading(false)
		if (error === 'not_found') setJoinError('Session code not found — check with your instructor')
		else if (error === 'inactive') setJoinError('This session has ended')
		else if (error) setJoinError('Error joining session. Please try again.')
		else {
			toast.success(resumed ? `Welcome back to ${joinCode.toUpperCase()}! Resuming your session.` : `Joined ${joinCode.toUpperCase()} successfully!`)
			navigate('/lab')
		}
	}

	const handleCodeInput = (e) => {
		let v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
		if (v.length > 6) v = v.slice(0, 6)
		setJoinCode(v)
	}

	return (
		<main className="screen-shell flex items-center justify-center min-h-screen bg-bg0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-bg2 via-bg0 to-bg0 relative overflow-hidden">
			{/* Ambient glows */}
			<div className="pointer-events-none absolute inset-0 overflow-hidden">
				<div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-accent/5 blur-3xl" />
				<div className="absolute bottom-0 right-0 w-[400px] h-[300px] rounded-full bg-accent2/5 blur-3xl" />
			</div>

			<div className="relative z-10 w-full max-w-md">
				{/* Header */}
				<div className="mb-8 text-center">
					<div className="mb-2 bg-gradient-to-r from-accent to-accent2 bg-clip-text font-['Syne'] text-4xl font-bold text-transparent">
						LossLab
					</div>
					<div className="text-text2 text-sm">Enter your session code to begin</div>
				</div>

				<div className="bg-bg1/60 backdrop-blur-2xl rounded-3xl border border-white/10 p-8 shadow-[0_0_50px_-15px_rgba(34,211,238,0.2)]">
					<form className="flex flex-col gap-5" onSubmit={handleJoin}>
						{/* Session Code */}
						<div>
							<label className="block text-[11px] uppercase tracking-[0.12em] text-text2 mb-2">
								Session Code
							</label>
							<input
								className="w-full font-mono text-[36px] text-center tracking-[0.5em] bg-bg3 rounded-xl px-4 py-3 outline-none border border-transparent focus:border-accent/50 transition-colors"
								placeholder="XXXXXX"
								value={joinCode}
								onChange={handleCodeInput}
								maxLength={6}
								autoFocus
							/>
						</div>

						{/* Error */}
						{joinError && (
							<div className="text-red-400 text-sm rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
								{joinError}
							</div>
						)}

						{/* Submit */}
						<button
							className="w-full rounded-xl bg-gradient-to-r from-accent to-accent2 px-4 py-3 font-bold text-white shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
							type="submit"
							disabled={joinLoading || joinCode.length !== 6}
						>
							{joinLoading ? 'Joining...' : 'Join Session →'}
						</button>
					</form>
				</div>

				<div className="mt-4 text-center text-text2 text-xs">
					Don't have a code? Ask your instructor.
				</div>
			</div>
		</main>
	)
}
