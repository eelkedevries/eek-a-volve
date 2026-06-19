# Task: Simulation Web Worker and message protocol

## Goal

Run the simulation in a Web Worker behind a typed message protocol, posting snapshots to the main thread via transferable ping-pong buffers.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Architecture (`worker/`)_ and _Locked decisions_ — the worker owns all simulation state and runs the fixed-timestep loop; communication uses transferable typed arrays (two buffers ping-ponged), not `SharedArrayBuffer`. No rendering here; verify by logging or reading scalars from the received snapshot header.

## Required changes

1. In `src/worker/protocol.ts`, define the message types between main thread and worker: init (parameters), start, pause, set time multiplier, reset; and the worker→main snapshot message carrying a transferred buffer.
2. In `src/worker/simulationWorker.ts`, a module worker that owns a `Simulation`, advances it on a fixed cadence (ticks per posted snapshot governed by the multiplier, with a hard cap on ticks per snapshot), serialises into one of two buffers via `serialiseSnapshot`, and posts it transferring ownership; it reuses the buffer returned by the main thread (ping-pong).
3. In `src/worker/client.ts`, a main-thread client that constructs the worker (`new Worker(new URL(...), { type: 'module' })`), sends control messages, and invokes a callback with each snapshot, returning the buffer to the worker.
4. Wire `main.ts` to start a run from `DEFAULT_PARAMETERS` and log header stats from a few snapshots (temporary, replaced by rendering in Phase 3).

## Do not implement

Do not implement:
- PixiJS or any rendering;
- the setup screen or runtime UI controls;
- `SharedArrayBuffer` or cross-origin isolation.

## Acceptance criteria

The task is complete when:
- `npm run build` succeeds (worker bundles under Vite);
- the protocol types are shared by worker and client;
- snapshot buffers are transferred and ping-ponged (no per-snapshot allocation in the steady state).

## Checks

Run `npm run build` and `npm test`. (The worker is integration glue; correctness of serialisation is covered by 013's tests.)

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`014_simulation_worker.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
