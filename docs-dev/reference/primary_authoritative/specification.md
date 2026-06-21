# eek-a-volve — specification

Version: 0.4.6
Last updated: 2026-06-21

Binding design canon. When the code and this document conflict, this document is correct. Empty or stubbed items mean "not yet decided" and impose no constraint. This document is intended for `docs-dev/reference/primary_authoritative/specification.md`.

## Scope

eek-a-volve is a browser-based evolution simulator that runs entirely client-side on a static GitHub Pages site. It is an agent-based ecosystem in which creatures carry an evolvable, real-valued trait genome and undergo continuous natural selection driven by an energy budget. It is deliberately light in tone: procedural names, rare freak mutations, optional catastrophe events, and an optional narrator give it a playful surface over an honest simulation.

The user configures parameters before starting. After starting, the only control is the passage of time (a speed multiplier and pause). The simulation is intended to run unattended for a long time so that adaptation can be observed.

Target platforms are desktop browsers on Windows, Linux, and macOS: current Chrome and Firefox on all three, and Safari on macOS. On macOS, Chrome runs on Blink and Firefox on Gecko (full desktop engines); the WebKit-only constraint applies to iOS and iPadOS, which are not targets. The rendering baseline is WebGL2, which is available across all target browsers; WebGPU is used as an automatic upgrade where the browser provides it, via the rendering library, with no WebGPU-specific code in the project.

Long unattended runs ("for days") are supported on desktop, subject to the ordinary constraint that the machine must not sleep. Operating-system sleep suspends everything; background-tab throttling of timers and animation frames is mitigated by running the simulation in a Web Worker. Desktop remains the primary, tested platform. The UI layout is responsive and usable on small and portrait screens as a best-effort enhancement (v0.3.1), but mobile is not a tested target: no mobile memory ceiling or WebKit-specific handling is implemented, and iOS/iPadOS behaviour is unverified.

Large or architectural enhancements — learned neural-network brains, a WebAssembly simulation core, and OffscreenCanvas rendering — are permitted under the optional-capability principle (see Locked decisions): they ship only as default-off toggles with the original hand-coded behaviour, the TypeScript core, and the main-thread PixiJS renderer retained as the default and automatic fallback, and they must not change the default run. Still out of scope for the first version, recorded as decisions rather than omissions: topology-evolving neuroevolution (NEAT) and a server-side narrator proxy.

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
- `display` — an ornament that is metabolically costly to carry; the target of sexual selection in sexual mode (v0.3.6).
- `matePreference` — the ornament level a creature prefers in a mate (v0.3.6).

The first six traits are the species-defining ("ecological") set used for the genetic-distance gate and speciation; `display` and `matePreference` sit after them and are deliberately excluded from that distance.

World state uses a structure-of-arrays layout: parallel typed arrays for position (x, y), velocity or heading, current energy, age, genome traits, species identifier, a stable creature id, and that creature's parent id (0 for founders and immigrants), indexed by a stable agent slot. When the optional neural-brains capability is enabled, a further per-creature weight block (a fixed-size genome of network weights) is allocated; it is absent by default. Agent and food slots are drawn from pre-allocated pools and reused on death and birth; nothing on the per-tick path allocates.

Lineage is tracked for display: alongside the per-creature parent id, a bounded, pre-allocated registry remembers recent `id → parent id` links (a fixed-capacity ring; old links are evicted, never grown). It lets the inspector resolve a creature's short ancestry chain back through ancestors that have since died, and is observational metadata only (v0.3.3).

The render snapshot is a compact typed array carrying, per visible agent, position, a species colour index, and a scale, plus a small fixed-size header block of aggregate statistics (population total, births and deaths since the previous snapshot, species count, mean of each trait, current tick). The narrator consumes a textual summary derived from the same aggregates.

The pre-start parameter set is a single serialisable object: initial population, world dimensions, random seed, food abundance, food regeneration rate, starting energy, baseline metabolism cost, reproduction threshold, mutation rate, mutation magnitude, predation toggle, starting species count, catastrophe toggle, the time-multiplier bounds, the optional pheromone-trail tunables (a toggle plus cell size, decay, diffusion, and deposit amount), a biome strength (0 = uniform food placement), and a seasonal swing (amplitude, 0 = none; and period in ticks). A run is fully reproducible from this object together with the seed, given the fixed timestep.

An optional pheromone field (v0.3.2) is a coarse scalar grid over the world: a single typed array sized from the world dimensions and a configurable cell size, with a reused buffer for the diffusion step. It holds a decaying, diffusing trail signal, is allocated once and reused on the per-tick path, and is not part of the render snapshot.

An optional fertility field (v0.3.5) is a coarse, static map of how favourable each region is for food. It is a pure, deterministic function of position and seed (a sum of low-frequency seeded sinusoids), not a stored buffer, so the worker and the renderer compute the same field independently. Its spatial mean is approximately 0.5, so it shifts where food appears without changing how much.

## Domain rules

These are the binding simulation laws. They are fixed during a run; only the time multiplier and pause change after start.

