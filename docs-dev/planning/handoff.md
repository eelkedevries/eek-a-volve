# eek-a-volve — hand-off for Claude Code

Status: non-binding planning and orientation. The binding canon remains
`docs-dev/reference/primary_authoritative/specification.md` (currently v0.3.0); where this
hand-off and the specification disagree, the specification wins and the gap is work still to
be done. Suggested location in the repository: `docs-dev/planning/handoff.md`.

This document supersedes the assumptions in any earlier external planning note: an earlier
draft assumed specification v0.1.0 with several open questions. Those questions are now
resolved (see section 3), and the project is far more advanced than that draft implied.

---

## 1. Purpose

Orient Claude Code to the current state of eek-a-volve and define the remaining work for the
next phase, so that the next prompts can be authored and run without re-deriving facts that
are already settled in the code and the specification. It records what is done, the
constraints that must not be broken, the work that is deliberately out of scope, and the
genuine remaining options ranked by value.

It does not replace the project's own process. Continue to follow `AGENTS.md` and the guides
under `docs-dev/agent/` (`how_to_use.md`, `prompt_authoring_guide.md`,
`prompt_execution_guide.md`, `prompt_iteration_guide.md`).

## 2. How to use this with the existing workflow

- Treat `specification.md` as ground truth. If any task here would conflict with it, stop and
  flag it rather than proceeding.
- Author prompts in `docs-dev/agent/prompts/`, continuing the numbering from the last file
  (042); the next is `043`. Use the required prompt structure from `prompt_authoring_guide.md`
  (Task, Goal, Scope, Context, Required changes, Do not implement, Acceptance criteria,
  Checks, Commit and push, Final report).
- For a multi-feature goal, first propose the numbered prompt sequence and obtain approval
  before running any prompt. Do not pre-author the whole sequence as a fait accompli.
- Run prompts per `prompt_execution_guide.md`: clean tree on `main`, make only that change,
  run the verify command and the prompt's checks, then one commit per prompt using the exact
  prompt filename as the message, and push.
- Verify command: `npm run build`. Tests: `npm test` (Vitest), required for `core/` only;
  rendering and UI need not be unit-tested.
- When a prompt changes a design decision or a domain rule, update `specification.md` and bump
  its version, and update `docs-dev/planning/current_state.md` if a new system or key decision
  is introduced. British English in comments, docs, and user-facing text. No secrets in the
  repository; `docs-dev/` must never reach `dist/`.

## 3. Current state (June 2026)

Specification is at v0.3.0. Prompts 001–042 have been run and pushed to `main`; the site is
deployed at `https://eelkedevries.github.io/eek-a-volve/`. The project is, in practice,
feature-complete for the great majority of the previously catalogued "fun and legibility"
elements:

- Deterministic headless core in `src/core/`: seeded `mulberry32` RNG, parameters and genome
  trait definitions, structure-of-arrays world with object pools, uniform spatial grid, genome
  inheritance and mutation (with flagged freak mutations), energy/metabolism/death, food
  regeneration, the trait-driven behaviour policy, population bounds, predation, speciation,
  life stages (juvenile/adult/elder), carrion scavenging, catastrophes, sexual reproduction
  (default-off), records, snapshots, stable identity, and the fixed-timestep loop. Tests are
  green.
- Worker boundary in `src/worker/`: simulation in a Web Worker behind a typed message
  protocol; compact snapshots posted via two transferable ping-pong buffers; no
  `SharedArrayBuffer`.
- Rendering in `src/render/`: PixiJS v8 `ParticleContainer`, a detailed creature renderer
  (genome-driven bodies, eyes, maws, scale, energy fade), camera with level-of-detail and
  selection, behaviour effects, emotes and an elder crown, and visual juice.
- UI in `src/ui/`: pre-start setup form, runtime controls (speed, pause, reset), live charts,
  toasts, an event feed with obituaries, a creature inspector with adopt/follow, a records and
  hall-of-fame panel, a legend, and onboarding; colour-blind-safe palettes, reduced-motion,
  and a quality/scale control.
