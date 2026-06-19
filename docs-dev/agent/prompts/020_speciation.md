# Task: Speciation by genetic distance

## Goal

Cluster agents into species by genetic distance and assign stable species labels and colours for display and narration.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Domain rules → Speciation_ — agents are clustered by genetic distance above a threshold and assigned species labels and colours; the clustering is emergent, not imposed. Run periodically (not every tick) and write the resulting label into `world.speciesId`, which the snapshot already exposes as the colour index.

## Required changes

1. In `src/core/speciation.ts`, a deterministic clustering over live agents by normalised genetic distance (a threshold over the trait vector), assigning each a species id; keep ids stable across re-clusters where a lineage persists.
2. Invoke it at a fixed interval from the simulation loop and store ids in `world.speciesId`.
3. Add tests: well-separated trait groups form distinct species; agents within the threshold share a species; clustering is deterministic; the species count is reported.

## Do not implement

Do not implement:
- catastrophe events or the narrator;
- rendering changes (the colour index already flows through the snapshot).

## Acceptance criteria

The task is complete when:
- tests pass for separation, grouping, determinism, and species count;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`020_speciation.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
