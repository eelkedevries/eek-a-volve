# Task: WASM predation/events/immigration + full step assembly (WASM core, increment 8)

## Goal

Port the remaining RNG passes — predation (`src/core/predation.ts`), catastrophes
(`src/core/events.ts`), and immigration (`src/core/bounds.ts`) — to the WASM core,
then assemble a single WASM `step()` that runs the whole hot loop in WASM, moving the
RNG state into wasm memory to remove the per-draw host-call overhead so the WASM core
is finally a performance win. Default off; TS fallback retained.

## Context

After 061–066 every per-tick pass exists in WASM but the RNG is still an imported
host function (a boundary crossing per draw). This step internalises the seeded RNG
(bit-identical: integer ops, with JSMath for `gaussian`) into the WASM core and
chains all passes into one exported `step`, so a tick crosses the JS/WASM boundary
once. Speciation/records/event-log reconciliation can stay in TS (they read the
shared snapshot) or move later.

## Required changes

1. Add WASM predation, events, and immigration passes, bit-identical to the TS ones
   (same grid use, RNG order, slot order).
2. Internalise the RNG into the WASM core (seeded identically); verify its sequence
   matches the TS `Rng` bit-for-bit.
3. Add an exported WASM `step()` chaining all passes; the worker calls it per tick
   when `wasmCore` is on. Keep the TS `step()` as the default and fallback.
4. Benchmark TS vs WASM core and record the result.

## Acceptance criteria

- Default run unchanged; existing tests green.
- With `wasmCore` on, a long full-run equivalence test stays **bit-for-bit**
  identical to the TS core across all features, and the WASM `step` is measurably
  faster than the TS `step` at large populations.
- `npm run build` and `npm test` pass.

## Checks

`npm run build`, `npm test`; long-run equivalence + a benchmark. If equivalence or a
real speed-up cannot be demonstrated, do not commit — report.

## Commit and push

If and only if scope is followed, the default path is unchanged, equivalence holds,
there is a measured speed-up, and checks pass, commit using this file's exact
filename (`067_wasm_assemble.md`), then push.

## Final report

End with the required final report specified in `AGENTS.md`.