- Humour and narrator: mock-Latin binomials and milestone lines; an optional OpenRouter
  narrator with a templated fallback and a snapshot summariser.

## 4. Resolved facts (do not re-derive)

- Reproduction model. Both modes exist; a `sexualReproduction` parameter selects them. Sexual
  reproduction uses uniform genome crossover with compatibility by genetic distance and shared
  parental energy cost; the default is asexual budding. Recombination is therefore already
  supported.
- Determinism. Fixed timestep with an accumulator; `mulberry32` drives every stochastic
  decision; identical seed and parameters reproduce a run exactly. The unseeded platform
  random source is never used on the simulation path.
- Genome. Fixed-length real-valued traits: `size`, `speed`, `senseRadius`,
  `metabolicEfficiency`, `diet`, `colourHue`, stored column-wise. World state is a
  structure-of-arrays with pooled agent and food slots; nothing on the per-tick path
  allocates.
- Snapshot. Append-only by convention: header offsets and per-agent record offsets are stable,
  and new fields are appended so existing consumers keep working (see `src/core/snapshot.ts`).
  Any new visualised quantity must be appended, not inserted.
- Colour channel. Hue encodes species; role and state ride on shape and fixed-colour features
  (maw, eyes, crown, emotes) and on energy-driven body fade, so there is no contention for the
  hue channel. A new "colour by trait" view would be an additional mode, not a change to the
  species encoding.
- Module layout. `core/`, `worker/`, `render/`, `ui/`, `narrator/`, `humour/`, `main.ts`, as
  described in the specification.

## 5. Hard constraints to respect

These are locked decisions in the specification. Do not violate them; changing any of them is
a specification change (update the document and bump the version), not a feature prompt.

- The core is trait-only, continuous, energy-driven natural selection. There is no explicit
  fitness function and there are no generation boundaries. Learned neural-network brains and
  NEAT are deferred and are not on the critical path.
- After start, the only controls are the time multiplier and pause. Parameters are
  configurable before start only.
- Rendering is PixiJS v8 with a `ParticleContainer`; simulation runs in a Web Worker; the two
  communicate by transferable typed arrays. `SharedArrayBuffer` is not used. The rendering
  baseline is WebGL2, with WebGPU as an automatic upgrade via PixiJS, and no WebGPU-specific
  code.
- Target platforms are desktop Chrome, Firefox, and Safari (macOS only for Safari). Mobile and
  iOS/iPadOS are out of scope.
- Population must be bounded both by carrying capacity and by a hard ceiling; neither
  extinction nor unbounded growth may be possible. Near-extinction is surfaced as a visible
  event, not a frozen screen.
- British English in all prose and user-facing text; standard identifier casing in code. The
  repository is public: no secret, token, or `.env` file is ever committed, and `docs-dev/`
  never reaches the build output.
- The narrator must not invent statistics absent from the supplied snapshot.

## 6. Do not build (excluded by the current design)

A class of commonly suggested features is deliberately out of scope because it contradicts the
"observe-only after start" and "configure before start only" decisions. Do not propose these
as enhancements unless the user first decides to revise the specification:

- Interventionist god tools: dropping or painting food, killing, smiting, or dragging
  creatures after start.
- A genome editor or nursery, cloning, or injecting designed species.
- A manual catastrophe trigger (catastrophes exist, but as automatic events behind the
  toggle).
- A truly zero-configuration auto-running start (the pre-start setup screen with defaults is
  the chosen onboarding).

Observation tools that do not alter the simulation — adopt, follow, inspect, camera — already
exist and are consistent with the design.

## 7. Remaining work, ranked by value

Each item below is a genuine gap that is compatible with the locked decisions. "Spec change"
indicates that implementing the item alters a domain rule or data schema and therefore
requires updating `specification.md` and bumping its version as part of the work. "Files
(approximate)" is indicative, to be confirmed when the prompt is authored.