Energy budget. Each tick subtracts a baseline metabolic drain scaled by `size`, `speed`, and `metabolicEfficiency`. Eating food adds energy. An agent dies when its energy reaches zero or when it exceeds a maximum age. Selection is therefore implicit and continuous: there is no explicit fitness function and there are no generation boundaries.

Behaviour. By default a hand-coded policy parameterised by the agent's traits: move toward the nearest food within `senseRadius`; if a larger, more carnivorous agent is within range, flee; if energy exceeds the reproduction threshold and a compatible neighbour is present, reproduce sexually, or asexually if the configuration selects it. Optionally (the `neuralBrains` capability, default off, v0.4.1), the per-tick movement *heading* is instead produced by a small fixed-topology neural network whose weights are part of the genome and evolve; eating, reproduction, energy, and predation are unchanged. The hand-coded policy is the default and the fallback (optional-capability principle).

Reproduction and mutation. Reproduction requires crossing the energy threshold and pays an energy cost shared with the offspring. Offspring traits are inherited and then perturbed: each trait mutates with the configured probability by a Gaussian step of the configured magnitude, after which all traits are clamped to valid ranges to prevent the propagation of invalid values.

Life stages (v0.2.0). Creatures pass through stages derived from age — juvenile, adult, elder. Only mature creatures (adult or elder) reproduce, so a creature must survive to maturity before it can breed; juveniles are rendered smaller.

Reproduction mode (v0.3.0). A `sexualReproduction` parameter selects the mode. In sexual mode, two ready, compatible (low genetic distance), mature adults that meet produce one offspring by uniform genome crossover followed by the usual mutation; both parents pay an energy cost. In asexual mode, a single mature adult buds a mutated offspring. The shipped default is asexual, which is robust across world densities; sexual reproduction is an opt-in that thrives in denser populations (e.g. the community view) where adults readily meet. The founding population is seeded with varied ages so it is not uniformly juvenile at the start.

Stigmergy (v0.3.2). Optional, behind the pheromones toggle: when a creature eats, it deposits a fixed amount of pheromone into the cell beneath it; each tick the field decays by a configured factor and diffuses toward neighbouring cells, deterministically (no stochastic step, or only the seeded generator). When a creature senses no food within its sense radius, it biases its movement up the local pheromone gradient instead of wandering randomly; the flee, court, seek-food, eat, and reproduce priorities are otherwise unchanged. The field records where feeding has recently happened and never bypasses the energy budget. It is off by default — the default run is unaffected — and enabled in at least one preset.

Sexual selection (v0.3.6). In sexual mode two further traits come into play: a `display` ornament and a `matePreference`. Mate choice still requires ecological compatibility (the genetic-distance gate over the species-defining traits, which excludes these two); but among compatible neighbours a creature is drawn to the one whose display best matches its preference, traded off against proximity. Display carries a metabolic cost, so ornament is honest — favoured by preference yet penalised by the energy budget, which checks runaway. Both traits are inert in asexual mode, where they merely drift, so the default run is unaffected.

Predation. When enabled, a sufficiently carnivorous agent that is larger than a neighbour may consume it for energy. The expected population signature, when predators and prey coexist, is lagged, noisy oscillation reminiscent of Lotka-Volterra. The Lotka-Volterra equations are a reference for expected behaviour only and are never used as the engine.

Population bounds. Food regenerates at the configured rate up to a carrying capacity, which is the dominant control on population. Where food regenerates may be spatially weighted by the optional, deterministic fertility field (v0.3.5): at biome strength 0 placement is uniform (the byte-for-byte default), and as strength rises new food is increasingly biased toward fertile regions, creating spatial niches without changing the total carrying capacity. The regeneration *rate* may also be modulated over time by an optional, deterministic seasonal cycle (v0.3.8): a smooth sinusoid of the configured period and amplitude, off by default (amplitude 0, the byte-for-byte default), so the population must track a slowly moving carrying capacity. A hard population ceiling is also enforced. Both bounds are mandatory: without them an agent-based ecosystem is bimodal and tends either to extinction or to unbounded growth, and both outcomes must be impossible. Near-extinction is detected and surfaced as a visible event rather than a frozen screen; an optional trickle of immigrants may be configured.

Speciation. Agents are clustered by genetic distance above a threshold and assigned species labels and colours for display and narration. The clustering is emergent, not imposed.

Lineage (v0.3.3). Each creature records its single parent's stable id at birth (founders and immigrants record none). The inspector uses this, together with the bounded lineage registry, to show a creature's short ancestry chain by name. Lineage is recorded but never read back into any simulation decision, so it does not affect determinism.

Determinism. A seeded generator (mulberry32) drives every stochastic decision. With the fixed timestep, identical seed and parameters reproduce a run exactly. The unseeded platform random source is never used on the simulation path.

Events. Optional, behind the catastrophe toggle: discrete disturbances such as a meteor strike, a plague, an ice age, or a food drought. Rare freak mutations apply an out-of-distribution trait value with low probability; they are legitimate variation and are flagged for display and narration.

