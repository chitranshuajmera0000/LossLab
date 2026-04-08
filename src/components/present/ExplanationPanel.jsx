function NoteCard({ title, borderClass, titleClass, content }) {
	const isEmpty = !content || !content.trim()
	return (
		<article className={`min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-bg2 p-5 md:p-6 ${borderClass}`}>
			<h3 className={`font-mono text-[12px] uppercase tracking-[0.14em] md:text-[13px] ${titleClass}`}>{title}</h3>
			<p
				className={`mt-3 text-lg leading-relaxed md:text-[19px] ${isEmpty ? 'italic text-text2' : 'text-text1'}`}
			>
				{isEmpty ? "Team hasn't filled this section yet" : content}
			</p>
		</article>
	)
}

function ExplanationPanel({ notes = {} }) {
	return (
		<section className="grid min-w-0 max-w-full grid-cols-1 gap-4 lg:grid-cols-3">
			<NoteCard
				title="OUR APPROACH"
				borderClass="border-l-[3px] border-l-accent"
				titleClass="text-accent"
				content={notes.approach}
			/>
			<NoteCard
				title="WHAT BROKE + HOW WE FIXED IT"
				borderClass="border-l-[3px] border-l-amber"
				titleClass="text-amber"
				content={notes.broke}
			/>
			<NoteCard
				title="THE CONCEPT THIS ILLUSTRATES"
				borderClass="border-l-[3px] border-l-green"
				titleClass="text-green"
				content={notes.concept}
			/>
		</section>
	)
}

export default ExplanationPanel
