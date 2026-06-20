# Task: Auto-director

## Goal

Make a long unattended run watchable: a "director" that cuts the camera to whatever is most interesting — a hunt, a birth wave, a freak mutant, a catastrophe.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Build on the camera/follow (032) and the event stream (036). The director is a main-thread policy that scores recent events and the current state, picks a subject, and eases the camera to it — like a nature-documentary editor. It is optional and yields immediately to manual camera control.

## Required changes

1. In `src/render/director.ts`, score candidate subjects from the event stream and state (a catastrophe location, a freak mutant, a cluster of hunts or births, a record-holder/Elder) and ease the camera to the top subject, holding briefly before reconsidering. **Pin a small nameplate** (`personalName`) on the spotlighted subject while it holds, so statistics become a named character.
2. A toggle to enable/disable the director; any manual pan/zoom/adopt suspends it for a while, then it may resume.
3. Wire it into `main.ts` alongside the camera; keep cuts smooth (eased), not jarring.

## Do not implement

Do not implement:
- records/hall of fame or the legend;
- new event types (use the existing stream).

## Acceptance criteria

The task is complete when:
- `npm run build` succeeds;
- the director eases to scored subjects, can be toggled, and yields to manual control.

## Checks

Run `npm run build` and `npm test`. (Rendering is not unit-tested; confirm visually in a browser.)

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`038_director.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
