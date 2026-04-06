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
    const finalBadges = bestRun?.fullScore?.badges || []
    const scoreBreakdown = bestRun?.fullScore?.scoreBreakdownLabels || []

    const isProjector = variant === 'projector'

    return (
        <main className="min-h-screen bg-bg0 text-text0">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-bg1 px-6 py-3">
                <div>
                    <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-green">
                        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green" />
                        <span>{isProjector ? 'PROJECTOR' : 'PRESENTING'}</span>
                    </div>
                    <h1 className="mt-1 font-['Syne'] text-[20px] font-bold text-text0">
                        {teamName || 'Team'}
                    </h1>
                    {sessionCode ? (
                        <p className="text-[10px] font-mono text-text2 mt-0.5 uppercase tracking-wider">
                            {sessionCode}
                        </p>
                    ) : null}
                </div>

                <div className="text-[13px] text-text2">{mission?.title || 'Mission'}</div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <span className="text-[10px] uppercase font-bold text-text2 tracking-wider">Score:</span>
                        <div className="font-mono text-[24px] text-pink">{finalScore}</div>
                        {scoreBreakdown.length > 0 && (
                            <div className="ml-2 flex flex-wrap items-center gap-2 border-l border-white/10 pl-4">
                                {scoreBreakdown
                                    .filter((item) => item.value !== 0)
                                    .map((item, idx) => {
                                        const isNegative = item.value < 0
                                        const colorClass = isNegative ? 'text-red-400' : 'text-green-400'
                                        return (
                                            <span
                                                key={idx}
                                                className="text-[10px] font-mono tracking-wider bg-black/20 px-2 py-0.5 rounded flex gap-1.5 items-center"
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
                            className="text-sm text-text2 transition hover:text-text1"
                        >
                            ← Back to Lab
                        </button>
                    ) : null}
                </div>
            </header>

            <section className="grid gap-4 p-5">
                <div className="rounded-xl border border-white/5 bg-bg1 px-5 py-4">
                    <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-accent">Mission Brief</h2>
                    <p className="mb-3 text-[14px] leading-relaxed text-text1">{mission?.description}</p>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="rounded bg-black/20 px-2 py-0.5 text-xs text-text2">
                                Dataset: {mission?.dataset}
                            </span>
                            <span className="rounded bg-black/20 px-2 py-0.5 text-xs text-text2">
                                Time: {mission?.timeLimit} min
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-text2">Win:</span>
                            <span className="text-text1">{mission?.winCondition}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-text2">Stretch:</span>
                            <span className="text-text1">{mission?.stretchGoal}</span>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="flex flex-col gap-4">
                        <ConfigCard
                            config={bestRun?.config}
                            previousConfig={initialConfig}
                            lockedParams={mission?.lockedParams || []}
                            comparisonLabel="KEY CHANGES FROM INITIAL STATE"
                        />
                        {finalBadges.length > 0 && (
                            <div className="rounded-xl border border-border bg-bg2 p-4">
                                <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-text2">
                                    Badges Unlocked
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {finalBadges.map((badgeKey) => (
                                        <div
                                            key={badgeKey}
                                            className="pointer-events-none transform scale-90 origin-left"
                                        >
                                            <BadgeToast badgeKey={badgeKey} hideClose />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <Timeline allRuns={allRuns} />
                </div>

                <CurveScrubber bestRun={bestRun} />

                {finalInsight && (
                    <div className="rounded-xl border-l-4 border-l-accent bg-bg2/40 px-5 py-4 backdrop-blur-md">
                        <h3 className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-accent">
                            Socratic AI Insight
                        </h3>
                        <p className="text-sm text-text1 leading-relaxed">{finalInsight}</p>
                    </div>
                )}

                <ExplanationPanel notes={notes} />
            </section>
        </main>
    )
}
