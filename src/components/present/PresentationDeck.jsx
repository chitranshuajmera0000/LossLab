import ConfigCard from './ConfigCard.jsx'
import Timeline from './Timeline.jsx'
import CurveScrubber from './CurveScrubber.jsx'
import ExplanationPanel from './ExplanationPanel.jsx'
import { generateInsight } from '../../engine/diagnostics.js'
import BadgeToast from '../shared/BadgeToast.jsx'

/**
 * Shared layout for /present (team laptop) and /project (room projector).
 * @param {'lab' | 'projector'} props.variant
 */
export default function PresentationDeck({
    variant = 'lab',
    teamName,
    sessionCode,
    mission,
    allRuns,
    bestRun,
    notes,
    onBackToLab,
}) {
    const initialConfig = allRuns.length > 0 ? allRuns[0]?.config : null
    /** fullScore may be missing on edge-case rows; fall back to score */
    const finalScore = bestRun?.fullScore?.total ?? bestRun?.score ?? 0
    const finalInsight =
        bestRun && mission ? generateInsight(bestRun.config, bestRun.result, mission) : ''
    const finalBadges = Array.from(
        new Set((allRuns || []).flatMap((run) => run?.fullScore?.badges || [])),
    )
    const scoreBreakdown = bestRun?.fullScore?.scoreBreakdownLabels || []

    const isProjector = variant === 'projector'

    return (
        <main className="min-h-screen w-full min-w-0 max-w-full overflow-x-hidden bg-bg0 text-text0 text-[17px] leading-snug md:text-[18px]">
            <header className="flex w-full min-w-0 max-w-full flex-col gap-4 border-b border-border bg-bg1 px-6 py-4 md:flex-row md:flex-wrap md:items-start md:justify-between md:px-8 md:py-5">
                <div className="min-w-0 shrink">
                    <div className="flex items-center gap-2 text-[16px] uppercase tracking-[0.12em] text-green md:text-[17px]">
                        <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-green" />
                        <span>{isProjector ? 'PROJECTOR' : 'PRESENTING'}</span>
                    </div>
                    <h1 className="mt-1 break-words font-['Syne'] text-[32px] font-bold text-text0 md:text-[40px]">
                        {teamName || 'Team'}
                    </h1>
                    {sessionCode ? (
                        <p className="text-[14px] font-mono text-text2 mt-1 uppercase tracking-wider md:text-[15px]">
                            {sessionCode}
                        </p>
                    ) : null}
                </div>

                <div className="min-w-0 max-w-full shrink text-[18px] text-text2 md:text-center md:text-[20px] md:px-2">
                    {mission?.title || 'Mission'}
                </div>

                <div className="flex min-w-0 max-w-full flex-wrap items-center gap-4 md:justify-end">
                    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3 md:gap-4">
                        <span className="text-[14px] uppercase font-bold text-text2 tracking-wider md:text-[15px]">Score:</span>
                        <div className="shrink-0 font-mono text-[40px] text-pink md:text-[48px]">{finalScore}</div>
                        {scoreBreakdown.length > 0 && (
                            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 border-white/10 md:border-l md:pl-4">
                                {scoreBreakdown
                                    .filter((item) => item.value !== 0)
                                    .map((item, idx) => {
                                        const isNegative = item.value < 0
                                        const colorClass = isNegative ? 'text-red-400' : 'text-green-400'
                                        return (
                                            <span
                                                key={idx}
                                                className="text-[13px] font-mono tracking-wider bg-black/20 px-2.5 py-1 rounded flex gap-1.5 items-center md:text-[14px]"
                                            >
                                                <span className="text-text2">{item.label}</span>
                                                <span className={colorClass}>
                                                    {item.value > 0 ? '+' : ''}
                                                    {item.value}
                                                </span>
                                            </span>
                                        )
                                    })}
                            </div>
                        )}
                    </div>
                    {!isProjector && onBackToLab ? (
                        <button
                            type="button"
                            onClick={onBackToLab}
                            className="text-lg text-text2 transition hover:text-text1"
                        >
                            ← Back to Lab
                        </button>
                    ) : null}
                </div>
            </header>

            <section className="grid min-h-0 w-full min-w-0 max-w-full gap-5 p-5 md:gap-6 md:p-8">
                <div className="min-w-0 max-w-full rounded-xl border border-white/5 bg-bg1 px-5 py-5 md:px-7 md:py-6">
                    <h2 className="mb-3 text-[15px] font-bold uppercase tracking-[0.15em] text-accent md:text-[16px]">Mission Brief</h2>
                    <p className="mb-4 break-words text-[19px] leading-relaxed text-text1 md:text-[21px]">{mission?.description}</p>

                    <div className="flex flex-wrap items-start gap-x-6 gap-y-3 text-[17px] md:text-[18px]">
                        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                            <span className="rounded bg-black/20 px-3 py-1 break-words text-text2">
                                Dataset: {mission?.dataset}
                            </span>
                            <span className="rounded bg-black/20 px-3 py-1 text-text2">
                                Time: {mission?.timeLimit} min
                            </span>
                        </div>
                        <div className="flex min-w-0 max-w-full flex-wrap items-start gap-2">
                            <span className="shrink-0 font-semibold text-text2">Win:</span>
                            <span className="min-w-0 break-words text-text1">{mission?.winCondition}</span>
                        </div>
                        <div className="flex min-w-0 max-w-full flex-wrap items-start gap-2">
                            <span className="shrink-0 font-semibold text-text2">Stretch:</span>
                            <span className="min-w-0 break-words text-text1">{mission?.stretchGoal}</span>
                        </div>
                    </div>
                </div>

                {/* Top: config | timeline only (same row height). Badges move full-width below so the timeline column is not stretched by a tall left stack. */}
                <div className="grid min-h-0 min-w-0 max-w-full grid-cols-1 items-stretch gap-4 overflow-hidden xl:grid-cols-2">
                    <div className="min-h-0 min-w-0">
                        <ConfigCard
                            config={bestRun?.config}
                            previousConfig={initialConfig}
                            lockedParams={mission?.lockedParams || []}
                            comparisonLabel="KEY CHANGES FROM INITIAL STATE"
                        />
                    </div>
                    <div className="flex min-h-0 min-w-0 max-h-[min(100%,calc(100vh-12rem))] max-w-full flex-col overflow-hidden xl:h-full xl:max-h-[calc(100vh-15rem)] xl:min-h-0">
                        <Timeline allRuns={allRuns} />
                    </div>
                </div>

                {finalBadges.length > 0 && (
                    <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-bg2 p-5 md:p-6">
                        <h3 className="mb-4 text-center text-[14px] font-semibold uppercase tracking-[0.14em] text-text2 md:text-[15px] xl:text-left">
                            Badges Unlocked
                        </h3>
                        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 xl:gap-4">
                            {finalBadges.map((badgeKey) => (
                                <div
                                    key={badgeKey}
                                    className="pointer-events-none flex min-w-0 justify-center overflow-hidden md:scale-[1.03]"
                                >
                                    <BadgeToast badgeKey={badgeKey} hideClose />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <CurveScrubber bestRun={bestRun} />

                {finalInsight && (
                    <div className="min-w-0 max-w-full rounded-xl border-l-4 border-l-accent bg-bg2/40 px-5 py-5 backdrop-blur-md md:px-7 md:py-6">
                        <h3 className="mb-2 text-[14px] font-bold uppercase tracking-[0.15em] text-accent md:text-[15px]">
                            Socratic AI Insight
                        </h3>
                        <p className="break-words text-xl text-text1 leading-relaxed md:text-[22px]">{finalInsight}</p>
                    </div>
                )}

                <ExplanationPanel notes={notes} />
            </section>
        </main>
    )
}
