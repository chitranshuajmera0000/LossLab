# LossLab Implementation Plan (Pre-Implementation Doc)

## Objective
Deliver a fully working LossLab experience across lab gameplay, diagnostics, scoring feedback, mission progression UI, and end-to-end flow, with production-safe behavior and no broken pathways.

### Scope Rule
- We will implement all functional and UX wiring now.
- Final mission content/data refresh can be swapped in later without breaking behavior.
- The system must function correctly with current mission objects and remain compatible with the redesigned mission schema.

---

## Source Inputs Used
This plan is based on:
- Mission redesign contract and win logic patterns (provided mission definition draft).
- Verification checklist and expected mission behavior.
- Roadmap of missing/partial areas and implementation sequence.

---

## Success Criteria
At completion, all of the following must be true:

1. Win and stretch states are evaluated after every run and clearly surfaced in UI.
2. Gap-based missions show gap as a first-class visible metric with threshold feedback.
3. Exploration requirements are visible (optimizers tried, batch sizes tried) and update live.
4. Stage-based Socratic prompts unlock by run count and are displayed distinctly from reactive diagnostics.
5. RunDelta warns when too many parameters changed at once.
6. Progress visuals communicate target thresholds clearly (win and stretch).
7. Training chart shows failure timing markers (explosion, plateau, overfit) when present.
8. Scoring logic aligns with updated mission intent (especially mission-specific bonus rules).
9. Primary user flow works end-to-end without runtime errors.
10. Code passes lint/build and key user journeys are manually validated.

---

## Change Set (What Will Be Implemented)

## Phase 1: Core Functional Wiring (Highest Priority)

### 1) Mission source alignment and export safety
Files:
- src/missions/missions.js
- src/missions/index.js

Work:
- Ensure mission object shape supports:
  - winFn(result, runs)
  - stretchFn(result, runs)
  - winThreshold (numeric, display-facing)
  - stretchThreshold (numeric, display-facing)
  - stages[{ runThreshold, message }]
  - lockedParams
  - mission metadata fields used by UI
- Add explicit threshold fields for UI visualization only (especially ProgressCompass arcs), while preserving function-based win logic as source of truth for pass/fail.
- Keep export contract stable to avoid screen/hook regressions.

Acceptance:
- App loads missions with no undefined property errors.
- Mission navigation remains stable.

### 2) Win and stretch evaluation after each simulation run
File:
- src/screens/LabScreen.jsx

Work:
- After run completion, evaluate mission winFn and stretchFn.
- Call signatures must pass both arguments where required by missions:
  - winFn(result, allRuns)
  - stretchFn(result, allRuns)
- Persist per-run and best-so-far status in local state/session state.
- Trigger user feedback toasts for:
  - First win
  - First stretch
  - Optional repeat messaging throttled to avoid spam
- Feed resulting status to metrics and progress components.

Acceptance:
- A qualifying run immediately shows win status.
- Stretch status appears only when condition is met.
- No duplicate toasts flooding on repeated renders.

### 3) Gap as a visible mission metric (missions with gap constraints)
File:
- src/components/lab/MetricsRow.jsx

Work:
- Add computed metric: gap = finalValLoss - finalTrainLoss.
- Render a Gap tile with color states by mission threshold bands.
- Make mission-aware:
  - Show gap threshold coloring only where win condition uses gap.
  - Keep generic display consistent for missions without gap rule.
- Keep layout responsive with 4/5 tile states.

Acceptance:
- Gap is visible and understandable during qualifying missions.
- Threshold color feedback reflects mission condition.

### 4) Exploration tracking indicators
File:
- src/components/lab/ProgressCompass.jsx

Work:
- Compute from run history:
  - Unique optimizers used
  - Unique batch sizes used
- Display requirement progress messaging in ProgressCompass (not MetricsRow) for relevant missions:
  - Optimizers tried: current / required
  - Batch sizes tried: current / required
- Show which exact values have been explored.

Acceptance:
- Mission 4 and mission 6 users can see why exploration requirement is passing/failing.
- Display updates immediately after each run.

### 5) Stage system for Socratic prompts
Files:
- src/engine/diagnostics.js
- src/components/lab/Diagnostics.jsx

Work:
- Add stage resolver utility:
  - Given mission stages + run count, return highest unlocked stage.
- Render a dedicated Thinking Prompt section in diagnostics UI with clear visual separation from reactive diagnostics.
- Preserve framing difference explicitly in UI copy and styling:
  - Thinking Prompt = pre-run guidance
  - Diagnostics = post-run analysis
- Keep reactive post-run diagnostics separate from proactive stage prompt.

Acceptance:
- Prompt updates as run count crosses thresholds.
- No conflict with existing diagnostic cards.

### 6) Multi-parameter change warning in run delta
File:
- src/components/lab/RunDelta.jsx

Work:
- Compare current and previous run config values over editable parameters.
- Count changed parameters.
- Show warning banner when changed count > 2.
- Keep existing delta visualization intact.

Acceptance:
- Warning appears only when threshold exceeded.
- Diff count is accurate.

---

## Phase 2: Make Feedback Visually Instructional

### 7) Progress compass threshold arcs
File:
- src/components/lab/ProgressCompass.jsx

Work:
- Add visual marks/arcs for:
  - Win threshold
  - Stretch threshold
