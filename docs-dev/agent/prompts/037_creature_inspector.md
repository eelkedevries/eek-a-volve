# Task: Creature inspector and adopt/follow

## Goal

Let the viewer click a creature to meet it — its name, kind, traits, age, energy, and what it's doing — and adopt it so the camera follows its life.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Selection already exposes an agent index (032). Add a worker request/response so the main thread can pull a chosen creature's full detail on demand (the snapshot only carries visible-render fields), show it in a panel, and follow it with the camera. Protagonists are what make a long run worth watching.

## Required changes

1. Extend the worker protocol with an **inspect-by-stable-`id`** request (not slot — slots recycle) and a reply carrying that creature's full state: `personalName(id)` + binomial, genome traits, age + life stage, energy (and capacity), species id, current action, and lineage from the `generation`/`offspringCount` columns (025). Reply each snapshot while a creature is adopted, so the panel stays live; if the id is no longer alive, report that it has died (and clear).
2. In `src/ui/inspector.ts`, a panel showing the creature's procedural name + mock-Latin binomial (`humour/names`), a trait read-out, age/stage, an energy bar, and a plain-English current action ("Wigglethorpe is hunting"). An "Adopt" button follows it with the camera; clicking empty space or its death clears it.
3. Track births of an adopted creature's offspring lightly so the panel can show a lineage count.

## Do not implement

Do not implement:
- the auto-director or records;
- editing a creature.

## Acceptance criteria

The task is complete when:
- `npm run build` succeeds;
- clicking a creature shows its live detail; Adopt follows it; its death clears the panel.

## Checks

Run `npm run build` and `npm test`. (UI is not unit-tested; confirm visually in a browser.)

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`037_creature_inspector.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
