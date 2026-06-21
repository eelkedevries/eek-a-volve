# Task: WASM spatial grid build (WASM core, increment 5)

> **Status note (post-063).** Executing 061–063 showed that `behaviour.step`
> (066) both *queries* the grid (via `onAgent`/`onFood`) and calls `breed`/
> `breedSexual` (065). So the grid query and mutation are only useful once
> behaviour itself runs in WASM — 064, 065 and 066 are **one interdependent
> behaviour-centric step**, not separable increments with standalone value. The
> hard techniques they need are already proven (shared zero-copy memory 061,
> shared food SoA + free-lists 062, the imported-RNG + counts-sync 063). The
> remaining work is therefore a single focused port: relocate the two grids into
> shared memory, add WASM neighbour-query + `breed` primitives, and port
> `behaviour.step` to AssemblyScript bit-identically (gated by the full-run
> equivalence test). It is large (~360 lines of intertwined, RNG-ordered logic)
> and best done as a dedicated effort. Prompts 064–066 should be executed
> together under that understanding; 067 then assembles the full step and
> internalises the RNG.

## Goal

Port the per-tick spatial-grid construction (`SpatialGrid.rebuildFromAgents` and the
food-grid rebuild, `src/core/grid.ts`) to the WASM core, operating on shared memory.
This is RNG-free and bit-identical, and is a prerequisite for the behaviour and
predation passes (which query neighbours). Default off; TS fallback retained.

## Context

The grid bins agents/food into cells by `floor(pos / cell)` — integer/floor maths,
bit-identical in WASM. The grid's backing arrays (cell starts, counts, the agent
index list) must live in the shared `WebAssembly.Memory` so a later WASM behaviour
pass can query them in place. Build on 061's shared memory.

## Required changes

1. Place the grid's backing arrays in shared memory under `wasmCore`.
2. Add a WASM grid-build kernel bit-identical to `rebuildFromAgents` (same cell
   assignment and ordering), plus a query primitive (cell range → indices) the later
   behaviour/predation passes will use.
3. Wire grid building behind `wasmCore`; keep the TS fallback. The grid is still
   consumed by TS behaviour/predation for now (they read the shared grid arrays), so
   results must match exactly.

## Acceptance criteria

- Default run unchanged; existing tests green.
- With `wasmCore` on, the WASM-built grid is identical to the TS grid (a unit test
  compares cell contents/order), and the full-run equivalence test stays bit-for-bit.
- `npm run build` and `npm test` pass.

## Checks

`npm run build`, `npm test`; a grid-equality unit test (same inputs → identical
buckets/order). Do not commit if the grids differ.

## Commit and push

If and only if scope is followed and checks pass, commit using this file's exact
filename (`064_wasm_grid.md`), then push.

## Final report

End with the required final report specified in `AGENTS.md`.
