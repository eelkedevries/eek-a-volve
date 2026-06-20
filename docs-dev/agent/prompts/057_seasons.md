# Task: seasons — a deterministic environmental cycle

## Goal

Add an optional seasonal cycle that slowly modulates food regeneration over time,
so the environment is dynamic and the population must track a moving carrying
capacity. Off by default, so the default run is unchanged.

## Scope

Implement only a single deterministic seasonal modulation of food regeneration,
its tunables, and the spec/version update. Do not add weather, day/night,
disease, multiple cycles, or any post-start control (the cycle is automatic, a
function of tick — it is not a user adjustment mid-run).

## Context

Food regenerates each tick up to a carrying capacity and is the dominant control
on population (`src/core/food.ts` `regenerateFood`; specification: Domain rules →
Population bounds). The loop is a deterministic fixed timestep with a tick counter
(`src/core/loop.ts`). 046 added a spatial fertility field; seasons are the
temporal counterpart. The binding canon is `specification.md`; this adds a domain
rule, so it needs a spec update and a version bump. Determinism must hold: the
modulation is a closed-form function of the tick, using no platform randomness.

## Required changes

1. Add `seasonAmplitude` (0 = off, the default) and `seasonPeriod` (in ticks) to
   `SimulationParameters` / `DEFAULT_PARAMETERS` (`src/core/params.ts`), with doc
   comments. Optionally enable a gentle season in one preset.
2. In `regenerateFood` (or a small helper it calls), scale the effective
   regeneration rate by a smooth seasonal factor — e.g. `1 + seasonAmplitude *
   sin(2π * tick / seasonPeriod)` — clamped to stay non-negative. Pass the tick
   in from the loop. At `seasonAmplitude = 0` the behaviour must be byte-for-byte
   identical to today (no extra RNG draws, same code path).
3. Keep it deterministic and allocation-free on the per-tick path.
4. Update `specification.md` (Domain rules → Population bounds: regeneration may
   be modulated by a deterministic seasonal cycle, off by default; add the two
   parameters to the parameter-set list) and bump the version. Update
   `docs-dev/planning/current_state.md`.

## Do not implement

Do not implement:
- weather, day/night, disease, or multiple/independent cycles;
- seasonal change to the *spatial* fertility field (food rate only here);
- any user control of the season after start.

## Acceptance criteria

The task is complete when:
- with `seasonAmplitude = 0` the run is byte-for-byte identical to before (the
  determinism and population-stability tests stay green on the defaults);
- with a season on, a fixed seed and parameters reproduce a run exactly, and a
  headless test shows food regeneration (and population) oscillating with the
  configured period;
- the per-tick path performs no new allocation;
- `npm run build` passes and `npm test` stays green.

## Checks

Run `npm run build` and `npm test`. Add core tests for seasonal determinism and
the oscillation, and confirm the `seasonAmplitude = 0` path is unchanged.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`057_seasons.md`) as the commit message,
then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
