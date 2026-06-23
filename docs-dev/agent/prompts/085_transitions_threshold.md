# Task: proto-complexity state at a designed threshold (reversible)

## Goal

Detect a "complexity / proto-civilisation" state at a designed threshold — sustained
high local population density together with mean knowledge above a cutoff — which
raises local resource throughput / carrying capacity (technology→K) but then increases
environmental degradation that lowers local fertility, producing overshoot, decline and
recovery; reversible and non-absorbing by construction, default-off, so the default run
is byte-for-byte unchanged.

## Goal label

This is the **most speculative** tier in the programme and ships **only** as a clearly
labelled **[design-abstraction] / [speculative]** capacity — **never** "emergent". The
state fires at a modeller-set detector, not from open-ended emergence, and it must be
**reversible by construction**: an explicit degradation hazard keeps it non-absorbing so
both collapse and re-emergence are possible. Label it exactly so in the code and the
specification.

## Scope

Implement only: the `transitions` toggle, its threshold and degradation constants, a
per-region detector over existing population/biome/knowledge fields that flips a
local complexity state, and the two-phase local effect (food regeneration up via
"technology", then down via degradation that lowers local fertility), with an explicit
degradation hazard that makes the state non-absorbing; plus the accompanying tests and
specification update. Do not implement a tech tree, named institutions, irreversible
"win" states, the artificial-agents↔civilisation coupling (plan §7), or any render/UI
cue.

## Scope guard

This prompt assumes prompt 080 (`social_learning_core`) has landed, since the detector
reads mean/local `knowledge` (the `knowledge` column and the `culture` toggle), and it
composes with the disease/grouping density couplings (073/074) if present. If 080 has
not landed, stop and flag it — the detector needs a knowledge signal to gate on.

## Context

The detector reads quantities that already exist; it does **not** invent new agent
state. Local population density can be read from the agent spatial grid
(`src/core/grid.ts`, `SpatialGrid`, rebuilt each tick in `src/core/loop.ts`) or from a
coarse region tiling of `world.x/world.y`; mean/local `knowledge` comes from the 080
column; the world already has a coarse, deterministic fertility field
(`fertilityAt`, `src/core/biome.ts`) and a food regeneration pass with a plant carrying
capacity (`src/core/food.ts`: `regenerateFood`, `seedFood`, the `plantCapacity` cap,
`placePlant` with biome rejection sampling). The "technology→K" effect is a *local*
increase in food regeneration / effective carrying capacity where the complexity state
is active; the "degradation" effect is a subsequent *local* reduction in fertility /
regeneration that lowers local fertility and forces overshoot→decline.

Mechanism (a new `core/` pass, or an extension folded into the food-regeneration step,
allocation-free and reused):
- Tile the world into coarse regions (a fixed grid; pre-allocated per-region scalars,
  no per-tick allocation).
- A region enters the complexity state when local density **and** local mean knowledge
  stay above their cutoffs for a sustained window (the "designed threshold").
- While active, the region's food regeneration is raised (technology), but a
  degradation accumulator rises with sustained activity/density and **reduces** local
  fertility/regeneration (lowering local fertility), so the region overshoots its raised
  capacity and declines.
- An explicit **degradation / decay hazard** guarantees the state is **non-absorbing**:
  if degradation (or falling density/knowledge) crosses an exit condition, the region
  leaves the complexity state and recovers, after which it may re-enter. Collapse and
  re-emergence must both be reachable.

This modifies only food regeneration and the local fertility used for placement — it
must not bypass the energy budget, must keep both population bounds intact (the food
carrying capacity and the hard ceiling, specification: Domain rules → Population bounds),
and must never be able to force guaranteed extinction on the default path. Per the
determinism rule, any added stochastic step draws from the run's seeded `Rng` **only**
when `transitions` is on; with the default `transitions` off, no region state is
computed, no regeneration is altered, and the RNG stream and the default run are
byte-for-byte unchanged. The WASM regeneration kernel (`regenerateFood` in
`src/wasm/metabolismCore.ts`) is bit-identical to the TS placement; since region-state
regeneration changes that placement and the kernel has no transitions logic, the run
must fall back to TypeScript food regeneration (and any affected pass) when
`transitions` is on — extend the relevant `wasm`/`canRun…` gating, per the WASM-fallback
rule (plan §4.7). Do not port transitions into the kernel.

