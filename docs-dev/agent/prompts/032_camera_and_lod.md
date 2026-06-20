# Task: Camera and level-of-detail

## Goal

Let the viewer pan, zoom, and follow a creature, and keep large populations performant by switching detail with zoom.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

With detailed creatures (031), a static full-world view is too small to read and too heavy at scale. Add a camera over the Pixi stage and a level-of-detail rule keyed to `viewMode` (030) and zoom.

## Required changes

1. In `src/render/camera.ts`, implement pan (drag), zoom (wheel/pinch), fit-to-world, and follow-a-target (centre on a chosen agent index each frame); apply it as the stage transform.
2. LOD: in **swarm** mode draw the `ParticleContainer` haze when zoomed out and switch the on-screen subset to detailed creatures when zoomed in; in **community** mode always draw detailed creatures. Cull off-screen creatures and cap the number of detailed objects.
3. Click/tap selects the agent under the cursor and exposes the selected index (for follow and, later, the inspector).
4. Wire camera + LOD into `renderer.ts`/`main.ts`.

## Do not implement

Do not implement:
- the inspector panel or the auto-director (later prompts) — only expose the selected index and a follow API;
- behaviour FX, emotes, or sound.

## Acceptance criteria

The task is complete when:
- `npm run build` succeeds;
- pan/zoom/fit/follow work and selection exposes an index; swarm LOD switches with zoom and community stays detailed.

## Checks

Run `npm run build` and `npm test`. (Rendering is not unit-tested; confirm visually in a browser.)

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`032_camera_and_lod.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
