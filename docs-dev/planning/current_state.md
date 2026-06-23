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
- **UI (`src/ui/`)** — the chrome is a set of `position: fixed` layers over the
  PixiJS canvas (no page scroll). The **toolbar** (`toolbar.ts`) is one attached
  unit pinned to the bottom: a **Log / Windows / Settings** tab strip over the
  active subsection, and an attached **bottom row** with play/pause, the speed
  adjuster, and the live **stats** (Gen/Pop/Species/Ticks). **Log** shows the
  latest two messages (maximise opens the full Story-log window); **Windows** is
  one row of seven buttons (Legend, Records, Charts, Family, Map, Close all, Hide
  UI); **Settings** is one row of six (Director, Sound, Calm, Palette, Quality,
  Reset). The **world** is the area above the toolbar (the live sim); the canvas
  stage is inset to it. A **floating-window manager** (`windowManager.ts`) packs
  up to four uniform, resizable windows over the world **without overlapping** —
  **Small (25%)** = a quarter (two sit side by side), **Medium (50%)** =
  full-width half, **Large (100%)** = the whole world, **Close**; a greedy packer
  honours the chosen sizes when they fit and demotes the largest (oldest) window
  otherwise. Window bodies: Inspector (adopt/follow), Legend, Records, Charts,
  Family, Map (drag recentres the camera, a tap picks the nearest creature →
  Inspector), Story-log, Event-detail. A creature is inspected by tapping it on
  the canvas or via the Map. The story log (`storyLog.ts`) is the shared event
  store behind the Log tab, the Story-log window, and Event-detail. Icons are a
  shared inline-SVG set (`icons.ts`) — no emoji in chrome. **Hide UI** clears the
  chrome behind a single restore button; **Reset** goes through a confirm modal
  back to setup. The **setup screen** has Community/Swarm preset cards, three
  core sliders, four behaviour chips, and a tabbed "advanced soup chemistry"
  panel, all bound to the real `params.ts`; it can **copy a share link** (`#w=…`)
  and **resume** from a saved population file. Shared UI naming lives in
  `docs-dev/reference/ui_vocabulary.md`. (The refresh dropped the old
  overlay-cycle, colour-mode, population-export, and AI-narrator controls from
  the running HUD; palette and quality bind to the real renderer options.)
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
  compatibility gate. The genome is now 9 traits (the 6 ecological ones define
  species/compatibility; `display`/`matePreference` and the disease `resistance`
  trait are excluded from that gate; the sexual two are inert in asexual mode and
  `resistance` is inert when disease is off).
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
  `Renderer`; effects/overlays/director are simplified in that mode. The worker
  sets PixiJS's `WebWorkerAdapter` (no `document` in a worker) and renders
  push-driven (no `requestAnimationFrame` in a worker — render on each frame and
  camera move). Verified rendering headless (Chromium + SwiftShader).
  **WASM core** (v0.4.3–0.5.0, experimental) — `wasmCore` runs the **entire per-tick
  hot loop** in an AssemblyScript-compiled wasm kernel (`src/wasm/`, built by
  `npm run asbuild`) over a shared `WebAssembly.Memory` world SoA (zero-copy):
  metabolism, carrion decay, food regen, mutation, behaviour, and predation — all
  bit-for-bit identical to the TS core (proven by a 300-tick full-run equivalence
  test) and **~1.7× faster**. Capability-gated with automatic TS fallback; the WASM
  behaviour path requires brains off (else it falls back to TS). The RNG is
  host-imported (shared stream). Built across prompts 058/060–067. Internalising
  the RNG (prompt 070) was measured and **declined**: the removable per-draw
  crossings (~156/tick) are a minority versus the irreducible `jsCos`/`jsSin`
  trig crossings (~297/tick), only call-overhead is removable (the maths still
  runs), and moving the stream into WASM would add crossings to the TS-side
  passes — so it cannot clear the prompt's "measurably faster" gate.
- **Science couplings (default-off, reversible)** follow the same optional-capability
  shape and are sequenced in [`science_integration_plan.md`](science_integration_plan.md).
  First landed: an optional **cognition cost** (`cognitionCost`, default 0) that makes
  per-tick metabolic drain scale with `senseRadius`, so perception is bounded by its
  energy payoff rather than free (prompt 072). Then **grouping safety**
  (`groupingSafety`, default 0): a prey amid many conspecifics is caught less
  often, saturating for large groups, so dense grouping dilutes predation risk
  (prompt 073). Then **disease** (`disease`, default off; spec v0.6.0): a minimal
  density-dependent compartmental (SIR/SIS) infection — infected hosts infect
  susceptible grid neighbours via the seeded generator, an `infectionTimer` carries
  them to recovery (immunity SIR / re-susceptibility SIS) or to disease death
  routed through the normal death path, with rate params (`transmissionRate`,
  `recoveryRate`, `diseaseMortality`, `immunityMode`), two appended per-agent
  columns (`infectionState`/`infectionTimer`), and an optional costly host
  `resistance` trait (the genome is now 9 traits; the 6 ecological ones still
  define species, with `display`/`matePreference`/`resistance` excluded from that
  gate). Disease runs TS-only — the WASM hot loop falls back to TypeScript whenever
  disease is on (prompt 074).
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
- **UI / visuals refresh hand-off** — the running HUD chrome was rebuilt from a
  design hand-off into fixed layers over the canvas: a 58px control bar, a
  tabbed toolbar window (Log/Windows/Settings), and a tiling floating-window
  manager (Inspector/Legend/Records/Charts/Family/Map/Story-log/Event-detail),
  plus a redesigned setup screen, an inline-SVG icon set, Hide-UI, and a reset
  confirm modal. Chrome only (`src/ui/*`, `src/style.css`, `src/main.ts`
  wiring); `render/`, `core/`, `worker/`, `wasm/` untouched. Dropped from the
  HUD: overlay-cycle, colour-mode, population-export, and the AI-narrator panel.
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
