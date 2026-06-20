# Task: Life stages (juvenile, adult, elder)

## Goal

Give creatures a visible life: juveniles grow up, adults reproduce, elders are marked — so ageing is recognisable.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

The world already tracks `age`. Add life stages derived from age thresholds, gate reproduction on adulthood, and expose the stage so the snapshot's packed state byte (from 026) and the renderer can show growth and an "Elder". This is a binding domain-rule addition — update the specification and bump its version.

## Required changes

1. In `src/core/lifestage.ts`, define stages (`JUVENILE`, `ADULT`, `ELDER`) and age thresholds (provisional constants), plus `stageOf(age)` and a render-scale factor per stage (juveniles smaller).
2. Gate reproduction (in `behaviour.ts`) so only adults reproduce; write the current stage into the world (and so into the snapshot's state byte from 026).
3. Record the maturity rule and stage thresholds in `docs-dev/reference/primary_authoritative/specification.md` and bump its version.
4. Tests: `stageOf` maps ages to the right stage at the boundaries; juveniles do not reproduce while adults do; behaviour stays deterministic; the population-stability test still passes with stages on.

## Do not implement

Do not implement:
- sexual reproduction (next prompt) or the renderer;
- per-stage diet or behaviour differences beyond the reproduction gate.

## Acceptance criteria

The task is complete when:
- tests pass for stage mapping, the adult-only reproduction gate, determinism, and stability;
- the spec is updated and its version bumped;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`027_life_stages.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
