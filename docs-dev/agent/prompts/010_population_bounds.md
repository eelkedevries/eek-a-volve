# Task: Population bounds and near-extinction handling

## Goal

Enforce a hard population ceiling, surface near-extinction as a visible event, and optionally trickle in immigrants.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Domain rules → Population bounds_ — both the food carrying capacity and a hard population ceiling are mandatory; extinction and unbounded growth must both be impossible. Near-extinction is detected and surfaced as an event rather than a frozen screen; an optional trickle of immigrants may be configured.

## Required changes

1. Enforce a hard maximum agent count so that reproduction and immigration cannot exceed it.
2. Detect near-extinction (population below a small threshold) and emit a discrete event/flag for later display and narration; do not freeze the simulation.
3. Optional immigration: when enabled in params, introduce occasional immigrants with fresh genomes, deterministically via the RNG and within the ceiling.

## Do not implement

Do not implement:
- catastrophe events (Phase 5) or freak-mutation display;
- species clustering;
- rendering, the worker, or the narrator.

## Acceptance criteria

The task is complete when:
- tests pass — the ceiling is never exceeded, the near-extinction flag fires, and immigration respects its toggle and the ceiling, deterministically;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`010_population_bounds.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
