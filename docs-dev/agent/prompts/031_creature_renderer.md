# Task: Detailed creature rendering

## Goal

Draw creatures that look like creatures — body shape, fatness, eyes, and a facing direction read from the genome — plus food, so the world is legible.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

The current renderer draws identical tinted circles via a `ParticleContainer`. Add a detailed layer (a `Container` of per-creature display objects) driven by the expanded snapshot (026): position, heading, scale, colour, life stage, and action. Appearance from genome is what makes individuals trackable (the lesson from The Bibites). Research the relevant PixiJS v8 API before coding.

## Required changes

1. In `src/render/creatureSprite.ts`, build a creature display object whose form reads the snapshot/genome-derived fields: body size from scale, fatness/roundness from size, **eye size from sense radius**, a **clear maw/teeth for high diet (carnivore) — a required, non-colour role cue so role survives the colour-blind palettes in 041**, softer body for low diet, tint from species colour, and the whole thing oriented to `heading`. Juveniles render smaller (life stage).
2. In `src/render/renderer.ts`, maintain a pooled set of these creature objects for visible agents (reuse across frames, hide surplus), updated each snapshot. Draw food as simple sprites distinguished by type (plant vs carrion).
3. Keep the existing `ParticleContainer` available for the swarm strategy (used by the LOD prompt); in community mode use the detailed layer.
4. Remove or hide the plain-circle look in community mode.

## Do not implement

Do not implement:
- the camera, LOD switching, or culling (next prompt);
- behaviour FX, emotes, sound, or animation beyond static facing/scale.

## Acceptance criteria

The task is complete when:
- `npm run build` succeeds with the detailed renderer wired to the snapshot;
- creatures are oriented by heading and shaped by genome-derived fields; food is drawn by type.

## Checks

Run `npm run build` and `npm test`. (Rendering is not unit-tested; confirm visually in a browser.)

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`031_creature_renderer.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
