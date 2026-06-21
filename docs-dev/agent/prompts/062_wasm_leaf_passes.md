# Task: WASM carrion-decay and pheromone passes (WASM core, increment 3)

## Goal

Port the two RNG-free per-tick passes — carrion decay (`decayCarrion`) and, when
enabled, pheromone-field decay/diffusion (`PheromoneField.step`) — to the WASM core,
operating on shared memory. Default off; TS fallback retained.

## Context

These passes use only arithmetic and integer ops (no RNG, no transcendentals), so
they are **bit-identical** in WASM. They build on 061's shared memory. The
pheromone field is a separate grid (`src/core/pheromone.ts`); to share it it must
also live in the shared `WebAssembly.Memory` when `wasmCore` is on.

## Required changes

1. Add WASM kernels for carrion decay and pheromone decay/diffusion (extend
   `src/wasm/metabolism.as.ts` or add a sibling `.as.ts`), bit-identical to the TS
   versions (same operation order and reap/slot side-effect order).
2. Place the food columns and the pheromone field in shared memory under `wasmCore`
   so the kernels work in place; keep TS fallbacks.
3. Wire both into the loop behind the existing `wasmCore` branch.

## Acceptance criteria

- Default run unchanged; existing tests green.
- With `wasmCore` on, the full-run equivalence test (with carrion and pheromones
  active) stays **bit-for-bit** identical to the TS core.
- `npm run build` and `npm test` pass.

## Checks

`npm run build`, `npm test`; extend the equivalence test to enable pheromones and
exercise carrion. Do not commit if equivalence is not met.

## Commit and push

If and only if scope is followed and checks pass, commit using this file's exact
filename (`062_wasm_leaf_passes.md`), then push.

## Final report

End with the required final report specified in `AGENTS.md`.
