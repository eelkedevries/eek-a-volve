# Task: PixiJS renderer

## Goal

Render agents and food from snapshots using PixiJS v8 with a particle container, coloured by species and scaled to the world.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Architecture (`render/`)_ and _Locked decisions_ — PixiJS v8; agents and food drawn through a particle container (the mechanism that makes large populations tractable); PixiJS selects WebGPU automatically and falls back to WebGL2 (no WebGPU-specific code). Consume the snapshot from 013/014. Research the current PixiJS v8 API before coding.

## Required changes

1. Add `pixi.js` (v8) as a dependency.
2. In `src/render/renderer.ts`, create a PixiJS `Application`, a particle container for agents and one for food, and a `draw(snapshot)` method that updates particle position, tint (from the species colour index), and scale (from the agent scale) for the live agents in the snapshot, fitting the world dimensions to the canvas.
3. Replace the temporary logging in `main.ts` with the renderer: feed each worker snapshot into `draw`, returning the buffer to the worker.
4. Remove the default Vite demo markup/assets so the page hosts the canvas.

## Do not implement

Do not implement:
- the setup screen, runtime controls, charts, or overlays beyond drawing agents/food;
- inter-snapshot interpolation (a later polish item);
- predation, speciation visuals, or the narrator.

## Acceptance criteria

The task is complete when:
- `pixi.js` is installed and `npm run build` succeeds;
- the renderer compiles against the snapshot format and is wired to the worker in `main.ts`;
- no default Vite demo content remains.

## Checks

Run `npm run build` and `npm test`. (Rendering is not unit-tested per the testing policy; visual confirmation is manual in a browser.)

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`015_pixi_renderer.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
