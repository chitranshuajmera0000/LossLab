const MIN_CHARS = 21

function Field({ label, keyName, colorClass, placeholder, notes, onNotesChange, readOnly }) {
	const value = notes[keyName] || ''
	return (
		<div className={`rounded-xl border border-white/5 bg-bg2/40 backdrop-blur-md p-3 transition-all duration-300 focus-within:bg-bg2/60 focus-within:shadow-md ${colorClass}`}>
			<label className="text-[9px] font-semibold uppercase tracking-[0.14em] text-text2">{label}</label>
			<textarea
				value={value}
				readOnly={readOnly}
				onChange={(e) => onNotesChange(keyName, e.target.value)}
				placeholder={placeholder}
				className="mt-1.5 h-[90px] w-full resize-none rounded-lg border border-white/10 bg-black/20 p-2 text-[13px] leading-5 text-text0 outline-none transition duration-300 focus:border-accent focus:bg-black/40 focus:shadow-[0_0_10px_rgba(34,211,238,0.2)]"
			/>
			<div className={`mt-1 text-right text-[10px] ${value.trim().length > 20 ? 'text-green-400' : 'text-text2/60'}`}>
				{value.length} / 21 chars
			</div>
		</div>
	)
}

function NotesPanel({ notes, onNotesChange, onSubmit, isSubmitted, canSubmit, onEdit }) {
	return (
		<section className="rounded-2xl border border-white/10 bg-bg1/40 backdrop-blur-xl p-3 shadow-lg">
			<div className="mb-2 text-[11px] uppercase tracking-[0.1em] text-text2">Presentation Notes</div>

			<div className="space-y-2">
				<Field
					label="Our Approach"
					keyName="approach"
					colorClass="border-l-2 border-l-accent"
					notes={notes}
					onNotesChange={onNotesChange}
					readOnly={isSubmitted}
					placeholder="Why did you choose these hyperparameters? What was your hypothesis going in?"
				/>

				<Field
					label="What Broke + How We Fixed It"
					keyName="broke"
					colorClass="border-l-2 border-l-amber"
					notes={notes}
					onNotesChange={onNotesChange}
					readOnly={isSubmitted}
					placeholder="Describe at least one failure. What did you observe? Why did it happen? What was your fix?"
				/>

				<Field
					label="Concept This Illustrates"
					keyName="concept"
					colorClass="border-l-2 border-l-green"
					notes={notes}
					onNotesChange={onNotesChange}
					readOnly={isSubmitted}
					placeholder="e.g. vanishing gradient, overfitting, LR sensitivity, optimizer convergence..."
				/>
			</div>

			<button
				type="button"
				onClick={onSubmit}
				disabled={isSubmitted || !canSubmit}
				title={!canSubmit ? `Each section needs more than ${MIN_CHARS - 1} characters` : ''}
				className="mt-3 w-full rounded-xl border-0 bg-gradient-to-r from-accent to-accent2 px-3 py-2.5 text-sm font-bold text-white shadow-[0_4px_15px_rgba(34,211,238,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(34,211,238,0.5)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none"
			>
				Submit for Presentation →
			</button>

			{isSubmitted ? (
				<div className="mt-2 flex items-center justify-between rounded-lg border border-green/40 bg-green/10 px-3 py-1.5 text-xs text-green">
					<span>✓ Submitted — waiting for your turn to present</span>
					{onEdit && (
						<button
							onClick={onEdit}
							className="rounded-md bg-green/20 px-2 py-1 font-bold text-green transition hover:bg-green/30"
						>
							Edit
						</button>
					)}
				</div>
			) : null}
		</section>
	)
}

export default NotesPanel
