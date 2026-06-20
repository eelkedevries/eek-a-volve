# Task: Records and hall of fame

## Goal

Give the run memory and bragging rights: track the oldest, biggest, and most-prolific creatures ever, and surface a small hall of fame.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Records create stakes and stories ("Sir Reginald the Persistent"). Track them deterministically in the core so they are reproducible and testable; show them in a compact UI panel.

## Required changes

1. In `src/core/records.ts`, track running records over a run: greatest age reached, largest size, most offspring, longest-lived species, peak population (with the holder's name/binomial where applicable). Update as agents live and die; deterministic and allocation-light.
2. Expose records from the worker (extend the protocol or fold into the snapshot header/side-channel) for the UI.
3. In `src/ui/records.ts`, a small "hall of fame" panel; reflect the reigning Elder from 034.
4. Tests (core): records update correctly for constructed life/death sequences; deterministic.

## Do not implement

Do not implement:
- cross-reload persistence of records (out of scope);
- the legend or accessibility pass.

## Acceptance criteria

The task is complete when:
- core tests pass for record tracking and determinism;
- the hall of fame shows live records;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`039_records_and_hall_of_fame.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
