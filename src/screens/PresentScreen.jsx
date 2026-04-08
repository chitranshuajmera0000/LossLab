import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession.js'
import LoadingSkeleton from '../components/shared/LoadingSkeleton.jsx'
import PresentationDeck from '../components/present/PresentationDeck.jsx'
import { usePresentationDeckData } from '../hooks/usePresentationDeckData.js'

function PresentScreen() {
    const navigate = useNavigate()
    const { team, restoreSession } = useSession()

    useEffect(() => {
        let cancelled = false
        async function ensureTeam() {
            if (!team?.id) {
                const restored = await restoreSession()
                if (!cancelled && !restored) {
                    navigate('/join')
                }
            }
        }
        ensureTeam()
        return () => {
            cancelled = true
        }
    }, [team?.id, navigate, restoreSession])

    const teamId = team?.id ?? null
    const { isLoading, teamRow, mission, allRuns, bestRun, notes } = usePresentationDeckData(teamId)

    if (!teamId) {
        return <LoadingSkeleton />
    }

    if (isLoading) {
        return <LoadingSkeleton />
    }

    return (
        <PresentationDeck
            variant="lab"
            teamName={teamRow?.session_code ?? team?.session_code ?? team?.team_name}
            sessionCode={teamRow?.session_code ?? team?.session_code}
            mission={mission}
            allRuns={allRuns}
            bestRun={bestRun}
            notes={notes}
            onBackToLab={() => navigate('/lab')}
        />
    )
}

export default PresentScreen
