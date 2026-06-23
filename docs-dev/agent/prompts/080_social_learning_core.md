# Task: social-learning core (knowledge by copying neighbours)

## Goal

Add a scaffolded second inheritance channel — a per-creature `knowledge` scalar
acquired by copying neighbours, gated by a transmission-fidelity parameter, that
improves foraging (a real energy return) but never bypasses the energy budget and
is lost on death — leaving the default run byte-for-byte unchanged.

## Goal label

This channel is a **[design-abstraction]**, never "emergent": knowledge is copied
at a modeller-set fidelity and confers a designed foraging bonus. Label it so in
the code comments and the specification. It earns no "emergent" claim; that label is
reserved for capacities that recur across seeds with the detector disabled
(see prompt 086).

## Scope

Implement only: the `culture` toggle and its `transmissionFidelity`,
`knowledgeForagingGain`, and optional `knowledgeDecay` parameters; one pre-allocated
per-agent `knowledge` column; a new `src/core/culture.ts` pass that copies a
fraction of the best neighbour's knowledge and applies a foraging return; the
append-only snapshot wiring for a knowledge aggregate; an optional costless
social-learning-propensity trait appended after the existing traits; the
WASM-fallback wiring; and the accompanying tests and specification update. Do not
implement the cumulative ratchet (081), cultural loss below critical N (082),
gene–culture coevolution (083), technology→carrying-capacity (085), language, or
any render/UI cue — these are later prompts.

## Context

The world is a structure-of-arrays in `src/core/world.ts` (the `World` class): each
per-agent column is a pre-allocated typed array indexed by slot, declared in **both**
the default branch and the shared-`ArrayBuffer` (WASM) branch, with its byte offset
in `src/core/worldLayout.ts` (`WorldLayout`, `computeWorldLayout`). Adding a column
means adding a field in both `World` branches and an offset in the layout, **appended**
so existing offsets stay stable (the disease/virulence prompts 074–075 append their
columns the same way). `knowledge` is a real-valued quantity, so a `Float32Array`
column in the 4-byte group. New slots must start with zero knowledge: `spawnAgent`
resets the per-slot scalars, and `spawnRandomAgent` (`src/core/bounds.ts`) seeds
founders/immigrants — ensure both leave `knowledge = 0` (knowledge is **not**
genetic, so it is never inherited at birth; it is acquired only by copying after
birth, and is therefore lost when a creature dies and its slot is recycled).

Foraging energy is added in `src/core/behaviour.ts` via `feed(world, s,
world.foodEnergy[food])` when a creature eats; `feed` (`src/core/energy.ts`) caps at
the size-based capacity. The knowledge return raises the effective energy gained
from food (e.g. a multiplier `1 + knowledgeForagingGain * knowledge`), a real,
budget-respecting payoff — knowledge never creates energy from nothing, it only
improves the yield of food actually eaten.

The new pass is `src/core/culture.ts` — a reused object with a bound visitor,
allocation-free per tick, in the style of `Predation` / the disease pass. When
`params.culture` is on: for each live agent, query its grid neighbours
(`SpatialGrid.query`, `src/core/grid.ts`; a copy radius constant in `core/`), find
the neighbour with the highest `knowledge`, and with probability
`transmissionFidelity` adopt a fraction of that neighbour's knowledge toward it (one
seeded `Rng` draw per copy decision); optionally apply a small per-tick
`knowledgeDecay`. The pass must draw **no** RNG and touch nothing when `culture` is
off, so the RNG stream and the default run are unchanged. Register it in
`Simulation.step` (`src/core/loop.ts`) as its own pass over current positions
(reusing the agent grid as the disease/predation passes do), threading the run's
`Rng`. The foraging return itself is applied in the behaviour/feeding path (so it
affects energy gained that tick); the copy/decay bookkeeping is the culture pass.

The render snapshot (`src/core/snapshot.ts`) is **append-only** (plan §4.5): append
a mean-knowledge field to the header after the existing fields
(`H_FOOD_COUNT`/`HEADER_LENGTH`), shifting nothing, so existing render/UI consumers
keep working. This prompt adds no creature render cue (knowledge legibility, if
wanted, is a later UI prompt) — only the aggregate, so the narrator can later
describe it from real data.

The genome is `src/core/genome.ts`: `TRAITS`, `TRAIT_COUNT`, per-trait indices,
`TRAIT_RANGES`, and `SPECIES_TRAIT_COUNT = COLOUR_HUE + 1 = 6` (the gate loops
`t < SPECIES_TRAIT_COUNT`, so any trait appended after index 5 is automatically
excluded from speciation). If you add the optional social-learning-propensity trait,
append it after the existing traits (taking `TRAIT_COUNT` up by one), with a
`TRAIT_RANGES` entry, so it is excluded from the species-distance gate exactly as
`display`/`matePreference` were (prompt 047); it scales a creature's copy
probability/fraction. It is a learning *propensity*, not stored knowledge, and
carries no metabolic cost here (any cost is out of scope). World columns,
`spawnRandomAgent`, `breed`/`breedSexual` (`src/core/mutation.ts`), and the snapshot
trait means iterate generically from `TRAIT_COUNT`, so appending a trait extends them
without manual offset edits — but the snapshot-offset invariants must still be
asserted (a test, as the sexual-selection prompt did).

