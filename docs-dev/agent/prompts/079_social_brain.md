# Task: social-brain return to cognition (offset by its cost)

## Goal

Offer the contested pathway where living in larger, denser groups gives a small
foraging return that scales with a creature's `senseRadius` (cognitive
investment) — so cognition repays only socially, and only when prompt 072's
cognition cost is affordable, making it a genuine trade-off rather than a free
upgrade; inert by default, so the default run is byte-for-byte unchanged.

## Goal label

This coupling is **[debated]**: the social-brain hypothesis (group complexity
selects for larger cognition) is contested, so it ships default-off at a
conservative strength and is explicitly paired with 072's metabolic cost — never as
a one-way "bigger brain is better" ratchet.

## Scope

Implement only the `socialBrain` toggle and a small, local-group-size-and-
`senseRadius`-scaled foraging return in the behaviour/feeding path, plus the
accompanying tests and specification update. Do not implement a new cognition trait,
a Dunbar's-number cap, any change to the neural-network brain's function, a
setup-screen control, or any coupling beyond grouping and the cognition cost — these
are out of scope.

## Scope guard

This prompt assumes prompt 072 (`cognition_cost`, shipped: the `cognitionCost`
parameter and the `senseRadius`-proportional metabolic drain in
`src/core/energy.ts`) **and** prompt 073 (`grouping_safety`: a local-conspecific-
count query and the WASM-fallback wiring for grouping) have landed. The trade-off it
demonstrates is only meaningful when 072's cost is also switched on, so the social
return is paid for. If 073 has not landed, stop and flag it (this prompt reuses
073's local-group-size counting; it does not add its own grouping subsystem).

## Context

Foraging energy is added in `src/core/behaviour.ts`: when a creature reaches its
targeted food it calls `feed(world, s, world.foodEnergy[food])` (and
`consumeFood`), the only routine energy intake on the hot loop; `feed`
(`src/core/energy.ts`) caps intake at the size-based capacity. `senseRadius` is the
existing perceptual/cognitive trait, `world.traits[SENSE_RADIUS][slot]`, range
`0..50` (`TRAIT_RANGES[SENSE_RADIUS]`, `src/core/genome.ts`); prompt 072 already
charges it a metabolic cost in `metabolicCost`. The social return is the
counterweight: where a creature is in a larger local group, a *small* fraction is
added to the energy it gains from food, scaled by its `senseRadius` — so a big sense
radius pays off only in company, and only enough to matter where 072's drain is
switched on. Count the local conspecific group size with the same
`SpatialGrid.query` mechanism prompt 073 introduces for its dilution discount
(`src/core/grid.ts`; reuse the bound-visitor / counter pattern, allocation-free —
do not allocate per agent); a neighbour radius constant lives in `core/`.

Keep the return modest and **saturating/bounded** so it cannot create a runaway: it
must be possible for cognition to be a *net loss* when 072's cost outweighs the
social gain (sparse populations, or no grouping), and the synthesis's expectation —
that brains *shrink* in many lineages when easy conditions remove the payoff — must
be reproducible. This is the cleanest place in the programme to demonstrate
non-monotonic, reversible intelligence, so design against any monotone increase in
mean `senseRadius`.

Per the determinism rule, the social return must add **no** new RNG draw
(it is a deterministic function of local count and `senseRadius`), and must be
completely inert when `socialBrain` is off, so the RNG stream and the default run
are unchanged. The WASM behaviour kernel has no social-brain logic; 073 already
forces the TS behaviour/predation path when grouping is active, and this coupling
relies on that local-count query, so it must likewise force the TS behaviour pass
when `socialBrain` is on — extend `canRunBehaviour` in
`src/wasm/metabolismCore.ts` so it is also false when `socialBrain` is on, per the
WASM-fallback rule. Do not port the coupling into the kernel.

Parameters live in `src/core/params.ts`. The binding canon is
`docs-dev/reference/primary_authoritative/specification.md`; this prompt adds a
parameter and a domain-rules note, so it must be accompanied by a specification
update and a version bump. Background and rationale (non-binding):
`docs-dev/planning/science_integration_plan.md` §4 (cross-cutting rules) and §5,
prompt 079.

## Required changes

1. Add `socialBrain: boolean` (and, if a strength is needed beyond a `core/`
   constant, a `socialBrainGain: number`) to `SimulationParameters` in
   `src/core/params.ts`, documented as the optional, default-off social return to
   cognition: in larger local groups, foraging gain scales with `senseRadius`. Set
   `socialBrain` to `false` (and any gain inert while off) in `DEFAULT_PARAMETERS`;
   do not add it to `COMMUNITY_PRESET` or `SWARM_PRESET`.
2. In the feeding path of `src/core/behaviour.ts`, when `params.socialBrain` is on,
   add a small, bounded multiplier to the energy a creature gains from eating,
   increasing with both its local conspecific group size (counted via
   `SpatialGrid.query`, reusing 073's pattern) and its `senseRadius / SENSE_MAX`, so
   the return saturates and is meaningful only in company. Add **no** RNG draw, keep
   the path allocation-free, and make it completely inert when `socialBrain` is off
   (exactly the current `feed(...)` call), so the default run is byte-for-byte
   unchanged.
3. In `src/wasm/metabolismCore.ts`, make `canRunBehaviour` (and hence the WASM
   behaviour/predation path) fall back to TypeScript when `socialBrain` is on, so
   the new coupling always runs in the TS passes (WASM-fallback rule). Do not port
   it into the kernel.
4. Update `specification.md`: a Domain rules note (optional social return to
   cognition: in larger local groups a small foraging gain scales with
   `senseRadius`, off by default; paired with the `cognitionCost` drain so cognition
   is a genuine trade-off, repaying only socially and only when affordable — it can
   be a net loss and mean `senseRadius` can fall) and Data schemas (the new
   `socialBrain` toggle and any gain constant). Bump the version (≈0.6.5, sequencing
   after 072/073 — choose the next free version at run time). Update
   `docs-dev/planning/current_state.md` to note the new coupling.

## Do not implement

Do not implement:
- a new cognition / sociality genome trait (cost and reward the existing
  `senseRadius`; leave `TRAITS` unchanged);
- a Dunbar's-number hard cap or any fixed group-size ceiling on the return;
- any change to the neural-network brain's structure or function, or a brain-weight
  return (072 deliberately costs `senseRadius`, not the fixed-topology brain);
- treating the social-brain hypothesis as established, or making `socialBrain`
  default-on;
- a setup-screen control (a later UI prompt) or any coupling to disease or culture;
- porting the coupling into the WASM kernel;
- any post-start control.

## Acceptance criteria

The task is complete when:
- with `socialBrain = false`, a fixed seed and parameters reproduce a run exactly,
  identical to the pre-change core (the determinism test passes), the feeding path
  draws no extra RNG, and the population-stability test (prompt 012) stays green —
  the coupling is inert by default;
- with `socialBrain = true` and a fixed seed and parameters, the run is exactly
  reproducible (a determinism test in the social-brain mode passes) and the
  behaviour pass runs in TypeScript;
- a focused core test demonstrates the trade-off and its reversibility: with
  `socialBrain` on **and** `cognitionCost` on, a dense, grouping population can
  sustain a higher mean `senseRadius` than the same set-up without the social
  return; and when the payoff is removed (sparse population, or `socialBrain` off
  with the cost still on) mean `senseRadius` does **not** rise monotonically and can
  fall — cognition is non-monotonic and reversible, not a one-way upgrade;
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for determinism in the
social-brain mode, for the cognition trade-off (social return vs cost, including a
case where mean `senseRadius` falls when the payoff is removed), and confirm the
prompt-012 stability test still passes unchanged on the default path.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`079_social_brain.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
