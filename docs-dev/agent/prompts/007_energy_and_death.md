# Task: Energy budget and death

## Goal

Add per-tick energy drain, energy gain from eating, and death by zero energy or maximum age.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Domain rules → Energy budget_ — each tick subtracts a baseline metabolic drain scaled by `size`, `speed`, and `metabolicEfficiency`; eating adds energy; an agent dies at zero energy or when it exceeds a maximum age. Selection is implicit and continuous — no fitness function, no generations.

## Required changes

1. In `src/core/energy.ts`, apply the per-tick metabolic drain scaled by `size`, `speed`, and `metabolicEfficiency` (using the baseline cost in params); add energy when an agent eats; cap stored energy by a capacity influenced by `size`.
2. Apply death when energy reaches zero or age exceeds the maximum, removing the agent via the world pool (`killAgent`) and incrementing a deaths counter.
3. Add tests: drain scales with the stated traits; eating adds energy up to the cap; agents die at zero energy and at maximum age; counters update.

## Do not implement

Do not implement:
- movement or behaviour decisions, predation, or the reproduction trigger;
- food regeneration;
- rendering or the worker.

## Acceptance criteria

The task is complete when:
- tests pass and the energy and death rules match the spec;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`007_energy_and_death.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
