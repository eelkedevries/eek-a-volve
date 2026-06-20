# Task: fertility and pheromone field overlays

## Goal

Let the player toggle faint heatmap overlays for the two invisible fields —
the static fertility/biome map and the live pheromone trails — so the systems
added in 043 and 046 can actually be seen.

## Scope

Implement a render overlay for the fertility field (recomputed on the main
thread) and for the pheromone field (fed from the worker only while the overlay
is on), plus a UI toggle cycling off → fertility → pheromone. Do not add a
third channel, editing, or any post-start simulation control.

## Context

The fertility field is a pure, deterministic function on the main thread already
(`src/core/biome.ts` `fertilityAt`), and the renderer already draws a faint
static fertility tint at init (`src/render/renderer.ts`). The pheromone field is
dynamic and lives in the worker (`src/core/pheromone.ts`, owned by
`Simulation`); it is **not** in the render snapshot. The worker protocol is
`src/worker/protocol.ts`; the renderer owns the world container and camera.
Posting a full per-cell field every frame would be wasteful, so the pheromone
overlay must be opt-in and downsampled.

## Required changes

1. Add a render overlay layer to `src/render/renderer.ts` that can draw a coarse
   heatmap aligned to world coordinates, beneath the creatures, with low opacity
   (respecting quality / reduced-motion). Provide methods to set its mode
   (off / fertility / pheromone) and to update its data.
2. Fertility mode: build the heatmap from `fertilityAt` using the run's seed and
   dimensions (already passed to `init`). Static; rebuild only on mode change.
3. Pheromone mode: add a throttled worker→main `field` message carrying a
   downsampled copy of the pheromone grid (a transferable `Float32Array` plus its
   dimensions), and a main→worker message to enable/disable it. The worker only
   samples and posts the field while the overlay is enabled, at render cadence or
   slower. The renderer maps values to opacity for the heatmap.
4. Add a UI control (in the dock controls) that cycles the overlay mode and
   sends the enable/disable message; default off so nothing changes unless asked.

## Do not implement

Do not implement:
- a third field or per-agent overlays;
- always-on field posting (must be gated by the toggle);
- any editing of the fields or other post-start control;
- a legend redesign beyond a small label for the active overlay.

## Acceptance criteria

The task is complete when:
- toggling to fertility shows a faint map matching the biome tint, and to
  pheromone shows trails forming where creatures feed (in a preset with
  pheromones on), and off removes the overlay;
- the pheromone field is posted only while its overlay is active, throttled and
  downsampled (no per-frame full-grid traffic otherwise);
- determinism and the per-tick allocation budget in `core/` are unaffected
  (the worker copies into a reused buffer);
- `npm run build` passes and `npm test` stays green.

## Checks

Run `npm run build` and `npm test`. If a small core/worker helper is added for
downsampling, add a focused test for it; UI/render need not be unit-tested.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`049_field_overlays.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
