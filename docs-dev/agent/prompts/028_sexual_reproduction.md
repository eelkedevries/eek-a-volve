# Task: Sexual reproduction and courtship

## Goal

Add recognisable mating: two compatible adults seek each other, court briefly, then produce a crossover-genome offspring.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Reproduction is currently asexual (single parent + mutation). The spec calls for sexual reproduction "or asexually if the configuration selects it". Add a reproduction-mode parameter and a two-parent path with genome crossover, marking courting agents (state `COURTING` from 025) so it reads on screen. This is a binding domain-rule change — update the specification and bump its version.

## Required changes

1. Add a `sexualReproduction` boolean to `SimulationParameters` (default on); record it in the spec.
2. In `mutation.ts` (or a focused `crossover.ts`), add genome crossover from two parents (per-trait uniform or arithmetic) followed by the existing mutation + clamp + freak path.
3. In `behaviour.ts`, when sexual mode is on: an adult over the reproduction threshold seeks the nearest **compatible** adult — compatibility computed **directly as normalised genetic distance below the speciation threshold** (not via the stale, 60-tick species id) — also over threshold and within sense. The pair **visibly converge and pause adjacent for a few ticks** (set state `COURTING` throughout, so the approach reads on screen), then both pay an energy cost and produce one crossover offspring placed beside them. Mate-seeking competes with hunger: prefer feeding when low on energy, court only when comfortably above the threshold. Asexual mode keeps the current single-parent path. (Crossover draws shift the RNG stream versus the old asexual default — expected for a new run.)
4. Tests: crossover child traits inherit from both parents and stay in range; two ready adults in range produce exactly one offspring and pay energy; lone adults do not reproduce sexually; determinism; population stays bounded with sexual reproduction on.

**Robustness (the crux of this prompt):** sexual reproduction makes births harder (two adults must meet), and it stacks on the 027 maturity delay, so it is the set's top extinction risk. The `012` population-stability test runs on `DEFAULT_PARAMETERS`, so it must stay green **with both 027 and `sexualReproduction` on**. Implement 027 first; retune mate-finding (sense/mate radius, courtship cost, maturity age) and re-run the full suite. **Explicit fallback:** if stability cannot be reached without making mating trivial, ship `sexualReproduction` defaulting **off** (opt-in in setup) — this still satisfies the spec's "or asexually if the configuration selects it" — and say so in the final report rather than shipping a red 012.

## Do not implement

Do not implement:
- the renderer, courtship animations, or hearts (a later FX prompt);
- eggs/pregnancy timers (offspring appears on mating).

## Acceptance criteria

The task is complete when:
- tests pass for crossover ranges, the two-parent gate, energy cost, determinism, and bounded population;
- the spec is updated and its version bumped;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`028_sexual_reproduction.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
