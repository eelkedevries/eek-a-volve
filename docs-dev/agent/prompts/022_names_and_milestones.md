# Task: Procedural names and milestone lines

## Goal

Generate mock-Latin species binomials from dominant traits, and milestone/extinction lines in the project's voice.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Naming and voice_ — names are generated procedurally, with mock-Latin binomials derived from dominant traits (e.g. a large, slow lineage as a *Rotundus* form); naming is tied to mechanics where cheap. The humour register is wry and affectionate, never mean. British English. Pure and deterministic, so it can be unit-tested.

## Required changes

1. In `src/humour/names.ts`, derive a mock-Latin binomial for a species from its mean trait vector (map dominant traits to roots/affixes); deterministic for a given trait profile.
2. In `src/humour/milestones.ts`, rules that turn snapshot stats/events into short milestone and extinction lines in the restrained comedic voice, inventing no statistics absent from the input.
3. Add tests: distinct trait profiles yield distinct, deterministic names; a large/slow profile yields a suitably rotund name; milestone rules fire on their conditions and only use supplied figures.

## Do not implement

Do not implement:
- the AI narrator or any network calls (next prompt);
- rendering/UI wiring beyond exporting these functions.

## Acceptance criteria

The task is complete when:
- tests pass for naming determinism/mapping and milestone rules;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`022_names_and_milestones.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
