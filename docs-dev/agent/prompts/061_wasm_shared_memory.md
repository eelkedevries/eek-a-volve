# Task: zero-copy shared memory for the agent SoA (WASM core, increment 2)

## Goal

When the `wasmCore` capability is on, back the agent structure-of-arrays columns
with a single shared `WebAssembly.Memory` so the WASM metabolism kernel (and later
passes) operate on the world's data in place, with no per-tick copy. Default off:
the world allocates its own arrays exactly as today.

## Context

The metabolism kernel (060) currently copies eight columns into wasm memory and
back each tick (`src/wasm/metabolismCore.ts`). `World` (`src/core/world.ts`)
allocates each agent column as a fresh typed array in its constructor. AssemblyScript
reserves low linear memory for its stack/static data, so world columns must live
above a safe base (the kernel already uses `DATA_BASE = 1 << 16`).

## Required changes

1. Add an optional shared layout to `World`: a static helper computes the byte
   offsets of the agent columns (x, y, vx, vy, energy, age, speciesId, alive,
   action, id, parentId, generation, offspringCount, traits[*]) for a given
   `agentCapacity`, 4-byte-aligned, above a safe base; the constructor, when given a
   shared `ArrayBuffer`, allocates each agent column as a view over it instead of a
   fresh array. Food columns and free-lists stay as-is.
2. Have the WASM-core path create one `WebAssembly.Memory` sized for the agent SoA
   plus the kernel's death-scratch, build the `World` over it, and pass the world's
   real column offsets to the kernel's `run` (no copy in or out).
3. Keep the default path identical: no shared buffer → fresh arrays, byte-for-byte
   as today.

## Acceptance criteria

- Default run unchanged; all existing tests stay green.
- With `wasmCore` on, the metabolism kernel reads/writes the world's columns in
  place (no per-tick copy), and the full-run equivalence test (TS vs WASM core)
  still passes **bit-for-bit**.
- `npm run build` and `npm test` pass.

## Checks

`npm run build`, `npm test`. Extend the equivalence test to the zero-copy path. If
the layout cannot be made correct and equivalent, do not commit — report.

## Commit and push

If and only if scope is followed, the default path is unchanged, and checks pass,
commit on `main` using this file's exact filename (`061_wasm_shared_memory.md`),
then push. No partial/failing work.

## Final report

End with the required final report specified in `AGENTS.md`.
