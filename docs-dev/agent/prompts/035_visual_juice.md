# Task: Visual juice

## Goal

Add the layer of "game feel" that makes events satisfying — squash-and-stretch, flashes, motion trails, and restrained screen shake — all echoing real events.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Juice should echo the core gameplay, not be random (the Vlambeer/"juice it or lose it" lesson). Build on the detailed renderer (031), effects (033), and emotes (034). Respect accessibility from the start. Sound is a separate prompt (042).

## Required changes

1. Movement/impact feel: squash-and-stretch on eating and birth; a brief colour flash on a hunt kill and on damage; speed-driven motion trails for fast-moving creatures — all pooled, no per-frame allocation in the steady state.
2. Restrained **screen shake** on catastrophes and mass-death moments only (driven by catastrophe events / large per-frame death counts), with a hard amplitude cap.
3. Honour `prefers-reduced-motion`: when set (or when a manual "reduce motion" toggle is on), disable shake, trails, and flashing; keep the simulation and plain rendering intact.

## Do not implement

Do not implement:
- sound (prompt 042), the inspector, director, records, or charts.

## Acceptance criteria

The task is complete when:
- `npm run build` succeeds;
- juice effects are pooled and tied to real events; shake is capped and catastrophe-only; reduced-motion disables motion effects.

## Checks

Run `npm run build` and `npm test`. (Rendering is not unit-tested; confirm visually in a browser.)

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`035_visual_juice.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
