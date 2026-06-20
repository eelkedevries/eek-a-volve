# eek-a-volve — specification

Version: 0.3.0
Last updated: 2026-06-20

Binding design canon. When the code and this document conflict, this document is correct. Empty or stubbed items mean "not yet decided" and impose no constraint. This document is intended for `docs-dev/reference/primary_authoritative/specification.md`.

## Scope

eek-a-volve is a browser-based evolution simulator that runs entirely client-side on a static GitHub Pages site. It is an agent-based ecosystem in which creatures carry an evolvable, real-valued trait genome and undergo continuous natural selection driven by an energy budget. It is deliberately light in tone: procedural names, rare freak mutations, optional catastrophe events, and an optional narrator give it a playful surface over an honest simulation.

The user configures parameters before starting. After starting, the only control is the passage of time (a speed multiplier and pause). The simulation is intended to run unattended for a long time so that adaptation can be observed.

Target platforms are desktop browsers on Windows, Linux, and macOS: current Chrome and Firefox on all three, and Safari on macOS. On macOS, Chrome runs on Blink and Firefox on Gecko (full desktop engines); the WebKit-only constraint applies to iOS and iPadOS, which are not targets. The rendering baseline is WebGL2, which is available across all target browsers; WebGPU is used as an automatic upgrade where the browser provides it, via the rendering library, with no WebGPU-specific code in the project.

Long unattended runs ("for days") are supported on desktop, subject to the ordinary constraint that the machine must not sleep. Operating-system sleep suspends everything; background-tab throttling of timers and animation frames is mitigated by running the simulation in a Web Worker. Mobile platforms are explicitly out of scope, so no mobile memory ceiling or WebKit-specific handling is required.

Out of scope for the first version, recorded here as decisions rather than omissions: learned neural-network brains, topology-evolving neuroevolution (NEAT), WebAssembly or GPU-compute simulation cores, OffscreenCanvas rendering, a server-side narrator proxy, and cross-reload persistence. Each is a candidate later enhancement (see Locked decisions).

## Architecture

The implementation language is TypeScript, built with Vite, and deployed to GitHub Pages from the same repository via `actions/deploy-pages` using the built-in token (no personal access token). The build output directory is `dist/` and the Pages base path is `/eek-a-volve/`.

The hard architectural boundary is between a simulation Web Worker and the main-thread renderer and user interface. The worker owns all simulation state and runs the fixed-timestep loop. The main thread renders and handles input.

Rendering uses PixiJS v8. Agents and food are drawn through a `ParticleContainer`, which batches large numbers of lightweight, same-texture sprites and is the mechanism that makes large populations tractable to render. PixiJS selects WebGPU automatically where available and falls back to WebGL2.

Communication between worker and main thread uses transferable typed arrays, not structured object graphs, to avoid per-frame allocation and garbage-collection pressure. At render cadence, not simulation cadence, the worker posts a snapshot buffer; two buffers are ping-ponged between the threads so neither allocates each frame. `SharedArrayBuffer` is not used, because the required cross-origin isolation response headers (COOP and COEP) cannot be set on GitHub Pages.

The simulation runs on a fixed timestep with an accumulator; rendering interpolates between states. The post-start time multiplier is expressed as simulation ticks per rendered frame: values below one run a tick every few frames, values above one run several ticks per frame, subject to a hard cap on ticks per frame so that a slow machine cannot enter a death spiral. Because simulation is decoupled from the animation frame, the rendered frame rate stays smooth while simulated time scales.

Module layout under `src/`:

- `core/` — pure, headless, deterministic; no DOM and no PixiJS. Contains the seeded random-number generator, the uniform spatial grid, the genome and mutation logic, the structure-of-arrays world state with object pools, the energy and behaviour rules, the event system, species clustering, and the fixed-timestep loop.
- `worker/` — wraps `core/`, defines the message protocol, and serialises snapshots.
- `render/` — PixiJS application, the `ParticleContainer`, species colouring, and overlays.
- `ui/` — the pre-start setup screen, runtime controls (time multiplier, pause, reset), live charts, and toast messages.
- `narrator/` — snapshot summariser, OpenRouter client, and the templated fallback.
- `humour/` — name and binomial generators and milestone rules.
- `main.ts` — wiring, the render loop, and the worker handshake.

Internal development material lives in `docs-dev/` and must never reach `dist/`; `scripts/check-public-build.sh` enforces this. The repository is public, so no secret, token, or `.env` file is ever committed.

## Data schemas

The genome is a fixed-length array of real-valued, clamped traits, one array per agent, stored column-wise across the population in typed arrays. Minimal trait set:

- `size` — influences energy capacity, the predation outcome, and movement cost.
- `speed` — movement rate; higher speed increases per-tick energy cost.
- `senseRadius` — detection range for food, threats, and mates.
- `metabolicEfficiency` — scales baseline energy drain per tick.
- `diet` — herbivore-to-carnivore tendency on a continuous scale; governs the predation branch.
- `colourHue` — cosmetic, and a cheap visual proxy for lineage.

World state uses a structure-of-arrays layout: parallel typed arrays for position (x, y), velocity or heading, current energy, age, genome traits, and species identifier, indexed by a stable agent slot. Agent and food slots are drawn from pre-allocated pools and reused on death and birth; nothing on the per-tick path allocates.

The render snapshot is a compact typed array carrying, per visible agent, position, a species colour index, and a scale, plus a small fixed-size header block of aggregate statistics (population total, births and deaths since the previous snapshot, species count, mean of each trait, current tick). The narrator consumes a textual summary derived from the same aggregates.

