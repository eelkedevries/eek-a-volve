# Task: internalise the RNG into the WASM core (further speed-up)

## Goal

Move the seeded RNG state into the WASM core and chain the per-tick passes into a
single exported `step()`, removing the per-draw and per-pass JS↔WASM boundary
crossings, for a larger speed-up than the current ~1.7×. Bit-for-bit equivalence and
the default-off principle are unchanged.

## Context

The WASM passes currently call the host's `Rng` through imports (`rngNext`/`rngInt`/
`rngGaussian`) — correct and shared, but a boundary crossing per draw. `Rng.next`/
`int` are pure integer ops (bit-identical in WASM); `gaussian` uses `sqrt` (native,
identical) plus `log`/`cos` (host imports for parity). Internalising means the WASM
core owns the single RNG stream, so any TS pass that still draws must call the
exported WASM RNG — simplest if 069 has already moved the optional RNG passes
(catastrophes, immigration, seasonal/biome regen) into WASM.

## Required changes

1. Port the `mulberry32` RNG (state in shared memory, seeded identically to
   `new Rng(seed)`); `next`/`int` fully internal, `gaussian` using host `log`/`cos`.
   Verify the WASM sequence matches the TS `Rng` bit-for-bit.
2. Make all WASM passes use the internal RNG; expose exported draw functions for any
   remaining TS callers (or require 069 first so there are none on the hot path).
3. Add an exported WASM `step()` chaining the passes (grid build can stay TS or move
   too); the worker calls it once per tick when `wasmCore` is on.
4. Re-benchmark TS vs WASM and record the new speed-up.

## Acceptance criteria

- Long full-run equivalence stays **bit-for-bit** identical to the TS core.
- The single-`step()` WASM path is measurably faster than the current per-pass path.
- Default path unchanged; `npm run build` and `npm test` pass.

## Checks

`npm run build`, `npm test`; an RNG-sequence parity test and a benchmark. Do not
commit if equivalence is not met or no further speed-up is shown.

## Final report

End with the required final report specified in `AGENTS.md`.
