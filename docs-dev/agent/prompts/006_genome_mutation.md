# Task: Genome inheritance and mutation

## Goal

Add inheritance of traits to offspring with Gaussian mutation and clamping, plus rare freak mutations that are flagged.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Domain rules → Reproduction and mutation_ (inherit, then perturb each trait with the configured probability by a Gaussian step of the configured magnitude, then clamp) and _Events_ (rare freak mutations are legitimate variation and are flagged). All randomness uses the seeded RNG from `002`.

## Required changes

1. In `src/core/genome.ts` (or a new `src/core/mutation.ts`), create an offspring genome from parent trait(s): copy traits, mutate each with the configured probability by a Gaussian step (e.g. Box–Muller via the seeded RNG) of the configured magnitude, then clamp all traits to range.
2. Implement the rare freak mutation: with a low configured probability, apply an out-of-distribution value to a trait and return a flag indicating a freak occurred (for later display and narration).
3. Add tests: determinism (same seed + parent ⇒ same child); mutated traits remain in range after clamping; mutation probability and magnitude behave as expected over many samples; the freak flag fires at the configured low rate.

## Do not implement

Do not implement:
- the reproduction trigger or its energy cost (that is behaviour/energy);
- species assignment or clustering;
- any UI or rendering.

## Acceptance criteria

The task is complete when:
- tests pass for determinism, clamping, mutation statistics, and the freak flag;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`006_genome_mutation.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