The pre-start parameter set is a single serialisable object: initial population, world dimensions, random seed, food abundance, food regeneration rate, starting energy, baseline metabolism cost, reproduction threshold, mutation rate, mutation magnitude, predation toggle, starting species count, catastrophe toggle, and the time-multiplier bounds. A run is fully reproducible from this object together with the seed, given the fixed timestep.

## Domain rules

These are the binding simulation laws. They are fixed during a run; only the time multiplier and pause change after start.

Energy budget. Each tick subtracts a baseline metabolic drain scaled by `size`, `speed`, and `metabolicEfficiency`. Eating food adds energy. An agent dies when its energy reaches zero or when it exceeds a maximum age. Selection is therefore implicit and continuous: there is no explicit fitness function and there are no generation boundaries.

Behaviour. A hand-coded policy parameterised by the agent's traits, not a learned controller: move toward the nearest food within `senseRadius`; if a larger, more carnivorous agent is within range, flee; if energy exceeds the reproduction threshold and a compatible neighbour is present, reproduce sexually, or asexually if the configuration selects it.

Reproduction and mutation. Reproduction requires crossing the energy threshold and pays an energy cost shared with the offspring. Offspring traits are inherited and then perturbed: each trait mutates with the configured probability by a Gaussian step of the configured magnitude, after which all traits are clamped to valid ranges to prevent the propagation of invalid values.

Life stages (v0.2.0). Creatures pass through stages derived from age — juvenile, adult, elder. Only mature creatures (adult or elder) reproduce, so a creature must survive to maturity before it can breed; juveniles are rendered smaller.

Reproduction mode (v0.3.0). A `sexualReproduction` parameter selects the mode. In sexual mode, two ready, compatible (low genetic distance), mature adults that meet produce one offspring by uniform genome crossover followed by the usual mutation; both parents pay an energy cost. In asexual mode, a single mature adult buds a mutated offspring. The shipped default is asexual, which is robust across world densities; sexual reproduction is an opt-in that thrives in denser populations (e.g. the community view) where adults readily meet. The founding population is seeded with varied ages so it is not uniformly juvenile at the start.

Predation. When enabled, a sufficiently carnivorous agent that is larger than a neighbour may consume it for energy. The expected population signature, when predators and prey coexist, is lagged, noisy oscillation reminiscent of Lotka-Volterra. The Lotka-Volterra equations are a reference for expected behaviour only and are never used as the engine.

Population bounds. Food regenerates at the configured rate up to a carrying capacity, which is the dominant control on population. A hard population ceiling is also enforced. Both bounds are mandatory: without them an agent-based ecosystem is bimodal and tends either to extinction or to unbounded growth, and both outcomes must be impossible. Near-extinction is detected and surfaced as a visible event rather than a frozen screen; an optional trickle of immigrants may be configured.

Speciation. Agents are clustered by genetic distance above a threshold and assigned species labels and colours for display and narration. The clustering is emergent, not imposed.

Determinism. A seeded generator (mulberry32) drives every stochastic decision. With the fixed timestep, identical seed and parameters reproduce a run exactly. The unseeded platform random source is never used on the simulation path.

Events. Optional, behind the catastrophe toggle: discrete disturbances such as a meteor strike, a plague, an ice age, or a food drought. Rare freak mutations apply an out-of-distribution trait value with low probability; they are legitimate variation and are flagged for display and narration.

## Naming and voice

All prose, comments, and user-facing text use British English. Code identifiers follow ordinary programming conventions (for example, standard library casing) regardless of the British-English text rule.

Creature and species names are generated procedurally, with mock-Latin binomials derived from dominant traits (for example, a large, slow lineage might be rendered as a *Rotundus* form). Naming is tied to mechanics where cheap to do so, so that a name is a window onto something real in the simulation.

The humour register is wry and affectionate, never mean. The optional narrator adopts the tone of a wildlife-documentary presenter with slightly too much energy: short, observational, occasionally awed, and willing to use the creatures' silly names. Milestone and extinction messages use the same restrained comedic voice. The narrator must not invent statistics that are absent from the supplied snapshot.

## Locked decisions

- The core uses trait-only, continuous, energy-driven natural selection. Learned neural-network brains are deferred to a later enhancement and are the first stretch goal once the core is stable. NEAT is a distant follow-on, not on the critical path.
- Rendering uses PixiJS v8 with a `ParticleContainer`; simulation runs in a Web Worker; the two communicate by transferable typed arrays. `SharedArrayBuffer` is not used.
- The rendering baseline is WebGL2, with WebGPU as an automatic upgrade via PixiJS. No WebGPU-specific code is written.
- Target platforms are desktop browsers on Windows, Linux, and macOS. Mobile and iOS or iPadOS are out of scope. Long unattended runs are a desktop capability, contingent on the machine not sleeping.
- Parameters are configurable before start only. After start, only the time multiplier and pause are adjustable.
- The optional narrator uses OpenRouter with a user-supplied key stored in the browser; no key is embedded or committed. Narrator calls are rate-limited and non-blocking, and the feature degrades to templated lines when no key is present or a call fails. A default low-cost model is used, and the model is user-configurable.
- Cross-reload persistence is out of scope for the first version. Because a run is reproducible from seed and parameters, an export and import of seed, parameters, and optionally genomes is the intended low-cost route to persistence later.
- The repository is a single public repository. Development material in `docs-dev/` is kept out of the deployed build, and no secrets are committed.
