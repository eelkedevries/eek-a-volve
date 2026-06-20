# Task: spatial niches via a deterministic fertility field

## Goal

Make the world spatially varied: a coarse, deterministic fertility field that
weights where food regenerates, so some regions are richer than others and
selection acquires a spatial dimension — with a subtle background tint so the
biomes are visible. Off by default, so the default run is unchanged.

## Scope

Implement only the single scalar fertility field, its effect on food
regeneration, the tunable strength, and a faint render tint. Do not implement
distinct biome *types*, per-biome food kinds, seasons or a time-varying field, a
heatmap toggle, or migration mechanics — those are later prompts.

## Context

Core conventions: a deterministic fixed-timestep loop, the seeded `mulberry32`
RNG (`src/core/rng.ts`), and food regeneration in `src/core/food.ts`
(`regenerateFood`) which places new food up to the carrying capacity. Population
is dominantly controlled by food (specification: Domain rules → Population
bounds), and a run must be exactly reproducible from seed + parameters
(Determinism). The renderer (`src/render/`) imports core constants freely and
draws the world container under the camera. The binding canon is
`docs-dev/reference/primary_authoritative/specification.md`; this prompt changes
a domain rule (food placement), so it must be accompanied by a specification
update and a version bump.

The field must be a single source of truth shared by the worker (for regen) and
the renderer (for the tint) without a new snapshot or protocol field: a **pure,
deterministic** function of cell coordinates, world dimensions, and seed, so both
threads compute the same field independently.

## Required changes

1. Add a pure, deterministic fertility helper to `core` (e.g.
   `src/core/biome.ts`): given world dimensions, a cell size, the seed, and a
   cell (or position), return a fertility weight in `[0, 1]`. Use only
   seed-derived arithmetic (a small hash / a few summed sinusoids), never the
   unseeded platform RNG. No per-call allocation on the hot path; if a coarse
   grid is precomputed, allocate it once.
2. Add a `biomeStrength` parameter to `SimulationParameters` /
   `DEFAULT_PARAMETERS` (`src/core/params.ts`), defaulting to `0` (uniform — no
   spatial weighting), and document it. Optionally enable it (> 0) in one preset.
3. In `regenerateFood` (`src/core/food.ts`), when `biomeStrength > 0`, bias the
   placement of newly regenerated food toward higher-fertility locations
   (e.g. weighted/rejection sampling), interpolating between uniform placement at
   `biomeStrength = 0` and strongly fertility-weighted placement at the maximum.
   Use only the seeded RNG; the result must be deterministic. When
   `biomeStrength = 0` the placement must be byte-for-byte identical to today's.
4. In the renderer, draw a faint, static background tint reflecting fertility
   (computed from the same core helper using the run's seed and dimensions), low
   enough in contrast not to obscure creatures or food. Respect the existing
   quality / reduced-motion settings; this is a one-off draw, not a per-frame
   cost.
5. Update `specification.md` (Data schemas: the optional fertility field; Domain
   rules → Population bounds: food regeneration may be spatially weighted by an
   optional, deterministic fertility field, uniform by default) and bump the
   version. Update `docs-dev/planning/current_state.md` to note the new system.

## Do not implement

Do not implement:
- multiple discrete biome types or biome-specific food kinds;
- seasons or any time-varying / animated field;
- a user-facing heatmap or overlay toggle;
- any post-start control or god tool.

## Acceptance criteria

The task is complete when:
- with `biomeStrength = 0` the run is byte-for-byte identical to before
  (the determinism and population-stability tests stay green on the default
  parameters);
- with `biomeStrength > 0`, a fixed seed and parameters still reproduce a run
  exactly (a determinism test passes), and a headless test or logged metric shows
  food (and, over time, creatures) concentrating in high-fertility regions more
  than with the field disabled;
- the per-tick path performs no new allocation (any field grid is allocated once);
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for fertility-field
determinism and for the spatial-weighting effect on food placement, and confirm
the `biomeStrength = 0` path is unchanged.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`046_biomes.md`) as the commit message,
then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
