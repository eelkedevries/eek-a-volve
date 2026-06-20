# Task: colour creatures by trait, not just species

## Goal

Add a colour mode that recolours creatures by a chosen trait (diet, size, or
sense radius) along a ramp, instead of by species, so spatial and trait
structure is visible at a glance.

## Scope

Implement only a render-side colour mode plus a UI selector, using per-agent
fields already in the snapshot. Do not add new snapshot fields and do not change
`core/`.

## Context

The render snapshot already carries, per agent, a species colour index
(`A_COLOUR`), scale/size (`A_SCALE`), and the normalised diet and sense values
(`A_DIET`, `A_SENSE`) in `src/core/snapshot.ts`. The renderer currently colours
both the haze particles and the detailed creatures from `palette[speciesId]`
(`src/render/renderer.ts`, with palettes and `setPalette`). Size is already
available as `A_SCALE`; its trait range is in `src/core/genome.ts`
(`TRAIT_RANGES`) for normalisation.

## Required changes

1. Add a colour mode to the renderer: `species` (current behaviour, the default)
   or a trait ramp over `diet`, `size`, or `sense`, computed from the per-agent
   snapshot fields. Map the normalised trait value through a clear, colour-blind-
   friendly ramp; apply it to both the haze particles and the detailed creatures.
2. Keep species mode pixel-identical to today (same palette path) so nothing
   regresses when the mode is `species`.
3. Add a UI selector in the dock controls to choose the colour mode, and a short
   legend note of the active ramp. Default to `species`.
4. Ensure role/behaviour cues that currently rely on shape (maw, eyes, crown,
   emotes) are unaffected — only the body colour changes.

## Do not implement

Do not implement:
- new snapshot fields or a `core/` change (use diet/size/sense already present);
- colouring by `display` (depends on the ornament snapshot field added in 051;
  it may be added there or in a follow-up);
- per-trait histograms or charts (separate prompts).

## Acceptance criteria

The task is complete when:
- switching colour mode recolours the population live by the chosen trait, and
  `species` mode is unchanged from today;
- the colour-blind-safe palette path and reduced-motion/quality settings still
  work;
- no `core/` or worker/protocol files changed;
- `npm run build` passes and `npm test` stays green.

## Checks

Run `npm run build` and `npm test`. UI/render need not be unit-tested; ensure the
build and existing tests pass.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`050_colour_by_trait.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
