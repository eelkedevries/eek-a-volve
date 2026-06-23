# Task: density-dependent disease (minimal SIR/SIS)

## Goal

Add an optional, default-off compartmental infection where transmission is
density/contact-dependent — infected creatures infect susceptible grid neighbours
via the seeded generator, timers carry the infected to recovery (immunity or
re-susceptibility) or to disease death routed through the normal death path — so
dense populations and large groups pay a disease tax, while leaving the default run
byte-for-byte unchanged.

## Scope

Implement only: the `disease` toggle and its rate parameters; two new pre-allocated
per-agent columns (`infectionState`, `infectionTimer`); a new TypeScript disease
pass that infects neighbours, advances timers, and kills the dying through the
existing death path; an optional costly host `resistance` trait appended after the
six ecological traits; the WASM-fallback wiring; and the accompanying tests and
specification update. Do not implement evolving pathogen virulence, parasite-
mediated mate choice, multi-pathogen strains, or any render/UI — these are later
prompts (075, 078, 076).

## Context

The world is a structure-of-arrays in `src/core/world.ts` (the `World` class):
per-agent columns are pre-allocated typed arrays indexed by slot, in both the
default branch and the shared-`ArrayBuffer` (WASM) branch, and their byte layout is
declared in `src/core/worldLayout.ts` (`WorldLayout`, `computeWorldLayout`). Adding
a per-agent column means adding a field there in **both** branches and an offset in
the layout — append it so existing offsets stay stable; `infectionState` fits the
1-byte column group (alongside `alive`/`action`), `infectionTimer` a 2-byte
(`Uint16Array`) or 4-byte column. `spawnAgent` / `killAgent` manage the free-list;
new agents must start `infectionState = 0` (susceptible) and `infectionTimer = 0`
(reset them in `spawnAgent`, or rely on the column being cleared on slot reuse —
confirm and make explicit). Founders/immigrants are spawned by `spawnRandomAgent`
in `src/core/bounds.ts`.

Death and reaping live in `src/core/energy.ts`: `metaboliseAndReap` calls
`dropCarrion(world, x, y, size)` then `world.killAgent(s)` for each death and
returns a count. Disease deaths must use the same `dropCarrion` + `killAgent`
sequence so carrion, records, and the obituary/event machinery (`eventLog.reconcile`
in `src/core/loop.ts`) behave exactly as for any other death. The grid for
neighbour queries is `src/core/grid.ts` (`SpatialGrid.query`), rebuilt each tick in
the loop; the run's seeded generator is `Rng` (`src/core/rng.ts`), owned by the
`Simulation` in `src/core/loop.ts`.

The new pass is registered in `Simulation.step` (`src/core/loop.ts`) as its own
pass over current positions — run it after predation/metabolism but before the
counters are finalised, so its deaths add into the tick's `deaths` total (the loop
already sums `deaths` across passes). Like other passes it must draw from the run's
`Rng` only when `params.disease` is on, so the RNG stream and the default run are
unchanged when disease is off. The WASM core runs the hot loop (metabolism,
behaviour, predation) when `wasm.canRunBehaviour(params)` is true
(`!params.neuralBrains`, `src/wasm/metabolismCore.ts`); the kernel has no disease
logic and would not advance the new columns, so when `params.disease` is on the run
must fall back to the TypeScript hot loop (extend `canRunBehaviour`, and gate the
WASM `metabolise` path, so disease always runs in TS) — per the WASM-fallback rule;
porting disease into the kernel is out of scope.

The genome is `src/core/genome.ts`: `TRAITS` (column order, currently 8 — `size`,
`speed`, `senseRadius`, `metabolicEfficiency`, `diet`, `colourHue`, `display`,
`matePreference`), `TRAIT_COUNT`, per-trait indices, `TRAIT_RANGES`, and
`SPECIES_TRAIT_COUNT = COLOUR_HUE + 1 = 6` (the six ecological traits used by the
genetic-distance gate; the gate loops `t < SPECIES_TRAIT_COUNT`, so any trait
appended after index 5 is automatically excluded). World columns, `spawnRandomAgent`,
`breed`/`breedSexual` (`src/core/mutation.ts`), the snapshot header trait means
(`src/core/snapshot.ts`), and the inspector chips all derive from `TRAIT_COUNT` and
iterate generically, so appending a trait extends them without manual offset edits
— exactly as `display`/`matePreference` were added in v0.3.6 (see prompt 047).

The render snapshot (`src/core/snapshot.ts`) is **append-only**; this prompt adds no
render cue (that is 076), but `H_TRAIT_MEANS … H_TRAIT_MEANS + TRAIT_COUNT` will
automatically include any new trait mean — confirm the snapshot-offset invariants
still hold. Parameters live in `src/core/params.ts`. The binding canon is
`docs-dev/reference/primary_authoritative/specification.md` (current version 0.5.3,
assuming 072–073 have landed; otherwise sequence after them); this is a substantial
new subsystem, so it must be accompanied by a specification update and a version
bump. Background and rationale (non-binding):
`docs-dev/planning/science_integration_plan.md` §4 (cross-cutting rules) and §5,
prompt 074.

## Required changes

1. Add to `SimulationParameters` in `src/core/params.ts`: `disease: boolean` and
   the rate parameters `transmissionRate`, `recoveryRate`, `diseaseMortality`, and
   an `immunityMode` selecting SIR (recovery confers immunity) vs SIS (recovery
   returns the host to susceptible). Document each. Set `disease` to `false` and the
   rates to values that are inert while the toggle is off in `DEFAULT_PARAMETERS`;
   do not add them to `COMMUNITY_PRESET` or `SWARM_PRESET`.
