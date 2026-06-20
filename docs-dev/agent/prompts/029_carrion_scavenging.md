# Task: Carrion and scavenging

## Goal

Make death feed the living: dead creatures leave carrion that carnivores and scavengers can eat — a recognisable scavenging behaviour and a tighter energy loop.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Food is currently a single kind (plants). Give food a type — plant or carrion — drop carrion where agents die, and let diet decide what an agent will eat (herbivores prefer plants, carnivores prefer carrion/meat). Keeps the energy budget honest and adds legible variety. Carrion decays so it cannot accumulate without bound.

## Required changes

1. Give food a `type` (plant or carrion). **Give the pool headroom:** size `foodCapacity = foodAbundance + a carrion reserve`, and make plant regeneration count *plants only* toward the `foodAbundance` carrying capacity — so carrion never fills the plant budget and starves herbivores (which would break 012). The snapshot food block from 026 already carries a type field.
2. When an agent dies of **metabolism, old age, or catastrophe** — **not** predation (the predator already gained that corpse's energy by eating, so dropping carrion too would double-count) — drop a carrion item at its position with energy scaled by its size, **bounded to a few drops per tick** and within the carrion reserve; carrion decays after a lifetime.
3. In `behaviour.ts`, bias food choice by diet: high-diet agents prefer carrion, low-diet prefer plants (both may eat either if hungry); eating carrion yields its stored energy.
4. Tests: a death drops carrion; carrion decays; a carnivore prefers nearby carrion over a plant and a herbivore the reverse; the food count never exceeds capacity; determinism; population stays bounded.

## Do not implement

Do not implement:
- rendering of food types (a later FX prompt) or scavenger-specific animations;
- separate carrion pools beyond the existing food pool.

## Acceptance criteria

The task is complete when:
- tests pass for carrion drop/decay, diet-biased choice, the food cap, determinism, and bounded population;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`029_carrion_scavenging.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
