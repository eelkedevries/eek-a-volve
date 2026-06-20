# Task: a minimap for navigating large worlds

## Goal

Add a small minimap showing the whole world — agent positions as dots and the
camera's current viewport as a rectangle — with click/drag to recentre the
camera, so the big swarm world is navigable.

## Scope

Implement a main-thread minimap fed from the render snapshot, driving the
existing camera. Do not change `core/` or the worker protocol.

## Context

The renderer owns a pan/zoom/fit/follow camera (`src/render/camera.ts`,
`src/render/renderer.ts`) over a world of known dimensions (passed to `init`).
The snapshot carries per-agent positions (`A_X`, `A_Y`) and the live agent count;
`main.ts` already iterates agents each frame. The UI is the single dock with
corner-anchored elements; the minimap should be a small fixed overlay that does
not push the layout or add page scrolling.

## Required changes

1. Add `src/ui/minimap.ts` exporting a `createMinimap(worldWidth, worldHeight)`
   that returns an element and an `update(view, count, camera)` method drawing to
   a small 2D `<canvas>`: agents as faint dots (downsampled/capped for large
   populations) and the camera viewport as a rectangle.
2. Expose the camera's current world-space viewport bounds from the renderer (a
   getter) so the minimap can draw the rectangle, and a method to recentre the
   camera on a world point.
3. Wire pointer input on the minimap (click and drag) to recentre the camera via
   that method. Feed `update(...)` from the per-frame snapshot in `main.ts`,
   throttled and capped so it stays cheap for swarm-scale populations.
4. Anchor it unobtrusively (e.g. a corner), hideable, and respect quality/reduced-
   motion (cheap redraw, skip when hidden).

## Do not implement

Do not implement:
- a second render of detailed creatures (dots only);
- selection/adopt from the minimap (camera recentre only);
- any `core/` or worker/protocol change.

## Acceptance criteria

The task is complete when:
- the minimap shows the population and a viewport rectangle that tracks panning
  and zooming, and clicking/dragging recentres the main camera;
- it stays cheap at swarm scale (downsampled/capped) and does nothing while
  hidden;
- no `core/` or worker/protocol files changed;
- `npm run build` passes and `npm test` stays green.

## Checks

Run `npm run build` and `npm test`. UI/render need not be unit-tested; ensure the
build and existing tests pass.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`055_minimap.md`) as the commit message,
then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
