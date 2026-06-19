# Task: Seeded RNG and test harness

## Goal

Add the deterministic `mulberry32` generator in `core/`, and the Vitest harness that proves it.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

First Phase 1 prompt (see `docs-dev/planning/roadmap.md`). Spec: _Domain rules → Determinism_ — `mulberry32` drives every stochastic decision, and the unseeded platform random source is never used on the simulation path. This prompt also resolves the roadmap's open test-runner decision by establishing Vitest.

## Required changes

1. Add Vitest as a dev dependency; add `test` and `test:run` scripts to `package.json`; add a minimal Vitest config (Node test environment). Record the test runner and the `npm test` command in `AGENTS.md` (Project conventions: Testing policy / Verify).
2. Add an `npm test` (vitest run) step to `.github/workflows/check-build.yml` so `core/` tests run in CI.
3. Implement `mulberry32` in `src/core/rng.ts`: constructed from a numeric seed; exposes a `next()` float in `[0, 1)` and small helpers as needed (e.g. integer-in-range, pick-from-array); documented algorithm; instance state only (no module-level mutable state).
4. Add `src/core/rng.test.ts`: identical seed ⇒ identical sequence; different seeds ⇒ divergent sequences; every value in `[0, 1)`.

## Do not implement

Do not implement:
- world state, agents, food, or any simulation beyond the RNG;
- any DOM, PixiJS, worker, or UI code;
- any use of `Math.random` on the simulation path.

## Acceptance criteria

The task is complete when:
- `npm test` passes, and the RNG reproduces a fixed known sequence for a given seed;
- `npm run build` still succeeds;
- CI runs the tests on push.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`002_seeded_rng.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
