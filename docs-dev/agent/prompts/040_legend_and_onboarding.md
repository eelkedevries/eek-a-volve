# Task: Legend and onboarding

## Goal

Teach the viewer the visual vocabulary so the behaviours actually read: what the emotes, shapes, colours, and effects mean.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Recognisability needs a shared vocabulary. A small, dismissible legend turns "what is that dot doing" into "ah, it's hungry and hunting". Build on the emotes (034), shapes (031), and effects (033) already defined.

## Required changes

1. In `src/ui/legend.ts`, a collapsible legend keying the vocabulary: the emotes (hungry/scared/amorous/Elder), what body shape/eye-size/teeth mean (size, sense radius, diet), species colours, and the behaviour cues (eat/hunt/flee/mate/birth/death).
2. A brief first-run onboarding hint (dismissible, remembered in `localStorage`) pointing at the legend and the controls.
3. Keep it lightweight and out of the way; reachable any time from a control.

## Do not implement

Do not implement:
- a full tutorial or guided tour;
- accessibility palette work (next prompt).

## Acceptance criteria

The task is complete when:
- `npm run build` succeeds;
- the legend explains the live vocabulary and the onboarding hint shows once and is dismissible.

## Checks

Run `npm run build` and `npm test`. (UI is not unit-tested; confirm visually in a browser.)

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`040_legend_and_onboarding.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
