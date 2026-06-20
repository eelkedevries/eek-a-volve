# Task: Community and swarm view modes

## Goal

Offer two ways to watch: an intimate "community" (few, detailed creatures) and a "swarm" (many agents with level-of-detail), chosen before start.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Recognisability wants a handful of detailed creatures; scale wants thousands. Rather than choose, expose a mode that sets the population scale and tells the renderer which strategy to use. Later rendering prompts read this mode.

## Required changes

1. Add a `viewMode` parameter (`community` | `swarm`) to `SimulationParameters` (default `community`). **Leave `DEFAULT_PARAMETERS` population/world size unchanged** so the 012 stability test is unaffected; apply mode-appropriate `initialPopulation`/world overrides in the setup screen when the user picks a mode, not in the default object.
2. Add a setup-screen control to choose the mode; ensure the chosen mode flows through to the worker and is readable on the main thread for the renderer.
3. Keep the simulation laws identical in both modes — only population scale and the render strategy differ.
4. Tests: defaults are valid for both modes; a community run and a swarm run both stay within population bounds over a short run; determinism holds per mode.

## Do not implement

Do not implement:
- the detailed renderer or LOD itself (next prompts) — only the mode plumbing;
- per-mode law changes.

## Acceptance criteria

The task is complete when:
- tests pass for both modes' defaults and bounded population;
- the mode is selectable in setup and reaches the renderer;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`030_view_modes.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
