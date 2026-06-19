# Task: Trait-parameterised behaviour policy

## Goal

Add the hand-coded per-agent policy: seek the nearest food, flee a larger/carnivorous neighbour, and reproduce on crossing the energy threshold.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Domain rules → Behaviour_ and _Reproduction_ — a hand-coded policy parameterised by traits, not a learned controller. Uses the spatial grid for `senseRadius` queries and the seeded RNG for any stochastic choice. The predation consume/kill branch is out of scope here (Phase 5); only the flee response and reproduction are included.

## Required changes

1. In `src/core/behaviour.ts`, for each live agent per tick: detect the nearest food within `senseRadius` and move toward it; if a larger, more carnivorous agent is within range, flee; otherwise wander deterministically. Movement respects `speed` and incurs the matching energy cost via the energy rules.
2. Reproduction: when energy exceeds the reproduction threshold and (in sexual mode) a compatible neighbour is present, produce offspring via the genome/mutation module, paying an energy cost shared with the offspring; support an asexual mode selectable by configuration.
3. Add tests: agents move toward nearby food; flee from a larger carnivore; reproduce when above the threshold (offspring spawned and energy paid); behaviour is deterministic for a given seed.

## Do not implement

Do not implement:
- the predation consume/kill branch;
- species clustering or population-ceiling enforcement;
- rendering or the worker.

## Acceptance criteria

The task is complete when:
- tests pass for seek, flee, and reproduce, and behaviour is deterministic;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`009_behaviour_policy.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
