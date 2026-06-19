# Task: Uniform spatial grid

## Goal

Add a uniform spatial grid for fast, deterministic neighbour queries within a radius.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Architecture_ (`core/` contains the uniform spatial grid). It is used later to find food, threats, and mates within an agent's `senseRadius`.

## Required changes

1. In `src/core/grid.ts`, implement a uniform grid over the world bounds with a configurable cell size; populate and clear it each tick without per-tick allocation; query the agents/points within a radius of a position, returning them in a deterministic, stable order.
2. Integrate with `World` positions (rebuilt or updated each tick) without allocating on the hot path.
3. Add tests: neighbour queries return the correct set for known layouts; boundary and edge cells are handled; query order is deterministic.

## Do not implement

Do not implement:
- behaviour decisions, energy, mutation, or food;
- rendering or the worker.

## Acceptance criteria

The task is complete when:
- tests pass and queries are correct and deterministic;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`005_spatial_grid.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
