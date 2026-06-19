# Current state

Living, high-level orientation for the project: what exists now, key architectural decisions, and what is in progress. Read it at the start of a session to orient quickly.

Update it only for genuinely useful orientation — a new system, an architectural decision — not after routine commits. A stale or bloated state file is worse than none.

This file records what *is* (current reality). The binding design canon is `docs-dev/reference/primary_authoritative/`; when the two conflict, the canon wins and the gap is work still to be done.

## Systems

- **Project scaffold** — Vite + TypeScript static site (Vite 8 / TS 6), base path
  `/eek-a-volve/`, reproducible install via committed `package-lock.json`.
- **Deterministic core (`src/core/`)** — a complete, headless, tested simulation:
  seeded `mulberry32` RNG, parameters + genome trait definitions, structure-of-
  arrays world with pooled agent/food slots, uniform spatial grid, genome
  inheritance + mutation (+ freak mutations), energy/metabolism/death, food
  regeneration, the trait-driven behaviour policy (seek/flee/eat/reproduce),
  population bounds (ceiling, near-extinction, optional immigration), and the
  fixed-timestep `Simulation` loop. No worker, rendering, or UI yet.

## Key decisions

- Follow the eek-a-dev workflow: commit-to-`main`, one commit per prompt; the
  binding design is `reference/primary_authoritative/specification.md`.
- Sequencing is planned in [`roadmap.md`](roadmap.md) (non-binding); the core is
  trait-only, continuous, energy-driven selection per the spec.
- Test runner: **Vitest** (`npm test`), established by prompt 002.
- **Reproduction is asexual** for the first version (single parent + mutation);
  sexual crossover and its toggle are deferred.
- Tuning constants (`MAX_POPULATION`, `MAX_AGE`, food energy, mutation scaling,
  `DEFAULT_PARAMETERS`, …) live in `src/core/` and proved **stable without tuning**
  — default runs hold ~200–500 agents over 20k+ ticks, no extinction or explosion.

## In progress / next

- **Phase 1 — deterministic core: complete** (prompts 002–012, all green).
- **Next: Phase 2 — worker boundary.** Author and run prompts for the Web Worker
  wrapper, message protocol, and transferable snapshot buffers against the
  `Simulation` API. See [`roadmap.md`](roadmap.md).

## Prompts run

- `001_setup` — Vite + TypeScript scaffold (bootstrap; verified).
- `002`–`012` — the deterministic core, in order (RNG → params/genome → world →
  grid → mutation → energy → food → behaviour → bounds → loop → stability test).