1. Pheromone or signal field (highest value).
   - What: a decaying, diffusing scalar field on a coarse grid that creatures can emit into and
     sense, plus a behaviour-policy response to it. Start minimal: a single channel, emission
     tied to a state or a new trait, decay and diffusion in the worker, and one behavioural use
     (for example, following a trail toward food or away from a threat).
   - Why: it is the largest missing source of emergent behaviour — trails, pack effects, and,
     later, signalling and deception — and it deepens the simulation without a learned brain.
   - Files (approximate): a new `core/` module (for example `core/signals.ts`), with hooks in
     `core/behaviour.ts`, `core/world.ts`, and `core/loop.ts`; `core/snapshot.ts` only if the
     field is visualised (append-only); tests in `core/`. A trail/heatmap overlay in `render/`
     and mimicry/deception in behaviour are separate, later prompts.
   - Spec change: yes (a new domain rule, and a new trait if emission is genetic). Cost is
     per-tick diffusion; keep the grid coarse and respect the performance budget.

2. Phylogenetic or lineage view.
   - What: track parent-to-offspring links and render an ancestry or clade-over-time view. The
     project already has stable identity (`core/identity.ts`) and emergent species labels
     (`core/speciation.ts`); this adds genealogy and its visualisation.
   - Why: the most-praised "see evolution happen" view in the reference survey; speciation
     labels alone do not convey descent.
   - Files (approximate): parent/lineage tracking in `core/` (extend identity and the birth
     path), exposed via the append-only snapshot or the event stream; a tree view in `ui/`.
   - Spec change: minor (record lineage identifiers in the data schema). Prune or aggregate so
     the structure does not grow without bound in multi-day runs.

3. Export and import of seed, parameters, and optionally genomes.
   - What: serialise the pre-start parameter object and seed (and optionally a set of pinned
     genomes) to a shareable string or file, and reload from it. This is the specification's
     own intended route to persistence.
   - Why: highest growth and shareability lever; determinism already guarantees that a shared
     seed reproduces a run. It does not violate the observe-only rule because it concerns
     pre-start configuration.
   - Files (approximate): controls in `ui/`, serialisation alongside `core/params.ts` or in a
     small new serialiser; `worker/protocol.ts` if genomes are included.
   - Spec change: no (already sanctioned under Locked decisions). A shared seed reproduces
     world state, not narrator text.

4. Spatial niches or biomes.
   - What: spatial heterogeneity in resources or conditions (for example regions of differing
     food regeneration), to create geographic structure.
   - Why: drives allopatric speciation and is a direct defence against monoculture, which is a
     known failure mode of open-ended evolution.
   - Files (approximate): `core/food.ts` and `core/world.ts` (spatial resource fields),
     behaviour as needed; terrain rendering in `render/`; optional per-zone statistics and
     seasonal visuals as follow-ups.
   - Spec change: yes (a domain rule and likely a parameter).

5. Preference-driven sexual selection (ornamentation).
   - What: extend mate choice from compatibility-by-similarity to include preference traits, so
     that display traits can be selected for.
   - Why: produces ornamentation and sustains diversity; crossover already exists, so this is
     an incremental domain extension.
   - Files (approximate): `core/genome.ts` (preference and display traits), the sexual
     reproduction and mate-selection path, behaviour; tests in `core/`.
   - Spec change: yes (reproduction domain rule and genome schema).

6. Lower-value polish (no spec change; render/UI only).
   - A genetic-diversity chart and trait-distribution histograms (trait means are already
     charted); a minimap; optional "colour by trait" view modes; audio reactivity to
     population state; multiple plant resource types; a per-genome evolvable mutation rate
     (this last one is a small core change with a small spec note). Time-lapse or clip export
     is a client-side capture feature in `render/`/`ui/` with no spec impact.

## 8. Recommended sequencing and immediate next action

Author and run, in order, after approval of the sequence: (1) the pheromone field, (2) the
lineage view, (3) seed export/import, then (4) biomes and (5) sexual selection as larger
domain extensions, with the section 6 polish interleaved as small prompts where convenient.
The pheromone field is first because it yields the largest gain in emergent behaviour and
several later items (the overlay, mimicry) build on it.

