function NoteCard({ title, borderClass, titleClass, content }) {
	const isEmpty = !content || !content.trim()
	return (
		<article className={`rounded-lg border border-border bg-bg2 p-4 ${borderClass}`}>
			<h3 className={`font-mono text-[9px] uppercase tracking-[0.14em] ${titleClass}`}>{title}</h3>
			<p className={`mt-2 text-sm leading-[1.7] ${isEmpty ? 'italic text-text2' : 'text-text1'}`}>
				{isEmpty ? "Team hasn't filled this section yet" : content}
			</p>
		</article>
	)
}

function ExplanationPanel({ notes = {} }) {
	return (
		<section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