- Show current/best performance marker.
- Pull threshold values from mission-derived logic (not hardcoded).

Acceptance:
- Learner can instantly see distance to win/stretch.

### 8) Training curve event annotations
File:
- src/components/lab/TrainingCurve.jsx

Work:
- Render vertical labeled markers for available change points:
  - Explosion epoch
  - Plateau epoch
  - Overfit start epoch
- Style by severity and keep readable on small widths.

Acceptance:
- Markers appear at correct epochs when data exists.
- Chart remains usable on desktop and mobile sizes.

### 9) Mission-specific diagnostic language
File:
- src/engine/diagnostics.js

Work:
- Add mission-aware phrasing variants by mission id and failure signature.
- Keep fallback generic diagnostics for unknown mission IDs.
- Ensure wording remains Socratic and non-spoiler where intended.

Acceptance:
- Diagnostic text differs by mission context for same broad failure class.

### 10) Scoring alignment with new mission intent
File:
- src/engine/scoring.js

Work:
- Update mission bonus rules to match redesigned pedagogical goals.
- Correct mission 5 (id: symmetrybreaker) logic to reward gap-aware regularization outcomes aligned with the mission win model (gap threshold behavior), not legacy init-based criteria.
- Ensure partial exploration credit for mission 4 and mission 6 requirements.

Acceptance:
- Score behavior matches mission objectives.
- No dead/legacy mission id branches.

---

## Phase 3: Readiness and Integration Hardening

### 11) Data contract audit (if backend mode is enabled)
Files:
- src/context/SessionContext.jsx
- src/hooks/useFeed.js
- related feed/session components

Work:
- Verify selected columns and payload shape match actual data usage.
- Add safe handling for nullable/missing fields.
- Prevent hard crashes from schema drift.

Acceptance:
- Feed/session features degrade gracefully if some fields are absent.

### 12) End-to-end workflow validation
Scope:
- Join -> Lab -> Present -> Feed

Work:
- Validate multi-user style workflow behavior in local test setup.
- Confirm leaderboard updates, badges, notes, run history, and mission statuses.

Acceptance:
- Full teaching loop works without blocking issues.

### 13) Real-data replay architecture
Status:
- Deferred optional enhancement.

Reason:
- Not required for core functionality.
- Will be added only when classroom readiness demands higher simulation fidelity.

---

## Implementation Details by Concern

### A) State model updates
- Introduce explicit status flags:
  - hasWonMission
  - hasReachedStretch
  - latestGap
  - explorationProgress
- Keep derived state memoized to avoid unnecessary re-renders.

### B) Utility functions to add/reuse
- getGapFromResult(result)
- getUniqueRunValues(runs, key)
- resolveUnlockedStage(stages, runCount)
- countChangedEditableParams(prevConfig, nextConfig, editableKeys)
- evaluateMissionStatus(mission, result, runs)

Implementation note:
- evaluateMissionStatus must always pass runs into mission callbacks because some missions depend on exploration history for win checks.

### C) UI consistency and resilience
- All new indicators must tolerate missing data.
- Use clear default placeholders when no prior run exists.
- Preserve responsive behavior and avoid layout shifts.

### D) Compatibility strategy
- Do not assume every mission contains all optional fields.
- Wrap mission callbacks defensively:
  - If winFn absent, fallback to false and log non-blocking warning in dev.

---

## Testing Plan

### Automated checks
- Run lint for changed files.
- Run build to ensure no compile/runtime import errors.

### Manual functional checks
1. Mission run creates results and updates all tiles.
2. Win condition triggers when threshold crossed.
3. Stretch triggers independently and correctly.
4. Gap missions show gap tile and threshold color.
5. Mission 4 displays optimizer exploration progress accurately.
6. Mission 6 displays batch-size exploration progress accurately.
7. Stage prompt changes at threshold boundaries.
8. RunDelta warning appears for >2 param changes.
9. Training curve annotations align with expected epochs.
10. Score updates are consistent with mission objectives.

### Regression checks
- No crash when missions lack stages or stretchFn.
- Existing screens still render with no console errors.
- Session context behavior remains intact.

---

## Execution Order (How I Will Implement)
1. Core mission wiring in LabScreen and shared derived helpers.
2. MetricsRow gap support and status coloring.
3. ProgressCompass exploration progress and threshold arcs.
4. Diagnostics stage resolver and UI card.
5. RunDelta multi-change warning.
6. TrainingCurve change point annotations.
7. diagnostics.js mission-specific prompts.
8. scoring.js alignment and partial-credit logic.
9. Build/lint/manual verification and targeted fixes.

---

## Risks and Mitigations
- Risk: Mission callback signatures vary.
  - Mitigation: Defensive callback wrappers and defaults.
- Risk: UI density in MetricsRow and ProgressCompass.
  - Mitigation: responsive truncation and compact labels.
- Risk: Score regressions due to changed bonus semantics.
  - Mitigation: mission-id test matrix and manual scenario checks.

---

## Out of Scope for This Pass
- Final mission dataset/content swap (can be dropped in later).
- New backend schema migrations.
- Real-data replay engine integration.

---

## Definition of Done
Work is done when:
- All scoped tasks above are implemented.
- Build/lint pass.
- Manual flow checks pass.
- No critical runtime errors remain in lab mission flow.
- Mission system functions end-to-end even before final mission data import.
