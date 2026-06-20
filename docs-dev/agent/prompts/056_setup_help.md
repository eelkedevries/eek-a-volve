# Task: parameter help on the setup screen

## Goal

Add concise help text for each pre-start parameter so the setup screen is
self-explanatory, including the newer knobs (pheromones, biome strength, sexual
reproduction) that are otherwise opaque.

## Scope

A pure UI change to the setup screen: a short description per parameter. Do not
change `core/`, the parameter set, or any default value.

## Context

`src/ui/setupScreen.ts` builds the form by iterating `DEFAULT_PARAMETERS`,
labelling each key via a `humanise()` helper, with preset cards above. The
parameter set is defined in `src/core/params.ts` (with doc comments per field).
The setup screen already supports initial params and a share link (045); keep
those working.

## Required changes

1. Add a concise, British-English help string for each `SimulationParameters`
   key (a small map in the setup module), phrased for a non-expert, covering the
   newer fields (`pheromones*`, `biomeStrength`, `sexualReproduction`,
   time-multiplier bounds, etc.).
2. Surface it per control without bloating the layout or causing page scrolling —
   e.g. a small "?" affordance with an accessible tooltip/`title`, or a short
   muted hint line per field. It must be keyboard- and screen-reader-accessible.
3. Keep the form behaviour intact: preset cards, view-mode sync, share-link
   prefill, and submit all unchanged.

## Do not implement

Do not implement:
- changes to parameters, defaults, ranges, or validation;
- per-parameter min/max enforcement in the form (out of scope here);
- help for runtime controls (this is the pre-start setup only).

## Acceptance criteria

The task is complete when:
- every parameter has a clear, accessible help string available on the setup
  screen, the newer knobs included;
- the layout still fits without page scrolling and presets/share-link prefill
  still work;
- no `core/` files changed;
- `npm run build` passes and `npm test` stays green.

## Checks

Run `npm run build` and `npm test`. UI need not be unit-tested; ensure the build
and existing tests pass.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`056_setup_help.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
