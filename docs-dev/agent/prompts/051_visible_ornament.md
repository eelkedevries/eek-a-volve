# Task: a visible ornament for the display trait

## Goal

Draw a small crest/plume on detailed creatures scaled by their `display` trait,
so the sexual-selection system added in 047 is legible — showy creatures look
showy.

## Scope

Append the `display` value to the per-agent render snapshot and render an
ornament cue from it. Do not change behaviour, energy, or any simulation rule;
this is render-only plus one appended snapshot field.

## Context

The render snapshot is append-only: per-agent fields live at fixed offsets with a
stride, and adding a field means appending it and bumping `AGENT_STRIDE`
(`src/core/snapshot.ts`: `A_X … A_SENSE`, `AGENT_STRIDE`; consumers read by these
exported constants). The `display` trait is genome index `DISPLAY` with range
`[0, 1]` (`src/core/genome.ts`). Detailed creatures are drawn genome-driven in
`src/render/creatureSprite.ts` (body from size, eyes from sense, maw from diet,
oriented by heading), used by `src/render/renderer.ts`. The haze layer is not
detailed and need not show the ornament.

## Required changes

1. Append `A_DISPLAY` to the per-agent snapshot record (incrementing
   `AGENT_STRIDE`), and write the normalised `display` value in
   `serialiseSnapshot` alongside the existing per-agent fields. All existing
   offsets must stay stable (append only).
2. Read `A_DISPLAY` in the renderer and pass it to the detailed creature draw.
3. In `creatureSprite.ts`, draw a subtle ornament (e.g. a crest or plume) whose
   size/prominence scales with `display`, placed so it does not obscure the
   existing eyes/maw cues; at `display` near 0 it is effectively absent.
4. Keep the ornament cheap and within the existing detail budget / LOD (only
   detailed creatures, not the haze), and respect reduced-motion (no added
   animation required).

## Do not implement

Do not implement:
- any behaviour, energy, or reproduction change;
- an ornament on the haze/particle layer;
- colour-by-display (may be added to 050's selector as a small follow-up);
- new per-agent fields beyond `display`.

## Acceptance criteria

The task is complete when:
- snapshot offsets remain consistent (a test asserts `AGENT_STRIDE` and
  `snapshotLength` follow from the appended field, and existing offsets are
  unchanged), and the snapshot determinism/format tests stay green;
- detailed creatures show a larger ornament for higher `display` and none for low
  `display`;
- `npm run build` passes and `npm test` stays green.

## Checks

Run `npm run build` and `npm test`. Extend the snapshot test to cover the new
`A_DISPLAY` field and stride; render need not be unit-tested.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`051_visible_ornament.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
