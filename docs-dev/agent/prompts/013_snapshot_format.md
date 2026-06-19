# Task: Render snapshot format and serialisation

## Goal

Define the compact render-snapshot typed-array format and serialise it from a `Simulation`, headlessly and testably.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

First Phase 2 prompt. Spec: _Data schemas → render snapshot_ — a compact typed array carrying, per visible agent, position, a species colour index, and a scale, plus a fixed-size header of aggregate statistics (population, births and deaths since the previous snapshot, species count, mean of each trait, current tick). This is the boundary the worker will post to the renderer; keep it pure so it can be unit-tested without a worker or DOM.

## Required changes

1. In `src/core/snapshot.ts`, define the layout: a fixed header (tick, population, births, deaths, species count, and the mean of each trait) followed by 4 floats per agent (x, y, species colour index, scale). Export the header length and per-agent stride as named constants, and a helper for the buffer length given an agent capacity.
2. Add `serialiseSnapshot(sim, out)` that writes the header and one record per live agent into the provided `Float32Array` and returns the number of agents written. Derive `scale` from the `size` trait and the colour index from `speciesId`. Allocate nothing.
3. Add tests: header fields match the simulation's aggregates; one record per live agent; trait means are correct; stable for a given simulation state.

## Do not implement

Do not implement:
- the Web Worker, the message protocol, or `postMessage`;
- any rendering, PixiJS, or DOM code.

## Acceptance criteria

The task is complete when:
- tests pass and the serialised header and records match the simulation;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`013_snapshot_format.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
