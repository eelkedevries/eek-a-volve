# Task: shared food SoA + WASM carrion decay (WASM core, increment 3)

## Goal

Place the food structure-of-arrays in the shared memory and port carrion decay
(`decayCarrion`) to the WASM core, operating in place. Default off; TS fallback.

## Scope adjustment (from 061's learning)

061 showed each pass needs its state in the shared buffer, and the path to the
high-value behaviour pass (066) runs through the food SoA (eating, births,
regrowth) — not the pheromone field, which is optional and off that path. So this
increment puts the **food columns** in shared memory (foundation for 063 food regen
and 066 behaviour) and ports the RNG-free carrion-decay pass; **the pheromone pass
is deferred** (optional, cheap, not on the critical path — revisit after 067).

## Required changes

1. Extend the shared layout (`src/core/worldLayout.ts`) to a full world layout —
   agent SoA (061) plus the food columns (foodX, foodY, foodAlive, foodType,
   foodEnergy, foodDecay) and a food death-scratch — parameterised by foodCapacity.
   `createWasmCore(bytes, agentCapacity, foodCapacity)` sizes the memory for it;
   `World` places the food columns as views when a shared buffer is given.
2. Add a WASM carrion-decay kernel (extend `metabolism.as.ts`): decrement carrion
   `foodDecay`, mark expired carrion in the scratch; the loop reaps marked food via
   `killFood` in ascending slot order (matching the TS side-effect order).
3. Wire it into the loop behind `wasmCore`; keep `decayCarrion` as the TS fallback.

## Acceptance criteria

- Default run unchanged; existing tests green.
- With `wasmCore` on, the full-run equivalence test (predation on, so carrion is
  dropped and decays over the run) stays **bit-for-bit** identical to the TS core.
- `npm run build` and `npm test` pass.

## Checks

`npm run build`, `npm test`; the existing full-run equivalence test already
exercises carrion drop + decay over 300 ticks — it is the gate. Do not commit if
equivalence is not met.

## Commit and push

If and only if scope is followed and checks pass, commit using this file's exact
filename (`062_wasm_leaf_passes.md`), then push.

## Final report

End with the required final report specified in `AGENTS.md`.
