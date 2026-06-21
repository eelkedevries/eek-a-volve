# Task: WASM food regeneration (WASM core, increment 4 — first RNG pass)

## Goal

Port food regeneration (`regenerateFood`, `src/core/food.ts`) — seasonally
modulated plant spawning — to the WASM core. This is the first ported pass that
draws from the simulation RNG, establishing the shared-stream technique for all
later RNG passes. Default off; TS fallback retained.

## Context (critical: one RNG stream)

Every RNG-using pass in a tick draws from the **same** `Rng` instance in sequence,
and `Rng.gaussian()` uses `Math.log/cos`. For a WASM pass to stay bit-identical and
not desynchronise the stream for the TS passes around it, it must draw from the
**same** stream and use the **same** transcendentals. Two mechanisms make this work:

- Import the JS `Rng.next()` into the wasm module (a host function), so the WASM
  pass advances the one shared stream at the right point.
- Compile the AS with `--use Math=JSMath` (or explicit `Math` imports) so `sin/cos/
  log` match JavaScript bit-for-bit.

## Required changes

1. Expose the simulation `Rng` to the wasm instance as imported `next()` (and any
   `int`/`gaussian` helpers, or build them in AS from imported `next`/Math).
2. Recompile the AS core with JSMath parity; add a WASM `regenerateFood` kernel
   bit-identical to the TS one (same season `sin`, same draw order, same `spawnFood`
   slot order), operating on the shared food columns.
3. Wire it into the loop behind `wasmCore`; keep the TS fallback.

## Acceptance criteria

- Default run unchanged; existing tests green.
- With `wasmCore` on (seasons on and off), the full-run equivalence test stays
  **bit-for-bit** identical to the TS core, including the post-food RNG passes
  (immigration), proving the shared stream stayed in sync.
- `npm run build` and `npm test` pass.

## Checks

`npm run build`, `npm test`; equivalence with `seasonAmplitude > 0`. A unit test
that the imported-RNG wasm draw sequence equals the TS `Rng` sequence. Do not commit
if the streams desynchronise.

## Commit and push

If and only if scope is followed and checks pass, commit using this file's exact
filename (`063_wasm_food_regen.md`), then push.

## Final report

End with the required final report specified in `AGENTS.md`.
