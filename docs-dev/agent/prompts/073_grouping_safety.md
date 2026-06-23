# Task: grouping safety (dilution / selfish-herd / vigilance)

## Goal

Add an optional, default-off coupling whereby living near conspecifics lowers a
creature's *per-capita* predation risk (dilution and many-eyes), saturating so
very large groups give diminishing returns, with an optional huddle-under-threat
movement bias — so grouping is favoured only under predation and only up to a
point, while leaving the default run byte-for-byte unchanged.

## Scope

Implement only the `groupingSafety` coefficient and the local-group-size capture
discount in the predation pass, plus the optional huddle-under-threat bias in the
behaviour pass, plus the accompanying tests and specification update. Do not
implement an evolvable `sociality` trait, explicit flocking/boids forces, a second
pheromone channel, cooperative defence/attack, or any setup-screen control — these
are noted follow-ons.

## Context

Predation runs as its own pass in `src/core/predation.ts` (`Predation.step`),
after behaviour, over current positions. For each carnivore above
`CARNIVORY_THRESHOLD` it finds the nearest eligible prey within `ATTACK_RADIUS`
(prey smaller than `selfSize * PREY_SIZE_RATIO`) via `agentGrid.query(...)` and,
if one is found and still alive, consumes it deterministically: there is currently
**no capture probability and no RNG draw on this pass** — a found prey is always
taken. The grouping discount therefore introduces capture *probability* for the
first time, so it must draw from the seeded generator only when the coefficient is
non-zero (otherwise the RNG stream, and the default run, would change).

The local group size of a creature can be counted with the same
`SpatialGrid.query` already used here (`src/core/grid.ts`): a query around the
prey's position counts the conspecific neighbours within a chosen radius. Behaviour
lives in `src/core/behaviour.ts` (`Behaviour.step`); under threat a creature
currently flees directly away from `threatX/threatY` (the `this.hasThreat` branch,
shared by the neural and hand-coded paths via `world.action[s] = FLEEING`). The
huddle bias blends the flee heading toward nearby conspecifics.

`Predation.step` receives `params: SimulationParameters` and the agent grid but
**not** the generator today; passing the run's `Rng` into the pass (it is owned by
the `Simulation` in `src/core/loop.ts` and already threaded into behaviour) is part
of this change. Note the WASM core: `predationStep` and `behaviourStep` run in the
kernel when `wasm.canRunBehaviour(params)` is true (currently `!params.neuralBrains`,
in `src/wasm/metabolismCore.ts`); the kernel has no grouping logic, so when
`groupingSafety > 0` the run must fall back to the TypeScript predation/behaviour
passes (extend `canRunBehaviour` so it is also false when grouping is active), per
the WASM-fallback rule — porting the coupling into the kernel is out of scope.

Parameters live in `src/core/params.ts` (`SimulationParameters` +
`DEFAULT_PARAMETERS`). The binding canon is
`docs-dev/reference/primary_authoritative/specification.md` (current version 0.5.2,
assuming 072 has landed; otherwise sequence after it); this prompt adds a parameter
and extends two domain rules, so it must be accompanied by a specification update
and a version bump. Background and rationale (non-binding):
`docs-dev/planning/science_integration_plan.md` §4 (cross-cutting rules) and §5,
prompt 073.

## Required changes

1. Add `groupingSafety: number` to `SimulationParameters` in `src/core/params.ts`,
   documented as how strongly a dense local group dilutes per-capita predation
   risk; an optional capability, default off. Set it to `0` in `DEFAULT_PARAMETERS`
   — the value that reproduces today's behaviour. Do not add it to
   `COMMUNITY_PRESET` or `SWARM_PRESET`.
2. In `Predation.step` (`src/core/predation.ts`), when `params.groupingSafety > 0`
   and a prey target has been chosen, count the prey's local conspecific group
   size with a `SpatialGrid.query` (a neighbour radius defined as a `core/`
   constant), then compute a capture probability that *falls* with that group size
   and **saturates** (diminishing returns for very large groups — e.g. a discount
   of the form `1 / (1 + groupingSafety * (groupSize - 1))` or an equivalent
   saturating curve documented in a comment). Draw once from the seeded generator
   and only consume the prey if the draw is below the capture probability. When
   `groupingSafety === 0`, take exactly the current code path with **no** RNG draw,
   so the default run and the prompt-012 stability test are byte-for-byte
   unchanged. Thread the run's `Rng` into the pass from `src/core/loop.ts`. Keep
   the per-tick path allocation-free (reuse a bound visitor / counter as the
   existing `onAgent` does; do not allocate per prey).
3. Optionally (still behind `groupingSafety > 0`) add a small huddle-under-threat
   bias in `src/core/behaviour.ts`: when fleeing, blend the away-from-threat
   heading toward the local conspecific centroid so threatened creatures bunch
   rather than scatter outright. Keep flee / seek-food / eat / court priorities and
   ordering otherwise unchanged, keep it allocation-free and deterministic (no new
   RNG draws on this branch), and ensure it is completely inert when
   `groupingSafety === 0`.
4. In `src/wasm/metabolismCore.ts`, make `canRunBehaviour` (and hence the WASM
   predation/behaviour path) fall back to TypeScript when `groupingSafety > 0`, so
   the new coupling always runs in the TS passes (WASM-fallback rule). Do not port
   the coupling into the kernel.
5. Update `specification.md`: Domain rules → Predation (per-capita capture risk may
   fall with local group size, saturating, off by default) and Behaviour (an
   optional huddle-under-threat bias toward conspecifics); Data schemas (the new
   `groupingSafety` parameter, default off). Bump the version (≈0.5.2 → 0.5.3).
   Update `docs-dev/planning/current_state.md` to note the new coupling.

## Do not implement

Do not implement:
- an evolvable `sociality` / grouping-tendency genome trait (a noted follow-on; if
  ever added it sits after the six ecological traits and is excluded from the
  species-distance gate);
- explicit flocking / boids steering, or a centre-vs-periphery (selfish-herd
  geometry) asymmetry beyond the simple local-count discount;
- a second pheromone channel or any cooperative defence/attack;
- exposing `groupingSafety` in the setup screen, the setup help, or any preset (a
  later UI prompt);
- any coupling to disease, culture, or reproduction;
- porting the grouping discount into the WASM kernel;
- any default-on behaviour or any post-start control.

## Acceptance criteria

The task is complete when:
- with `groupingSafety = 0`, a fixed seed and parameters reproduce a run exactly,
  identical to the pre-change core (the determinism test passes), and the
  population-stability test (prompt 012) stays green — the coupling is inert by
  default and draws no RNG;
- with `groupingSafety > 0` and a fixed seed and parameters, the run is exactly
  reproducible (a determinism test in the grouping mode passes);
- a focused core test shows the dilution effect: a prey creature surrounded by many
  conspecifics has a measurably lower per-step capture probability than an isolated
  one, and the discount saturates (a large group is not arbitrarily safer than a
  moderately large one);
- a core test confirms the predator–prey signature still arises with grouping on
  (predation continues to cull; grouping does not abolish predation);
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for determinism with
`groupingSafety > 0`, for the saturating per-capita capture discount (dense vs
isolated prey), and confirm the prompt-012 stability test still passes unchanged
on the default path.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`073_grouping_safety.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
