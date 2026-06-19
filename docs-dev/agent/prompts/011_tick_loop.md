# Task: Fixed-timestep tick loop

## Goal

Integrate the core systems into a single deterministic fixed-timestep tick and a headless run helper.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Architecture_ (fixed-timestep loop) and _Domain rules → Determinism_. This prompt builds the headless tick that advances the world by one step. The accumulator, the ticks-per-frame multiplier, and the hard cap on ticks per frame belong to the worker/render layer in a later phase, not here.

## Required changes

1. In `src/core/loop.ts`, implement `step(world, params, rng)` (one tick) that applies, in a fixed deterministic order: rebuild the grid → behaviour/movement → energy and eating → food regeneration → reproduction → death → population bounds → update counters (births, deaths, tick).
2. Provide `createWorld(params)` that seeds the starting population and food deterministically, and a `run(world, ticks)` helper for headless runs.
3. Add tests: a fixed seed and params reproduce identical world state after N ticks (determinism); counters stay consistent; no allocation on the per-tick path.

## Do not implement

Do not implement:
- the Web Worker, snapshots, or the message protocol;
- rendering, the UI, the time multiplier, or the frame cap.

## Acceptance criteria

The task is complete when:
- tests pass and an identical seed + params yield identical state after N ticks;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`011_tick_loop.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