## Naming and voice

All prose, comments, and user-facing text use British English. Code identifiers follow ordinary programming conventions (for example, standard library casing) regardless of the British-English text rule.

Creature and species names are generated procedurally, with mock-Latin binomials derived from dominant traits (for example, a large, slow lineage might be rendered as a *Rotundus* form). Naming is tied to mechanics where cheap to do so, so that a name is a window onto something real in the simulation.

The humour register is wry and affectionate, never mean. The optional narrator adopts the tone of a wildlife-documentary presenter with slightly too much energy: short, observational, occasionally awed, and willing to use the creatures' silly names. Milestone and extinction messages use the same restrained comedic voice. The narrator must not invent statistics that are absent from the supplied snapshot.

## Locked decisions

- **Optional-capability principle (v0.4.0).** Large or architectural enhancements (learned brains, alternative simulation/render cores) are permitted only as optional, default-off capabilities that the user can toggle on and off. The original hand-coded behaviour, the TypeScript simulation core, and the main-thread PixiJS renderer are always retained as the shipped default and the automatic fallback when a capability is off or unsupported. Such a capability must preserve determinism, must leave the default run byte-for-byte unchanged, and must keep the population-stability guarantee on the default path.
- The core uses trait-only, continuous, energy-driven natural selection by default. Learned neural-network brains are available as an optional, default-off capability under the optional-capability principle (an evolvable fixed-topology network drives movement when enabled); the hand-coded policy remains the default and fallback. NEAT (topology evolution) remains a distant follow-on, not on the critical path.
- Alternative performance cores are available as optional, default-off capabilities under the optional-capability principle, each behind a capability check with the default path retained as the automatic fallback. OffscreenCanvas (worker) rendering is implemented (`offscreenRender`, experimental, v0.4.2): a self-contained PixiJS scene (creatures, food, pan/zoom/click camera) runs on a transferred OffscreenCanvas in a worker; it does not reuse the DOM-coupled main-thread `Renderer`, so rich effects, field overlays, emotes, and the auto-director are simplified or absent in that mode, and any init/runtime failure falls back to the main-thread renderer. A WebAssembly simulation core is being introduced incrementally under the same principle (`wasmCore`, experimental, v0.4.3): the per-tick metabolism/reap pass is compiled from AssemblyScript (`src/wasm/metabolism.as.ts`, built by `npm run asbuild`) and is **bit-for-bit identical** to the TypeScript pass (f64 maths, f32 storage, identical operation and side-effect order), so a run with the WASM core matches the default run exactly. It is gated behind a `WebAssembly` capability check and loads the inlined module in the worker; any failure falls back to the TypeScript core. From v0.4.4 the world structure-of-arrays (agent and food columns, free-lists, and a scalar-counts region) lives in a single shared `WebAssembly.Memory` (`src/core/worldLayout.ts`) when the core is on, so the kernels run in place with no per-tick copy. Ported so far: metabolism/reap, carrion decay (v0.4.5), and plant regeneration (v0.4.6). Regeneration is the first RNG pass: the kernel calls the host's seeded RNG through an imported `rngNext`, so it advances the same stream as the surrounding TypeScript passes and stays bit-identical (the seasonal/biome cases stay in TypeScript for now). The heavy passes (behaviour, spatial grid) still run in TypeScript over the same shared memory, so this remains a verified, equivalent foundation rather than a performance win — that needs those passes ported too (planned, prompts 064–067). A GPU-compute core remains out of scope.
- Rendering uses PixiJS v8 with a `ParticleContainer`; simulation runs in a Web Worker; the two communicate by transferable typed arrays. `SharedArrayBuffer` is not used.
- The rendering baseline is WebGL2, with WebGPU as an automatic upgrade via PixiJS. No WebGPU-specific code is written.
- Target (tested) platforms are desktop browsers on Windows, Linux, and macOS. The UI is responsive for small/portrait screens as a best-effort enhancement (v0.3.1); iOS/iPadOS remain untested, with no WebKit-specific or mobile-memory handling. Long unattended runs are a desktop capability, contingent on the machine not sleeping.
- Parameters are configurable before start only. After start, only the time multiplier and pause are adjustable.
- The optional narrator uses OpenRouter with a user-supplied key stored in the browser; no key is embedded or committed. Narrator calls are rate-limited and non-blocking, and the feature degrades to templated lines when no key is present or a call fails. A default low-cost model is used, and the model is user-configurable.
- Cross-reload autosave persistence is out of scope for the first version. Because a run is reproducible from seed and parameters, seed + parameter sharing is implemented as a URL-encoded, validated share link (`#w=…`) that prefills the setup screen (v0.3.4), and the living population (genomes and key state) can be exported to a file and imported to start a run from it (v0.3.7). A resumed run is deterministic from the loaded population and `params.seed`, but is not bit-identical to the original future; imported creatures get fresh ids, so the resumed run has its own lineage.
- The repository is a single public repository. Development material in `docs-dev/` is kept out of the deployed build, and no secrets are committed.