Immediate next action: propose the numbered prompt sequence for approval, then author
`043_pheromone_field.md`. A draft of that first prompt is provided in the appendix as a
starting point; treat it as a proposal to be reviewed, not a finished decision, and confirm
the design choices (single versus multiple channels, what triggers emission, the behavioural
response) before running it.

## 9. Housekeeping

- `docs-dev/planning/current_state.md` is internally inconsistent: its "Key decisions" section
  still states that reproduction is asexual and that sexual crossover is deferred, while the
  same file's "In progress / next" section and specification v0.3.0 record that sexual
  reproduction shipped (default-off). Correct the stale bullet so the orientation document is
  consistent.
- When the pheromone field, biomes, or sexual selection are implemented, bump the
  specification version and record the new domain rules and any new traits in Data schemas and
  Domain rules.

---

## Appendix — proposed prompt `043_pheromone_field.md` (draft for approval)

The following follows the repository's required prompt structure. It is intentionally narrow:
a minimal, single-channel field with one behavioural use. It defers the overlay, deception, and
multi-channel signalling to later prompts. Review and adjust the design choices before running.

```markdown
# Task: pheromone field (minimal, single channel)

## Goal
Add a single decaying, diffusing pheromone field that creatures emit into and sense, with one
behavioural response, keeping the simulation deterministic and the per-tick path allocation-free.

## Scope
Implement only the minimal single-channel field and one behavioural use described below. Do not
implement multiple channels, signal deception or mimicry, a render overlay, or any post-start
control.

## Context
Core conventions: deterministic fixed-timestep loop, seeded mulberry32 RNG, structure-of-arrays
world with object pools, uniform spatial grid for neighbour queries. The snapshot is append-only
(`src/core/snapshot.ts`). The binding canon is
`docs-dev/reference/primary_authoritative/specification.md`; this prompt adds a domain rule and so
must be accompanied by a specification update and a version bump.

## Required changes
1. Add a coarse scalar pheromone grid to the world (a typed array sized from world dimensions and
   a configurable cell size), allocated once at init and reused; no per-tick allocation.
2. Each tick, decay the field by a configurable factor and apply a simple diffusion step to
   neighbouring cells, using only the seeded RNG where any stochasticity is involved.
3. Emission: creatures deposit into the cell at their position under a defined condition (for the
   minimal version, when eating). Make the deposit amount a configurable constant.
4. Sensing and behaviour: extend the behaviour policy so that, when no food is directly sensed
   within `senseRadius`, a creature biases its movement up the local pheromone gradient. Keep the
   existing seek/flee/eat/reproduce policy otherwise unchanged.
5. Add the relevant constants to the existing core configuration, and add the new parameters to
   the pre-start parameter object if they are to be user-configurable.
6. Update `specification.md` (Data schemas and Domain rules) to record the field and bump the
   version. Update `current_state.md` to note the new system.

## Do not implement
Do not implement:
- multiple pheromone channels, alarm signalling, or deception/mimicry;
- a render overlay or heatmap (a later prompt);
- any post-start control or god tool;
- a genetic emission trait (emission is condition-based in this minimal version).

## Acceptance criteria
The task is complete when:
- the field decays and diffuses deterministically, and a fixed seed and parameters reproduce a
  run exactly (determinism test passes);
- with emission and gradient-following enabled, a headless run shows creatures aggregating along
  deposited trails more than with the feature disabled, demonstrated by a test or a logged
  metric;
- the population-stability test remains green (no extinction or unbounded growth on the default
  run);
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks
Run `npm test` and `npm run build`. Add core tests for decay/diffusion determinism and for the
gradient-following effect.

## Commit and push
If and only if the scope was followed and checks pass, create one commit on `main` using this
file's exact filename as the commit message, then push.

## Final report
End with the required five-section final report specified in `AGENTS.md`.
```
