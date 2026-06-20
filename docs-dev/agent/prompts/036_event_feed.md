# Task: Event log and story feed

## Goal

Surface the world's drama as it happens: a stream of notable events (freak births, catastrophes, new species, mass die-offs) shown as a scrolling feed and fed to the narrator.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

The simulation already produces notable moments (freak mutations from `breed`, catastrophes from `events`, species changes from speciation, near-extinction) but discards most of them. Collect them in the core, post them from the worker, and show them — so the picture, the feed, and the narrator agree. Keep the core collection deterministic and testable.

## Required changes

1. In `src/core/eventlog.ts`, a bounded, reused event log the `Simulation` appends to each tick: freak mutant born (with id + position), catastrophe (kind, deaths), **species count rose** (approximate — clustering runs only every 60 ticks, so word it as "a new lineage" / count change, not a precisely named species), mass die-off, near-extinction. Capture the freak flag from reproduction (currently discarded) and tag it with the newborn's id (025).
2. Post drained events from the worker to the main thread (extend the protocol); do not block the simulation.
3. Add a `personalName(id)` generator to `src/humour/names.ts` (seeded by the stable id from 025) producing silly individual names ("Wigglethorpe", "Gary") — distinct from the species `binomial`. This is the relatability spine reused by 037/039.
4. In `src/ui/feed.ts`, a scrolling "story feed" of recent events in the project's voice (reuse `humour/milestones`), naming individuals via `personalName`; include a short **obituary** line when a notable creature dies (a freak, a record-holder, or an adopted creature) — e.g. "Gary, 2,140 ticks, 14 offspring — outlived three ice ages." Pass events to the narrator so its lines match.
4. Tests (core only): the log records a freak birth, a catastrophe, and a new-species event for known inputs; it is bounded and deterministic.

## Do not implement

Do not implement:
- the inspector, director, or records;
- per-event camera cuts (the director prompt).

## Acceptance criteria

The task is complete when:
- core tests pass for event capture, bounding, and determinism;
- events reach the UI feed and the narrator;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`036_event_feed.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
