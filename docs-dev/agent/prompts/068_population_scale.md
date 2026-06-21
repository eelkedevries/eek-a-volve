# Task: configurable population ceiling ("large world" mode)

## Goal

Make the hard-coded `MAX_POPULATION` (2000) a configurable parameter so larger
ecosystems are possible — which is what turns the WASM core's ~1.7× speed-up into
usable headroom. The default stays 2000, so existing runs are unchanged.

## Why

`MAX_POPULATION` is currently a compile-time constant in `src/core/bounds.ts`,
used as the agent capacity for the world, the spatial grid, the behaviour buffers,
the snapshot buffers (`src/worker/`), and the WASM-core memory sizing. The TS core
already handles 2000 comfortably and the WASM core is faster still, but the cap
prevents using that headroom.

## Required changes

1. Add a `maxPopulation` parameter to `SimulationParameters` / `DEFAULT_PARAMETERS`
   (default 2000) with a sensible clamp in the share codec (`NUMERIC_BOUNDS`).
2. Thread it as the agent capacity everywhere `MAX_POPULATION` is read: the `World`,
   both spatial grids, the `Behaviour` buffers, the WASM core (`createWasmCore`), and
   the worker's snapshot buffer sizing (`snapshotLength(params.maxPopulation, …)`).
   Keep `MAX_POPULATION` as the default value of the new parameter.
3. Surface it in the setup screen with help text, and verify the renderer's LOD/
   detail budget and culling already cope with larger counts (they are count-driven).
4. Confirm the population-stability guarantee on the **default** (2000) is untouched.

## Acceptance criteria

- Default run (maxPopulation 2000) is byte-for-byte unchanged; the 012 stability and
  determinism tests stay green, and the WASM-core equivalence test still passes.
- A run with a higher `maxPopulation` is deterministic, stays within its own ceiling,
  and renders; snapshot buffers and the WASM memory size from the parameter.
- `npm run build` and `npm test` pass. Add a core test that the world/grids/snapshot
  size from `maxPopulation` and a higher cap runs deterministically.

## Checks

`npm run build`, `npm test`. Commit on `main` using this filename
(`068_population_scale.md`) only if scope is followed and checks pass.

## Final report

End with the required final report specified in `AGENTS.md`.