2. Add two pre-allocated per-agent columns to `World` (`src/core/world.ts`) and
   `WorldLayout`/`computeWorldLayout` (`src/core/worldLayout.ts`), appended so
   existing offsets stay stable: `infectionState` (0 = susceptible, 1 = infected,
   2 = recovered/immune; a `Uint8Array`) and `infectionTimer` (ticks remaining in
   the current infection; `Uint16Array` or `Uint32Array`). Place them in both the
   default and shared-buffer constructor branches. Ensure a freshly spawned slot
   starts susceptible with a zero timer (in `spawnAgent`).
3. Add a new TypeScript pass `src/core/disease.ts` (a reused object with bound
   visitor, allocation-free per tick, in the style of `Predation`). When
   `params.disease` is on: for each infected agent, query its susceptible grid
   neighbours within a transmission radius (a `core/` constant) and infect each with
   probability `transmissionRate` using one seeded `Rng` draw per
   susceptible-in-radius (density-dependent βSI by default — denser
   surroundings ⇒ more infection events). Newly infected agents start an infection
   timer derived from `recoveryRate`. Each tick advance every infected agent's
   timer; on expiry, with probability `diseaseMortality` the host dies (via
   `dropCarrion` + `world.killAgent`, exactly as `metaboliseAndReap` does, counting
   the death), otherwise it recovers to immune (SIR) or susceptible (SIS) per
   `immunityMode`. Optionally apply a per-tick energy drain to infected hosts. The
   pass must draw **no** RNG and touch nothing when `params.disease` is off.
4. Wire the pass into `Simulation.step` (`src/core/loop.ts`) as its own pass over
   current positions (rebuilding/using the agent grid as predation does), threading
   the run's `Rng`, and add its return value into the tick's `deaths` total. Make
   `canRunBehaviour` in `src/wasm/metabolismCore.ts` (and the WASM `metabolise`
   gate) fall back to TypeScript when `params.disease` is on, so the new columns are
   always advanced by the TS hot loop (WASM-fallback rule). Do not port disease into
   the kernel.
5. Add an optional costly host `resistance` trait by appending it to `TRAITS` in
   `src/core/genome.ts` (taking `TRAIT_COUNT` from 8 to 9), with its column index
   and a `TRAIT_RANGES` entry, **after** the six ecological traits and the two
   sexual traits — so it is excluded from the genetic-distance gate (which loops
   `t < SPECIES_TRAIT_COUNT`) and from speciation. Higher `resistance` lowers the
   creature's chance of being infected (and/or its disease mortality) and carries a
   small viability cost (a metabolic drain term in `src/core/energy.ts`, gated so it
   is inert when `disease` is off) — so resistance is costly and only pays under
   disease pressure (a Red Queen seed). Keep the six ecological traits and the two
   sexual traits, and their order, unchanged.
6. Update `specification.md`: a new Domain rule "Disease" (density/contact-dependent
   transmission to grid neighbours via the seeded generator; timers to recovery —
   immunity (SIR) or re-susceptibility (SIS) — or disease death through the normal
   death path; off by default; the optional costly `resistance` host trait,
   excluded from the species-distance gate) and Data schemas (the `infectionState`
   and `infectionTimer` columns; the `disease` toggle and rate parameters; the
   `resistance` trait). Bump the version (minor bump, ≈0.5.3 → 0.6.0 — a substantial
   subsystem). Update `docs-dev/planning/current_state.md` to note the new system.

## Do not implement

Do not implement:
- evolving pathogen virulence or any transmission↔harm trade-off (prompt 075);
- parasite-mediated mate choice / Hamilton–Zuk (prompt 078);
- multi-pathogen or multi-strain bookkeeping;
- any render cue, "sick" visual, setup-screen control, legend entry, or event-feed
  routing for plague deaths (prompt 076);
- frequency-dependent transmission as the default (density-dependent βSI is the
  default; a frequency-dependent βSI/N variant may be noted in a comment as a
  runtime-cost escape hatch but need not be wired);
- porting disease into the WASM kernel;
- any ability for disease to force guaranteed extinction on the default (disease-
  off) path;
- any default-on behaviour or any post-start control.

## Acceptance criteria

The task is complete when:
- with `disease = false`, a fixed seed and parameters reproduce a run exactly,
  identical to the pre-change core (the determinism test passes), the disease pass
  draws no RNG and advances no columns, and the population-stability test (prompt
  012) stays green — the subsystem is inert by default;
- the snapshot-offset invariants still hold with the larger `TRAIT_COUNT` (a test
  asserts `HEADER_LENGTH`, `H_FOOD_COUNT`, and `snapshotLength` follow from
  `TRAIT_COUNT`), and the inspector shows the additional trait chip;
- with `disease = true` and a fixed seed and parameters, the run is exactly
  reproducible (a determinism test in disease mode passes);
- a focused core test shows density dependence: prevalence rises with population
  density / local group size, and an epidemic burns out under SIR (recovered hosts
  accumulate) or persists under SIS;
- disease deaths route through `dropCarrion` + `killAgent` (a test confirms carrion
  is dropped and the death is counted), and stability stays green — disease alone
  cannot guarantee extinction on the default path;
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for determinism in disease mode,
for density-dependent prevalence and SIR burn-out vs SIS persistence, for disease
deaths routing through the normal death path, for the snapshot-offset invariants at
the new `TRAIT_COUNT`, and confirm the prompt-012 stability test still passes
unchanged on the default path.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`074_disease_core.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
