# Task: State emotes, starvation tell, and elders

## Goal

Surface each creature's inner state at a glance — hungry, scared, amorous, starving, old — so the swarm reads like characters.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Emotes are the cheapest, strongest relatability lever (anthropomorphism via faces/state). Drive them from the snapshot's per-agent `stateCode` (action + life stage) and `energyFraction` (026), shown only for creatures large enough on screen to read (use the camera zoom from 032).

## Required changes

1. In `src/render/emotes.ts`, small icons above creatures from state: hungry (low `energyFraction`) `…`, scared (`FLEEING`) `!`, amorous (`COURTING`) `♥`.
2. A **starvation tell with no emote**: desaturate / lower body alpha as `energyFraction` falls toward zero, so "this one is starving" reads across the whole view and reinforces death anticipation. It is a static tint (reduced-motion safe).
3. A small crown on `ELDER`-stage creatures (from the stateCode life stage). The single reigning "Elder" title is owned by the records prompt (039); here, just mark elders.
4. Only render emotes/crowns above a zoom/size threshold so they do not clutter the swarm view; pool all emote objects (no per-frame allocation in steady state).

## Do not implement

Do not implement:
- the inspector, narrator, event feed, or sound;
- the "reigning Elder" record (prompt 039).

## Acceptance criteria

The task is complete when:
- `npm run build` succeeds;
- emotes and the starvation tint reflect snapshot state, elders are crowned, and emotes are hidden when zoomed out.

## Checks

Run `npm run build` and `npm test`. (Rendering is not unit-tested; confirm visually in a browser.)

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`034_emotes_and_elder.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
