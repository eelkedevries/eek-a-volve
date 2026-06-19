# Task: Catastrophe events

## Goal

Add optional catastrophe events (meteor strike, plague, ice age, food drought) behind the catastrophe toggle, surfaced for display.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Domain rules → Events_ — optional discrete disturbances behind the catastrophe toggle; population must not be driven to forced extinction or unbounded growth (the bounds still hold). Deterministic via the seeded generator. Keep effects simple and legible.

## Required changes

1. In `src/core/events.ts`, define the catastrophe kinds and a deterministic scheduler that, when `params.catastrophes` is set, occasionally triggers one: e.g. a meteor kills agents in a region, a plague kills a fraction at random, an ice age raises metabolic drain briefly, a drought cuts food. Expose the most recent event so the snapshot/UI can surface it.
2. Integrate into the fixed tick order; ensure population bounds still hold afterwards.
3. Add tests: each event type has its stated effect; events only fire when enabled; scheduling is deterministic; the population stays within bounds across a long run with catastrophes on.

## Do not implement

Do not implement:
- the narrator or milestone text;
- rendering/UI beyond exposing the latest event in state.

## Acceptance criteria

The task is complete when:
- tests pass for each effect, the toggle, determinism, and bounded population;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`021_catastrophes.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
