import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import LoadingSkeleton from '../components/shared/LoadingSkeleton.jsx'
import PresentationDeck from '../components/present/PresentationDeck.jsx'
import { usePresentationDeckData } from '../hooks/usePresentationDeckData.js'

export default function ProjectorPresentScreen() {
    const [params] = useSearchParams()
    const teamId = params.get('team')

    const { isLoading, notFound, teamRow, mission, allRuns, bestRun, notes } =
        usePresentationDeckData(teamId || null)

    const title = useMemo(() => {
        if (!teamId) return 'Missing team link'
        if (notFound) return 'Team not found'
        return null
    }, [teamId, notFound])

    if (!teamId) {
        return (
            <main className="min-h-screen bg-bg0 text-text0 flex flex-col items-center justify-center p-8">
                <h1 className="font-['Syne'] text-xl font-bold text-text1 mb-2">Projector view</h1>
                <p className="text-text2 text-sm text-center max-w-md">
                    Open this page from the admin dashboard using &ldquo;Open projector&rdquo; for a team, or use{' '}
                    <span className="font-mono text-accent">/project?team=&lt;team-id&gt;</span>.
                </p>
            </main>
        )
    }

    if (notFound) {
        return (
            <main className="min-h-screen bg-bg0 text-text0 flex flex-col items-center justify-center p-8">
                <h1 className="font-['Syne'] text-xl font-bold text-red mb-2">{title}</h1>
                <p className="text-text2 text-sm">Check the link or team UUID.</p>
            </main>
        )
    }

    if (isLoading) {
        return <LoadingSkeleton />
    }

    return (
        <PresentationDeck
            variant="projector"
            teamName={teamRow?.team_name}
            sessionCode={teamRow?.session_code}
            mission={mission}
            allRuns={allRuns}
            bestRun={bestRun}
            notes={notes}
        />
    )
}
