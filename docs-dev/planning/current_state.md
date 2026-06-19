# Current state

Living, high-level orientation for the project: what exists now, key architectural decisions, and what is in progress. Read it at the start of a session to orient quickly.

Update it only for genuinely useful orientation — a new system, an architectural decision — not after routine commits. A stale or bloated state file is worse than none.

This file records what *is* (current reality). The binding design canon is `docs-dev/reference/primary_authoritative/`; when the two conflict, the canon wins and the gap is work still to be done.

## Systems

- **Project scaffold** — Vite + TypeScript static site (Vite 8 / TS 6), base path
  `/eek-a-volve/`, reproducible install via committed `package-lock.json`. Builds
  with `npm run build`. No simulation code yet (default Vite demo page).

## Key decisions

- Follow the eek-a-dev workflow: commit-to-`main`, one commit per prompt; the
  binding design is `reference/primary_authoritative/specification.md`.
- Sequencing is planned in [`roadmap.md`](roadmap.md) (non-binding); the core is
  trait-only, continuous, energy-driven selection per the spec.
- Test runner: **Vitest** (`npm test`), established by prompt 002.

## In progress / next

- **Phase 1 — deterministic core.** Prompts **002–012 are authored** in
  `../agent/prompts/`. Next action: run **002** (seeded `mulberry32` RNG +
  determinism test, which also sets up the Vitest harness). See
  [`roadmap.md`](roadmap.md).

## Prompts run

- `001_setup` — Vite + TypeScript scaffold (satisfied by the bootstrap commit; verified).
