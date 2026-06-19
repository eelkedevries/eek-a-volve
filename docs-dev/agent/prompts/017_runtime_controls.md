# Task: Runtime controls

## Goal

Add the only post-start controls: time multiplier, pause/resume, and reset.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Scope_ and _Architecture (`ui/`)_ — after a run starts, only the time multiplier and pause are adjustable; reset returns to the setup screen. The multiplier maps to ticks per rendered frame within the configured bounds; drive it through the worker protocol from 014.

## Required changes

1. In `src/ui/controls.ts`, render a control bar: a pause/resume toggle, a time-multiplier control bounded by `minTimeMultiplier`/`maxTimeMultiplier`, and a reset button.
2. Send pause, resume, and set-multiplier messages to the worker client; reset stops the run and returns to the setup screen.
3. Wire the controls into `main.ts` alongside the renderer.

## Do not implement

Do not implement:
- editing simulation parameters after start (only multiplier and pause may change);
- charts, toasts, or the narrator.

## Acceptance criteria

The task is complete when:
- `npm run build` succeeds;
- pause/resume, the multiplier, and reset drive the worker;
- no parameter other than the multiplier/pause changes mid-run.

## Checks

Run `npm run build` and `npm test`. (UI is not unit-tested; visual confirmation is manual.)

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`017_runtime_controls.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
