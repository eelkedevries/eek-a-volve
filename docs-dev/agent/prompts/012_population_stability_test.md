# Task: Population-stability test

## Goal

Add a headless long-run test asserting the ecosystem neither goes extinct nor grows unbounded, completing Phase 1.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Domain rules → Population bounds_ — without bounds an agent-based ecosystem tends either to extinction or to unbounded growth, and both outcomes must be impossible. This satisfies the `AGENTS.md` testing policy's population-stability check and closes Phase 1 in `docs-dev/planning/roadmap.md`.

## Required changes

1. Add `src/core/stability.test.ts`: from default params and a fixed seed, run many ticks and assert the population stays within sane bounds for the entire run (above the near-extinction floor, below the hard ceiling) and remains deterministic.
2. If the run reveals instability, adjust only constants/tuning in params (not new systems) to reach stability, and record any settled constants in `docs-dev/reference/primary_authoritative/specification.md`, bumping its version.

## Do not implement

Do not implement:
- new simulation systems;
- the worker, rendering, or the UI.

## Acceptance criteria

The task is complete when:
- the stability test passes deterministically and the population stays bounded across a long run;
- `npm run build` succeeds;
- if any constants changed, the specification is updated and its version bumped.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`012_population_stability_test.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
