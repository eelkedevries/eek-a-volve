# Task: Behaviour feedback effects

## Goal

Make each key behaviour unmistakable on screen: eating, hunting, fleeing, birth, and death each get a distinct visual cue.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

The snapshot now carries each agent's action/state (026) and births/deaths in the header. Turn those into transient effects so a viewer recognises what is happening, per the design (eat/hunt/flee/sex/birth/death tells). Effects ride a small pooled particle/sprite system in `render/`.

## Required changes

1. In `src/render/effects.ts`, a pooled effects layer with short-lived cues: an eating "munch" + crumb burst; a hunting lunge/chomp flash + splat; a fleeing dart; a mating/courting heart-sparkle; a birth sparkle/pop **plus a brief parent→newborn lineage line** (so "that one just had a baby" reads without opening the inspector); a death puff of smoke. The visible courtship *approach* is carried by the `COURTING` state (028); the heart-sparkle marks the moment they pair.
2. Drive cues from snapshot state: per-agent action (`EATING`, `HUNTING`, `FLEEING`, `COURTING`) spawns the matching cue at the agent; header births/deaths and the per-frame appearance/disappearance of agents drive birth/death cues at their last positions.
3. Pool all effect objects; allocate nothing per frame in the steady state; cap concurrent effects.

## Do not implement

Do not implement:
- screen shake, squash-and-stretch, trails, or sound (next prompt);
- emotes or the Elder crown (separate prompt).

## Acceptance criteria

The task is complete when:
- `npm run build` succeeds;
- the five behaviour cues are wired to snapshot state and pooled (no per-frame allocation in steady state).

## Checks

Run `npm run build` and `npm test`. (Rendering is not unit-tested; confirm visually in a browser.)

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`033_behaviour_fx.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
