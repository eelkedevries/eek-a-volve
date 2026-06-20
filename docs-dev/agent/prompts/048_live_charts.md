# Task: live time-series charts (population, species, trait means)

## Goal

Add a small live charts view that plots population, species count, and a couple
of trait means over time, so a long run's adaptation is observable at a glance —
the core purpose of the simulator.

## Scope

Implement only a main-thread charts UI fed from the snapshots already arriving.
Do not change `core/` or the worker protocol, and do not add historical storage
to the worker. Keep it to a bounded, downsampled in-memory history on the main
thread.

## Context

The render snapshot header already carries, per snapshot, the current tick,
population, births, deaths, species count, and the per-trait means
(`src/core/snapshot.ts`: `H_TICK`, `H_POPULATION`, `H_SPECIES_COUNT`,
`H_TRAIT_MEANS`, `TRAIT_COUNT`). `src/main.ts` already reads these for the dock
stats each frame. The UI is a single fixed-height dock with popovers above it
(records 🏆, legend 🛈); follow that pattern. The earlier standalone chart was
removed during the single-toolbar consolidation, so this restores a spec'd
capability (`ui/` — "live charts") without re-introducing page scrolling.

## Required changes

1. Add `src/ui/charts.ts` exporting a `createCharts()` that returns an element
   plus a `push(stats)` method. It keeps a bounded, downsampled ring buffer of
   recent samples (tick, population, species count, selected trait means) and
   draws them to a 2D `<canvas>` (not PixiJS): population and species count as
   lines on a shared time axis, with a compact legend and current values.
2. Mount it as a popover above the dock, opened from a new toolbar button
   (mirror the records/legend popover wiring in `src/main.ts` /
   `src/ui/dock.ts`). Only one popover open at a time, consistent with the
   existing ones.
3. Feed `push(...)` from the per-snapshot stats already computed in `main.ts`.
   Sample at a throttled cadence (not every frame) and cap history length so
   memory stays bounded over a multi-day run.
4. Respect the existing reduced-motion / quality affordances where relevant (the
   chart redraw must be cheap and must not run when the popover is hidden).

## Do not implement

Do not implement:
- worker-side history, persistence, or any protocol change;
- per-agent trait histograms (a later prompt) — means only here;
- CSV/image export;
- any post-start control over the simulation.

## Acceptance criteria

The task is complete when:
- opening the charts popover during a run shows population and species count
  trending over time, updating live, and closing it stops the redraw;
- history is bounded (no unbounded growth) and sampling is throttled;
- no `core/` or worker/protocol files changed;
- `npm run build` passes and `npm test` stays green.

## Checks

Run `npm run build` and `npm test`. (Rendering/UI need not be unit-tested per the
testing policy; ensure the build and existing tests pass.)

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`048_live_charts.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
