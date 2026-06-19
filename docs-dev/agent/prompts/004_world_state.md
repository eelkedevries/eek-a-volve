# Task: Structure-of-arrays world state and object pools

## Goal

Add the structure-of-arrays world state with pre-allocated agent and food pools and slot reuse, allocating nothing on the per-tick path.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Data schemas_ — parallel typed arrays for position (x, y), velocity/heading, energy, age, genome traits, and species identifier, indexed by a stable agent slot; agent and food slots drawn from pre-allocated pools and reused on death and birth.

## Required changes

1. In `src/core/world.ts`, create a `World` holding parallel typed arrays sized to a fixed capacity: `x`, `y`, heading/velocity, `energy`, `age`, species id, and the genome traits stored column-wise per trait, plus a per-slot alive flag.
2. Provide pooled `spawnAgent(...)` and `killAgent(slot)` that reuse free slots via a free-list (or equivalent) without allocating, plus a stable iteration over live agents. Mirror a minimal pool for food slots.
3. Add tests: spawn/kill/respawn reuses slots; capacity is respected; live counts stay correct under churn; no array growth on the hot path.

## Do not implement

Do not implement:
- movement, energy rules, mutation, the spatial grid, or behaviour;
- rendering, snapshots, or the worker.

## Acceptance criteria

The task is complete when:
- tests pass for slot reuse, capacity limits, and count correctness;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`004_world_state.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
