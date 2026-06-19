# Task: Predation

## Goal

Add the predation branch: a sufficiently carnivorous, larger agent may consume a smaller neighbour for energy, behind the predation toggle.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Domain rules → Predation_ — when enabled, a sufficiently carnivorous agent that is larger than a neighbour may consume it for energy; the expected signature when predators and prey coexist is lagged, noisy oscillation (Lotka–Volterra-like), used as a reference only, never as the engine. Build on the existing behaviour/energy modules; gated by `params.predation`.

## Required changes

1. In the core (extend `behaviour.ts` or a focused `predation.ts`), when `params.predation` is set, let an agent whose `diet` exceeds a carnivory threshold and whose `size` exceeds a neighbour's by a margin consume that neighbour within an attack radius: the prey dies, the predator gains energy scaled by the prey's size (capped by capacity). Deterministic; integrates into the fixed tick order.
2. Ensure predation deaths are counted and the prey is removed via the pool.
3. Add tests: with predation on, a qualifying predator eats a smaller neighbour (prey dies, predator gains energy); with predation off, nothing happens; behaviour is deterministic; the population stays bounded with predation on.

## Do not implement

Do not implement:
- speciation or catastrophe events;
- any rendering or UI changes.

## Acceptance criteria

The task is complete when:
- tests pass for predation on/off, energy transfer, determinism, and bounded population;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`019_predation.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
