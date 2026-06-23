# Task: metabolic cost of cognition (expensive perception)

## Goal

Add an optional, default-off metabolic cost for cognition — an extra per-tick
energy drain proportional to a creature's `senseRadius` — so that greater
perceptual/cognitive investment is bounded by its energy price rather than free,
while leaving the default run byte-for-byte unchanged.

## Scope

Implement only the new `cognitionCost` parameter and the `senseRadius`-proportional
drain term in `metabolicCost`, plus the accompanying tests and specification
update. Do not implement a cost for the neural-network brain, any new genome
trait, any setup-screen control, or any coupling to other systems — these are
noted follow-ons.

## Context

Per-tick metabolic drain is computed in `metabolicCost` in `src/core/energy.ts`:
`cost = (baseMetabolicCost * (size + speed)) / efficiency`, then multiplied by an
honest-ornament factor `(1 + DISPLAY_COST * display)` but only when
`params.sexualReproduction` is on. The new cognition term follows exactly that
pattern. `senseRadius` is an existing evolvable trait — column index `SENSE_RADIUS`
(2) in `src/core/genome.ts`, one of the six leading "ecological"/species traits,
range `0..50` (`TRAIT_RANGES[SENSE_RADIUS].max`). Higher `senseRadius` already
confers a foraging/avoidance benefit via `src/core/behaviour.ts`, so a cost on it
creates a genuine trade-off (the "expensive tissue" coupling: cognition pays only
where it earns its keep). The brain's network has a **fixed topology**
(`BRAIN_WEIGHT_COUNT` is identical for every creature, `src/core/brain.ts`), so a
brain charge would be a flat surcharge rather than an evolutionary lever — hence
it is deliberately out of scope here. Parameters live in `src/core/params.ts`
(`SimulationParameters` + `DEFAULT_PARAMETERS`). The binding canon is
`docs-dev/reference/primary_authoritative/specification.md` (current version
0.5.1); this prompt adds a parameter and extends a domain rule, so it must be
accompanied by a specification update and a version bump. Background and rationale
(non-binding): `docs-dev/planning/science_integration_plan.md` §5, prompt 072.

## Required changes

1. Add `cognitionCost: number` to `SimulationParameters` in `src/core/params.ts`,
   documented as the extra metabolic drain (as a fraction of base drain) borne by
   a creature with maximal `senseRadius`; an optional capability, default off. Set
   it to `0` in `DEFAULT_PARAMETERS` — the value that reproduces today's
   behaviour. Do not add it to `COMMUNITY_PRESET` or `SWARM_PRESET`.
2. In `metabolicCost` (`src/core/energy.ts`), apply an additional multiplicative
   drain factor `(1 + params.cognitionCost * (senseRadius / SENSE_MAX))`, where
   `senseRadius` is `world.traits[SENSE_RADIUS][slot]` and `SENSE_MAX` is the
   trait's maximum (`TRAIT_RANGES[SENSE_RADIUS].max`). Apply it independently of,
   and alongside, the existing `display` cost. Because `cognitionCost` defaults to
   `0` the factor is exactly `1`, so the asexual default run — and the prompt-012
   population-stability test — are byte-for-byte unchanged. Keep the per-tick path
   allocation-free and deterministic (no new RNG draws).
3. Update `specification.md`: Domain rules → Energy budget (the per-tick drain may
   include an optional cognition term proportional to `senseRadius`, off by
   default, so cognition is bounded by its energy price); Data schemas (the new
   `cognitionCost` parameter, default off). Bump the version (0.5.1 → 0.5.2).
   Update `docs-dev/planning/current_state.md` to note the new coupling.

## Do not implement

Do not implement:
- a metabolic surcharge for the neural-network brain (fixed topology makes it a
  flat cost, not an evolutionary lever; a separate, noted follow-on);
- any new genome trait — cost the existing `senseRadius`; leave `TRAITS` unchanged;
- exposing `cognitionCost` in the setup screen, the setup help, or any preset (a
  later UI prompt);
- any coupling to disease, culture, grouping, predation, or reproduction;
- any change to the brain's function or to behaviour, or any post-start control;
- any default-on behaviour.

## Acceptance criteria

The task is complete when:
- with `cognitionCost = 0`, a fixed seed and parameters reproduce a run exactly,
  identical to the pre-change core (the determinism test passes), and the
  population-stability test (prompt 012) stays green — the term is inert by
  default;
- with `cognitionCost > 0` and a fixed seed and parameters, the run is exactly
  reproducible (a determinism test in the costed mode passes);
- a focused core test shows the bound: from the same seed, a run with a
  meaningful `cognitionCost > 0` ends with a lower population-mean `senseRadius`
  than a `cognitionCost = 0` control run — cognition is bounded, not free;
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for determinism with
`cognitionCost > 0` and for the `senseRadius`-bounding effect (costed vs control),
and confirm the prompt-012 stability test still passes unchanged.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`072_cognition_cost.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