The WASM core runs the hot loop when `wasm.canRunBehaviour(params)` is true
(`!params.neuralBrains`, `src/wasm/metabolismCore.ts`); the kernel has no culture
logic and would not advance `knowledge` or apply its foraging return, so when
`params.culture` is on the run must fall back to the TypeScript hot loop (extend
`canRunBehaviour`, and gate the WASM `metabolise`/`behaviourStep` paths, so culture
always runs in TS) — per the WASM-fallback rule; porting culture into the kernel is
out of scope.

Parameters live in `src/core/params.ts`. The binding canon is
`docs-dev/reference/primary_authoritative/specification.md`; this is a new subsystem,
so it must be accompanied by a specification update and a version bump. Background and
rationale (non-binding): `docs-dev/planning/science_integration_plan.md` §4
(cross-cutting rules) and §5, prompt 080.

## Required changes

1. Add to `SimulationParameters` in `src/core/params.ts`: `culture: boolean`,
   `transmissionFidelity` (0..1, the per-copy adoption probability),
   `knowledgeForagingGain` (how much knowledge raises foraging yield), and optional
   `knowledgeDecay` (per-tick loss). Document each as a [design-abstraction]
   capability. Set `culture` to `false` and the others to values inert while off in
   `DEFAULT_PARAMETERS`; do not add them to `COMMUNITY_PRESET` or `SWARM_PRESET`.
2. Add one pre-allocated per-agent `knowledge` column (`Float32Array`) to `World`
   (`src/core/world.ts`) and `WorldLayout`/`computeWorldLayout`
   (`src/core/worldLayout.ts`), appended so existing offsets stay stable, in both the
   default and shared-buffer branches. Ensure a freshly spawned slot starts
   `knowledge = 0` (in `spawnAgent`), and that `spawnRandomAgent` leaves founders/
   immigrants at `knowledge = 0` — knowledge is never inherited and is lost on death.
3. Add `src/core/culture.ts`: a reused, allocation-free pass that, when
   `params.culture` is on, copies a fraction of the best neighbour's `knowledge`
   toward each agent with probability `transmissionFidelity` (one seeded `Rng` draw
   per copy decision) and optionally decays knowledge; and apply the foraging return
   in the behaviour/feeding path so eating yields `1 + knowledgeForagingGain *
   knowledge` times the food energy (budget-respecting). Draw **no** RNG and change
   nothing when `culture` is off.
4. Wire the culture pass into `Simulation.step` (`src/core/loop.ts`) as its own pass
   over current positions, threading the run's `Rng`. Make `canRunBehaviour` in
   `src/wasm/metabolismCore.ts` (and the WASM `metabolise`/`behaviourStep` gate) fall
   back to TypeScript when `params.culture` is on, so `knowledge` and its return are
   always handled by the TS hot loop (WASM-fallback rule). Do not port culture into
   the kernel.
5. Append a mean-knowledge aggregate to the render snapshot header
   (`src/core/snapshot.ts`), after the existing header fields (append-only), and
   confirm the snapshot-offset invariants still hold (a test). Optionally append a
   social-learning-propensity trait to `TRAITS` in `src/core/genome.ts` (after the
   existing traits, with a `TRAIT_RANGES` entry, excluded from the species-distance
   gate) that scales copy probability/fraction; if added, assert the snapshot
   invariants at the new `TRAIT_COUNT` and confirm the inspector shows the extra
   chip.
6. Update `specification.md`: a new Domain rule "Culture (social learning) —
   [design-abstraction]" (a non-genetic `knowledge` scalar copied from neighbours at
   `transmissionFidelity`, improving foraging within the energy budget, lost on
   death; off by default; explicitly a designed channel, not emergent) and Data
   schemas (the `knowledge` column; the `culture` toggle and its parameters; the
   optional social-learning-propensity trait; the appended snapshot field). Bump the
   version (minor bump, ≈0.7.0 — a new subsystem). Update
   `docs-dev/planning/current_state.md` to note the new system.

## Do not implement

Do not implement:
- the cumulative ratchet / fidelity-threshold accumulation (prompt 081);
- cultural loss below a critical population size (prompt 082);
- gene–culture coevolution (prompt 083) or technology→carrying-capacity (prompt 085);
- a genetic "culture genome", language, or any open-ended/unbounded knowledge growth;
- any "emergent" labelling of the knowledge channel;
- a creature render cue or setup-screen control for knowledge (a later UI prompt);
- porting culture into the WASM kernel;
- any default-on behaviour or any post-start control.

## Acceptance criteria

The task is complete when:
- with `culture = false`, a fixed seed and parameters reproduce a run exactly,
  identical to the pre-change core (the determinism test passes), the culture pass
  draws no RNG and advances no `knowledge`, and the population-stability test
  (prompt 012) stays green — the subsystem is inert by default;
- the snapshot-offset invariants still hold with the appended knowledge aggregate
  (and the larger `TRAIT_COUNT`, if the propensity trait is added) — a test asserts
  `HEADER_LENGTH`, `H_FOOD_COUNT`, and `snapshotLength` follow from their
  definitions;
- with `culture = true` and a fixed seed and parameters, the run is exactly
  reproducible (a determinism test in culture mode passes) and the hot loop runs in
  TypeScript;
- a focused core test shows knowledge tracks fidelity: higher `transmissionFidelity`
  yields a higher mean `knowledge`, and knowledge can **fall** (it is not genetic and
  is lost on death) — it is not a one-way upgrade;
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for determinism in culture mode,
for mean knowledge tracking `transmissionFidelity`, for the snapshot-offset
invariants, and confirm the prompt-012 stability test still passes unchanged on the
default path.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`080_social_learning_core.md`) as the
commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