Parameters live in `src/core/params.ts`. The binding canon is
`docs-dev/reference/primary_authoritative/specification.md`; this is a new domain rule,
so it must be accompanied by a specification update and a version bump. Background and
rationale (non-binding): `docs-dev/planning/science_integration_plan.md` §1 (the honesty
benchmark and the [design-abstraction] discipline), §4 (cross-cutting rules), §5
(prompt 085), and §7 (what stays out of scope — no agent↔civilisation coupling).

## Required changes

1. Add to `SimulationParameters` in `src/core/params.ts`: `transitions: boolean` plus
   the threshold constants (local density and mean-knowledge cutoffs, the sustained
   window) and the degradation/recovery constants (technology gain, degradation rate,
   the exit/decay hazard). Document them, and label the capacity [design-abstraction] /
   [speculative]. Set `transitions` to `false` (and the constants inert while off) in
   `DEFAULT_PARAMETERS`; do not add them to `COMMUNITY_PRESET` or `SWARM_PRESET`.
2. Add the per-region detector and two-phase local effect (a new `core/` pass or a
   gated extension of the food-regeneration step): regions enter the complexity state at
   the designed threshold, regeneration rises (technology) then degradation lowers local
   fertility; an explicit decay/degradation hazard makes the state **non-absorbing**
   (exit and re-entry both possible). Use pre-allocated per-region scalars
   (allocation-free), keep both population bounds intact, and draw RNG only when
   `transitions` is on. Change nothing when `transitions` is off.
3. Wire the new pass into `Simulation.step` (`src/core/loop.ts`) where appropriate
   (around food regeneration), threading the run's `Rng`, and make the WASM food-regen
   (and any affected) path fall back to TypeScript when `transitions` is on
   (WASM-fallback rule). Do not port transitions into the kernel.
4. Update `specification.md`: a new Domain rule "Transitions / complexity
   ([design-abstraction] / [speculative])" stressing it is **detection at a designed
   threshold, not emergence**, and **reversible/non-absorbing by construction** (a
   degradation hazard guarantees exits): high sustained local density and knowledge flip
   a local state that raises then degrades local carrying capacity, giving
   overshoot/decline/recovery; population bounds preserved; off by default. Data schemas:
   the `transitions` toggle and its constants (and any per-region scalars). Bump the
   version (minor bump, ≈0.8.0 — choose the next free version at run time). Update
   `docs-dev/planning/current_state.md` to note the new system and its speculative
   label.

## Do not implement

Do not implement:
- any claim of emergence, or an "emergent" label for the state (it is
  [design-abstraction] / [speculative]);
- a technology tree, named institutions, research, or buildings;
- an irreversible "win" or absorbing complexity state (the decay hazard must keep it
  reversible — exits must be observable);
- the artificial-agents ↔ civilisation/ecosystem coupling (plan §7, out of scope);
- anything that can force guaranteed extinction on the default path, or that removes a
  population bound;
- a render cue or setup-screen control;
- porting transitions into the WASM kernel;
- any default-on behaviour or any post-start control.

## Acceptance criteria

The task is complete when:
- with `transitions = false`, a fixed seed and parameters reproduce a run exactly,
  identical to the pre-change core (the determinism test passes), no region state is
  computed and food regeneration is unaltered, and the population-stability test
  (prompt 012) stays green — the subsystem is inert by default;
- with `transitions = true` and a fixed seed and parameters, the run is exactly
  reproducible (a determinism test passes) and the affected passes run in TypeScript;
- a focused core test shows the state both **arises and collapses** across seeds: under
  enabling conditions some regions/seeds enter the complexity state and some later exit
  it (neither uniform nor terminal — the Butzer/Endfield "some transform, some recover"
  signature), reproducibly per seed;
- a core test confirms the state is non-absorbing: over a long run, regions that enter
  the state are observed to exit it (it does not become a permanent attractor) and the
  population bounds hold;
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for determinism with transitions on,
for the arise-and-collapse signature across seeds, for non-absorption (observed exits)
and bound preservation, and confirm the prompt-012 stability test still passes unchanged
on the default path.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`085_transitions_threshold.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
