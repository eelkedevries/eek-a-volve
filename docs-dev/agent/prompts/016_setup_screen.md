# Task: Pre-start setup screen

## Goal

Add the pre-start screen that lets the user configure the parameter set and start a run.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Scope_ — the user configures parameters before starting; after starting, only the time multiplier and pause change. Build a plain-DOM form (no framework) over the `SimulationParameters` object; on start, hand the parameters to the worker client and reveal the canvas.

## Required changes

1. In `src/ui/setupScreen.ts`, render a form with inputs for the `SimulationParameters` fields (sensible ranges/steps, seeded from `DEFAULT_PARAMETERS`), a seed field, and a Start button. British-English labels.
2. On Start, read the form into a `SimulationParameters` object and invoke a provided callback; hide the setup screen and show the simulation.
3. Wire `main.ts` so the app opens on the setup screen and starts the worker + renderer with the chosen parameters.
4. Minimal styling so the form is legible.

## Do not implement

Do not implement:
- runtime controls (pause/speed/reset) — the next prompt;
- charts, toasts, or the narrator;
- changing parameters after start.

## Acceptance criteria

The task is complete when:
- `npm run build` succeeds;
- the app boots to a setup form and starts a run from the chosen parameters;
- no parameter is editable after start.

## Checks

Run `npm run build` and `npm test`. (UI is not unit-tested; visual confirmation is manual.)

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`016_setup_screen.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
