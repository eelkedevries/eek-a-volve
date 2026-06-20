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
  population bounds (ceiling, near-extinction, optional immigration), predation,
  speciation (cosmetic labels), catastrophes, and the fixed-timestep `Simulation`
  loop.
- **Worker boundary (`src/worker/`)** — the simulation runs in a Web Worker
  behind a typed message protocol; compact snapshots are posted via two
  transferable ping-pong buffers (no `SharedArrayBuffer`).
- **Rendering (`src/render/`)** — PixiJS v8 `ParticleContainer` drawing agents
  from snapshots, coloured by species. (Food is not yet in the snapshot, so it
  is not drawn.)
- **UI (`src/ui/`)** — pre-start setup form, runtime controls (speed/pause/reset),
  live population chart, toasts, and the narrator panel.
- **Humour + narrator (`src/humour/`, `src/narrator/`)** — mock-Latin binomials,
  milestone/extinction lines, and the optional OpenRouter narrator with a
  templated fallback (key stored in-browser; never committed).

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

- **Phases 1–7 complete** — prompts 001–024 run; deployed live at
  `https://eelkedevries.github.io/eek-a-volve/`.
- **Phases 8–13 — "fun & legibility" overhaul complete.** Prompts **025–042**
  all run and pushed to `main`. Behaviour is now *recognisable* (eat/hunt/flee/
  mate/birth/death cues) and creatures *relatable* (genome-driven bodies, eyes,
  maws, faces, names, emotes, adopt/follow, auto-director, hall of fame), with a
  community/swarm mode toggle, a legend + onboarding, accessibility (colour-blind
  palettes, reduced-motion, quality/scale control), and synthesised sound.
  - **Outcomes vs. watch points:** the 012 stability test stayed green; sexual
    reproduction shipped **default-off** (robust) with viable opt-in presets;
    determinism preserved; the snapshot stayed append-only (diet/sense appended
    for render cues); the detail layer is bounded and degrades to the haze.

## Prompts run

- `001_setup` — Vite + TypeScript scaffold (bootstrap; verified).
- `002`–`012` — deterministic core (RNG → params/genome → world → grid → mutation
  → energy → food → behaviour → bounds → loop → stability test).
- `013`–`015` — render snapshot, Web Worker + protocol, PixiJS renderer.
- `016`–`018` — setup screen, runtime controls, chart + toasts.
- `019`–`021` — predation, speciation, catastrophes.
- `022`–`024` — names + milestones, narrator, deployment readiness.
- `025`–`029` — stable creature identity + action/state, expanded append-only
  snapshot, life stages, sexual reproduction (default-off), carrion scavenging.
- `030`–`035` — community/swarm view modes, detailed creature renderer,
  camera + LOD + selection, behaviour FX, emotes + elder crown, visual juice.
- `036`–`042` — event feed + obituaries + personal names, creature inspector +
  adopt, auto-director, records/hall of fame, legend + onboarding, accessibility
  + quality controls, synthesised sound.
