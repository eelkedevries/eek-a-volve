# Current state

Living, high-level orientation for the project: what exists now, key architectural decisions, and what is in progress. Read it at the start of a session to orient quickly.

Update it only for genuinely useful orientation — a new system, an architectural decision — not after routine commits. A stale or bloated state file is worse than none.

This file records what *is* (current reality). The binding design canon is `docs-dev/reference/primary_authoritative/`; when the two conflict, the canon wins and the gap is work still to be done.

## Systems

- **Project scaffold** — Vite + TypeScript static site (Vite 8 / TS 6), base path
  `/eek-a-volve/`, reproducible install via committed `package-lock.json`.
- **Deterministic core (`src/core/`)** — a complete, headless, tested simulation:
  seeded `mulberry32` RNG, parameters + genome trait definitions, structure-of-
  arrays world with pooled agent/food slots + stable creature identity +
  per-creature parentage and a bounded lineage registry, uniform
  spatial grid, genome inheritance + mutation (+ freak mutations), energy/
  metabolism/death, food regeneration + carrion scavenging, the trait-driven
  behaviour policy (seek/flee/eat/court/reproduce) with a per-tick action/state,
  population bounds (ceiling, near-extinction, optional immigration), predation,
  speciation (cosmetic labels), life stages (juvenile/adult/elder), catastrophes,
  sexual reproduction (uniform crossover, default-off), an optional pheromone
  field (stigmergy: deposit-on-eat, deterministic decay/diffusion, gradient-
  following when no food is sensed; default-off, on in the community preset), an
  optional spatial **fertility field** (biomes: a deterministic, seed-derived map
  that biases where food regenerates; `biomeStrength` 0 = uniform default, on in
  the swarm preset; a faint background tint in the renderer), an optional
  deterministic **seasonal** cycle modulating the food regeneration rate
  (`seasonAmplitude` 0 = off), an append-only render snapshot, a bounded event
  log + records/hall-of-fame, and the fixed-timestep `Simulation` loop.
- **Worker boundary (`src/worker/`)** — the simulation runs in a Web Worker
  behind a typed message protocol; compact snapshots are posted via two
  transferable ping-pong buffers (no `SharedArrayBuffer`); also serves inspect,
  events, and records messages.
- **Rendering (`src/render/`)** — PixiJS v8 with a world container under a
  pan/zoom/fit/follow **camera** and level-of-detail (batched `ParticleContainer`
  haze ↔ detailed creatures, with culling + a detail budget). Detailed creatures
  are genome-driven (body from size, eyes from sense radius, maw from diet,
  energy fade, juvenile scale, oriented by heading); pooled behaviour **effects**
  (eat/hunt/flee/court/birth/death + parent→newborn lineage line), **emotes** +
  elder crown, **visual juice** (squash/flash/trails/capped shake), an
  **auto-director** with screen-space nameplates, and selectable species
  **palettes** (incl. colour-blind-safe). Food is drawn by type (plant/carrion).
- **UI (`src/ui/`)** — a single fit-to-screen **dock** (capped at ≤20% of the
  viewport; its message **log** is the only scrollable element) holding live
  stats, all controls, and the feed. Plus a **creature inspector** with
  adopt/follow, a **hall-of-fame** records popover, a **legend**, first-run
  **onboarding**, and the **setup screen** with Community/Swarm preset cards.
  The inspector also shows a creature's short **ancestry line** (parent ←
  grandparent …) resolved from the lineage registry.
  Controls: speed, pause, reset, director toggle, palette, quality/scale,
  reduce-motion, sound. (The earlier standalone population chart and toasts were
  folded into the dock/log during the single-toolbar consolidation.) The setup
  screen can **copy a share link** (`#w=…`) that encodes the whole parameter set
  and seed; opening such a link prefills the form, reproducing the exact run.
  An evolved **population** can also be **exported** to a file and **imported**
  to resume a run from it (fresh lineage; deterministic onward from the seed).
- **Humour + narrator (`src/humour/`, `src/narrator/`)** — mock-Latin binomials,
  silly individual names, milestone/extinction/obituary lines, and the optional
  OpenRouter narrator with a templated fallback (key stored in-browser; never
  committed).

## Key decisions

- Follow the eek-a-dev workflow: commit-to-`main`, one commit per prompt; the
  binding design is `reference/primary_authoritative/specification.md`.
- Sequencing is planned in [`roadmap.md`](roadmap.md) (non-binding); the core is
  trait-only, continuous, energy-driven selection per the spec.
- Test runner: **Vitest** (`npm test`), established by prompt 002.
- **Reproduction supports both modes**, selected by the `sexualReproduction`
  parameter: asexual budding (default) and sexual reproduction by uniform genome
  crossover with compatibility-by-genetic-distance and shared parental energy
  cost. (Earlier this was asexual-only; sexual shipped default-off in prompt 028.)
  In sexual mode, **sexual selection** is active: a `display` ornament (costly,
  via metabolism) and a `matePreference` drive mate choice within the
  compatibility gate. The genome is now 8 traits (the 6 ecological ones define
  species/compatibility; `display`/`matePreference` are excluded from that gate
  and inert in asexual mode).
- **After start, only the time multiplier and pause change** (spec lock); all
  other parameters are configured pre-start. Observation tools (adopt, follow,
  inspect, camera, director) do not alter the simulation.
- **Optional-capability principle (spec v0.4.0):** large features ship only as
  default-off toggles with the original path as fallback. Capabilities so far:
  **neural brains** (v0.4.1) — an evolvable fixed-topology net drives movement
  when `neuralBrains` is on; the hand-coded policy is the default and fallback.
  **OffscreenCanvas rendering** (v0.4.2, experimental) — `offscreenRender` runs a
  self-contained PixiJS scene in a worker via a transferred OffscreenCanvas, with
  a capability check, a ready-handshake, and automatic fallback to the main-thread
  `Renderer`; effects/overlays/director are simplified in that mode.
  **WASM core** (v0.4.3, experimental, first increment) — `wasmCore` runs the
  per-tick metabolism/reap pass in an AssemblyScript-compiled wasm kernel
  (`src/wasm/`, built by `npm run asbuild`), bit-for-bit identical to the TS pass
  (proven by a full-run equivalence test); capability-gated with automatic TS
  fallback. Heavy passes still run in TS, so it is a verified foundation, not yet
  a perf win.
- Tuning constants (`MAX_POPULATION`, food energy, mutation scaling,
  `DEFAULT_PARAMETERS`, …) live in `src/core/` and proved **stable without tuning**
  — default runs hold within bounds over thousands of ticks, no extinction or
  explosion.

## Recent UI / ops work (post-042, by direct request — not numbered prompts)

- **Single-toolbar UI + responsive layout.** The scattered panels were
  consolidated into one bottom **dock** (stats + controls + log), made to fit the
  viewport with no page scrolling, and the dock capped at ≤20% of the screen.
  Responsive/portrait support (safe-area insets, iOS-zoom prevention) was added at
  the maintainer's request — this goes **beyond the spec's desktop-only target**
  (see spec v0.3.1: responsive UI is now best-effort, desktop remains the tested
  platform).
- **"Primordial lab" visual reskin** applied from a Claude Design hand-off (fonts,
  palette, gradients) — visual only, no architecture change.
- **Deploy fixed to auto-publish.** The Pages deploy workflow was
  `workflow_dispatch`-only (manual); it now also runs `on: push` to `main`, so
  every push redeploys.

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
