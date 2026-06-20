# Task: narrator awareness of the new systems

## Goal

Let the narrator notice the dynamics added since it was written — ornamentation
(sexual selection), biomes, and pheromone trails — using only real figures, so
its commentary reflects what is actually happening.

## Scope

Enrich the narrator summary and templated fallback with a few real aggregates.
Do not change the narrator's transport, rate limiting, or the rule that it never
invents statistics; do not add a worker protocol change beyond passing values
already computed.

## Context

The narrator consumes a compact, factual summary (`src/narrator/summary.ts`,
`NarratorStats`) and degrades to templated lines (`src/narrator/templates.ts`);
it must not state anything absent from the supplied stats (specification: Naming
and voice). The render snapshot header already carries the per-trait means
(`H_TRAIT_MEANS`, `TRAIT_COUNT`) — now including `display` and `matePreference`
(047) — and `main.ts` builds the stats each summary. Biome strength and the
pheromone toggle are known parameters on the main thread; the event feed already
surfaces notable moments.

## Required changes

1. Extend `NarratorStats` with a few optional, real fields: the mean `display`
   (ornament level, from the trait means), whether sexual reproduction is on, and
   environment flags (biomes active / pheromones active, from the parameters).
   Populate them in `main.ts` from data already available — no invented numbers.
2. Update `summarise()` to add at most one or two short, optional clauses when
   these are present (e.g. an ornament note when sexual selection is on, or an
   environment note when biomes/pheromones are active), keeping the wry,
   documentary register and staying within the supplied facts.
3. Update the templated fallback (`templates.ts`) similarly so the offline voice
   also reflects them.
4. Keep determinism and purity of `summarise`/templates (no I/O, no platform
   randomness on the summary path).

## Do not implement

Do not implement:
- any new worker→main protocol field that isn't already computed;
- narrator transport, model, or rate-limit changes;
- statistics the snapshot/params do not actually provide.

## Acceptance criteria

The task is complete when:
- with sexual reproduction on, the summary/fallback can mention the ornament
  level; with biomes or pheromones on, it can mention the environment — all from
  real values, and omitted when not applicable;
- the "never invent stats" property holds (only supplied fields are used);
- existing narrator tests stay green and a test covers the new optional clauses
  (present when supplied, absent otherwise);
- `npm run build` passes and `npm test` stays green.

## Checks

Run `npm run build` and `npm test`. Extend the narrator/summary tests for the new
optional fields.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`054_narrator_awareness.md`) as the
commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
