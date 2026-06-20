# Task: Accessibility and quality controls

## Goal

Make it readable and comfortable for everyone, and keep it smooth on modest hardware.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Final polish of the fun overhaul: colour-blind-friendly species palettes, reduced-motion compliance, and a quality control so large/swarm runs stay smooth (the render layer must degrade gracefully).

## Required changes

1. Colour-blind-friendly species palettes (a selectable set) and ensure information is not conveyed by colour alone (shape/emote/label back it up).
2. Complete `prefers-reduced-motion` support across effects, juice, trails, shake, and the director's camera easing; expose a manual toggle too.
3. A quality/scale control: cap the number of detailed creatures and effects, fall back to simpler sprites or the particle layer when over budget, and let the simulation run larger than what is drawn (sample-render). Respect the ticks-per-frame cap already in the worker.
4. Confirm the production build stays clean (`scripts/check-public-build.sh dist`).

## Do not implement

Do not implement:
- new simulation systems or UI panels beyond these controls.

## Acceptance criteria

The task is complete when:
- `npm run build` succeeds and `scripts/check-public-build.sh dist` passes;
- palettes are colour-blind-friendly with non-colour backups; reduced-motion is honoured; the quality control caps detail and degrades gracefully.

## Checks

Run `npm run build`, `npm test`, and `bash scripts/check-public-build.sh dist`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`041_accessibility_and_quality.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
