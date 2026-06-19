# Task: Food regeneration and carrying capacity

## Goal

Add food that regenerates at the configured rate up to a carrying capacity.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Domain rules → Population bounds_ — food regenerates at the configured rate up to a carrying capacity, which is the dominant control on population. Placement is deterministic via the seeded RNG.

## Required changes

1. In `src/core/food.ts`, maintain food items in the world (pooled slots) with positions; regenerate per tick at the configured rate up to the carrying-capacity ceiling; place new food deterministically via the RNG.
2. Provide consumption: an eaten food slot is freed and becomes eligible for later regeneration.
3. Add tests: the food count never exceeds carrying capacity; the regeneration rate is honoured over ticks; consumption frees slots; behaviour is deterministic for a given seed.

## Do not implement

Do not implement:
- agent food-seeking or the energy-gain wiring (covered when behaviour and energy integrate);
- predation, reproduction, or the tick loop;
- rendering or the worker.

## Acceptance criteria

The task is complete when:
- tests pass and carrying capacity and regeneration behave per the spec;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`008_food_system.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
