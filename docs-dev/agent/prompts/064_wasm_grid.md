# Task: WASM spatial grid build (WASM core, increment 5)

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
