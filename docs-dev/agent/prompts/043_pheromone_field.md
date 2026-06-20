# Task: pheromone field (minimal, single channel)

## Goal

Add a single decaying, diffusing pheromone field that creatures emit into and sense, with one behavioural response, keeping the simulation deterministic and the per-tick path allocation-free.

## Scope

Implement only the minimal single-channel field and the one behavioural use described below. Do not implement adjacent systems or future prompts (multiple channels, deception/mimicry, a render overlay, or any post-start control).

## Context

Core conventions: a deterministic fixed-timestep loop (`src/core/loop.ts`), the seeded `mulberry32` RNG (`src/core/rng.ts`), a structure-of-arrays world with pooled slots (`src/core/world.ts`), and a uniform spatial grid for neighbour queries (`src/core/grid.ts`). The render snapshot is append-only (`src/core/snapshot.ts`). The binding canon is `docs-dev/reference/primary_authoritative/specification.md`; this prompt adds a domain rule, so it must be accompanied by a specification update and a version bump.

Design choices fixed for this minimal version (confirmed at planning): a **single** channel; emission is **condition-based (on eating)**, not a genetic trait; the behavioural use is **trail-following toward food** when no food is directly sensed.

## Required changes

1. Add a coarse scalar pheromone grid to the world: a `Float32Array` sized from the world dimensions and a configurable cell size, allocated once at construction and reused. No per-tick allocation.
2. Each tick (in `loop.ts`), decay the field by a configurable factor and apply a simple diffusion step to neighbouring cells. Any stochasticity must use only the seeded RNG; the step must be deterministic.
3. Emission: when a creature eats (the existing `EATING` outcome in `src/core/behaviour.ts`), deposit a configurable constant amount into the cell at its position.
4. Sensing and behaviour: extend the behaviour policy so that, when no food is sensed within `senseRadius`, a creature biases its movement up the local pheromone gradient (sampling the few cells around it). Leave the existing flee / court / seek-food / eat / reproduce priorities otherwise unchanged.
5. Add the new constants to the core configuration, and add the new tunables (cell size, decay, diffusion, deposit amount, and an on/off toggle) to `SimulationParameters` / `DEFAULT_PARAMETERS` (`src/core/params.ts`) so they are configurable before start. Default the toggle on for at least one preset.
6. Update `specification.md` (Data schemas and Domain rules) to record the field and bump the version. Update `docs-dev/planning/current_state.md` to note the new system.

## Do not implement

Do not implement:
- multiple pheromone channels, alarm signalling, or deception / mimicry;
- a render overlay or heatmap (a later prompt);
- any post-start control or god tool;
- a genetic emission trait (emission is condition-based in this minimal version).

## Acceptance criteria

The task is complete when:
- the field decays and diffuses deterministically, and a fixed seed and parameters reproduce a run exactly (a determinism test passes);
- with emission and gradient-following enabled, a headless run shows creatures aggregating along deposited trails more than with the feature disabled, demonstrated by a test or a logged metric;
- the population-stability test remains green (no extinction or unbounded growth on the default run);
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for decay/diffusion determinism and for the gradient-following effect.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`043_pheromone_field.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
