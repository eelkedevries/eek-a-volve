# Development roadmap

Non-binding planning. The binding design is
[`../reference/primary_authoritative/specification.md`](../reference/primary_authoritative/specification.md);
this roadmap only **sequences** the work and may change as we learn.
[`current_state.md`](current_state.md) tracks where we actually are.

## How this works

- Milestones are grouped into **phases**, ordered by dependency.
- Each milestone lists **planned prompts** — small, one-commit units, each drafted
  and approved just before it is run (not pre-authored here).
- Prompt numbers are **provisional**: the real numbering continues from whatever
  has been run, and a narrow follow-up uses a letter suffix (e.g. `006b`).
- `core/` work carries tests (per `AGENTS.md` testing policy: headless
  determinism and population-stability); rendering and UI need not be unit-tested.
- When a phase settles a constant or rule, record the decision in the
  **specification** and bump its version — not here.

Status legend: ✅ done · ▶️ next · ⬜ planned

---

## Phase 0 — Project foundation ✅

- **001_setup** — default Vite + TypeScript scaffold, base path `/eek-a-volve/`,
  reproducible install (lockfile). _Completed by the bootstrap commit._

## Phase 1 — Deterministic core (headless, tested) ✅

**Complete** — prompts 002–012 run; the headless ecosystem is deterministic and
stable (no extinction or explosion over 20k+ ticks), 54 tests green.

Goal: a headless ecosystem that runs from a seed to a stable population and is
bit-for-bit reproducible. Spec: _Architecture (`core/`)_, _Data schemas_,
_Domain rules_, _Determinism_.

- **002** seeded RNG (`mulberry32`) + determinism test (same seed ⇒ identical sequence); also establishes the Vitest test harness.
- **003** simulation parameter set + trait/genome definitions (trait list, ranges, clamping).
- **004** structure-of-arrays world state + object pools (spawn/kill, slot reuse, no per-tick allocation).
- **005** uniform spatial grid for neighbour queries (food, threats, mates).
- **006** genome inheritance + mutation (Gaussian step, clamp to range, rare freak-mutation flag).
- **007** energy budget + death (metabolic drain by size/speed/efficiency, eating, max age).
- **008** food system: regeneration up to a carrying capacity.
- **009** behaviour policy: seek nearest food, flee larger/carnivorous neighbours, reproduce on threshold.
- **010** population bounds: carrying capacity + hard ceiling + near-extinction detection (+ optional immigrant trickle).
- **011** fixed-timestep tick loop integrating the above (accumulator; hard cap on ticks per frame later).
- **012** population-stability test: long headless run asserts neither extinction nor unbounded growth.

**Test runner:** Vitest (`npm test`), established by prompt 002.

_Prompts for Phases 2–7 are now authored too (013–024); run them in order. Phase
and prompt numbers below are the real, authored numbers._

## Phase 2 — Worker boundary ⬜

Spec: _Architecture (`worker/`)_, _Locked decisions_ (transferable typed arrays,
ping-pong buffers, no `SharedArrayBuffer`).

- worker wrapper + message protocol (init / start / pause / speed / reset).
- snapshot serialisation into a compact transferable typed array — per-agent
  position, species colour index, scale, plus the aggregate header block
  (population, births/deaths, species count, trait means, tick).
- main-thread handshake and buffer ping-pong (no rendering yet; verify via scalars).

## Phase 3 — Rendering (PixiJS v8) ⬜

Spec: _Architecture (`render/`)_, _Locked decisions_ (WebGL2 baseline, WebGPU auto-upgrade).

- PixiJS application + canvas bootstrap.
- `ParticleContainer` for agents and food; interpolate between snapshots.
- species colour mapping + a minimal live stats overlay.

## Phase 4 — User interface ⬜

Spec: _Scope_ (configure before start; after start only speed + pause), _Architecture (`ui/`)_.

- pre-start setup screen (the parameter object rendered as a form).
- runtime controls: time multiplier, pause, reset.
- live charts (population over time, mean traits).
- toast / milestone messages.

## Phase 5 — Advanced simulation rules ⬜

Spec: _Domain rules_ (Predation, Speciation, Events).

- predation branch (diet + size; a larger, carnivorous agent may eat a neighbour) behind its toggle.
- speciation: cluster by genetic distance above a threshold; assign labels + colours.
- catastrophes behind the toggle (meteor, plague, ice age, drought); freak mutations flagged for display.

## Phase 6 — Playful surface ⬜

Spec: _Naming and voice_.

- procedural creature names + mock-Latin binomials derived from dominant traits (`humour/`).
- milestone and extinction lines in the restrained comedic voice.
- optional AI narrator: snapshot summariser + OpenRouter client + templated
  fallback; user-supplied key kept in the browser, rate-limited and non-blocking.

## Phase 7 — Deployment & polish ⬜

- first real GitHub Pages deploy via `deploy-pages.yml` + smoke check (base path,
  console errors, asset 404s).
- performance pass for large populations; verify a long unattended run.

---

## Open questions / decisions to confirm

- ~~**Test runner + command**~~ — resolved: Vitest (`npm test`), established by prompt 002.
- **Trait ranges, energy constants, carrying-capacity tuning** — emerge during
  Phase 1; record the settled values in the specification.
- **Default narrator model** on OpenRouter — choose a low-cost default in Phase 6.
