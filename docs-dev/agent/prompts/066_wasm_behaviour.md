# Task: WASM behaviour pass (WASM core, increment 7 — the core pass)

## Goal

Port the main behaviour pass (`Behaviour.step`, `src/core/behaviour.ts`) — neighbour
sensing, movement, eating, and reproduction (calling the WASM mutation from 065) —
to the WASM core, operating on shared memory, the shared grid (064), and the shared
RNG. This is the largest and most interconnected pass. Default off; TS fallback.

## Context (the hard one)

`Behaviour.step` queries the spatial grid, reads/writes positions, energy, and
action, consumes food, drops carrion, and creates agents (`spawnAgent` + breed),
all while drawing from the shared RNG in a specific order. Bit-identical equivalence
requires reproducing that order exactly, using the WASM grid (064), WASM mutation
(065), the imported RNG, and JSMath. Agent and food slot allocation
(`spawnAgent`/`spawnFood`, the free-list stacks) must also operate on shared memory
so the WASM pass can allocate births in the identical slot order.

## Required changes

1. Move the agent/food free-list state into shared memory and add WASM
   `spawnAgent`/`killAgent`/`spawnFood` equivalents (identical slot order).
2. Add a WASM behaviour kernel bit-identical to `Behaviour.step`: same grid queries,
   same movement maths, same eat/reproduce decisions and RNG draw order, same
   pheromone deposits. Optional features (pheromones, neural brains) handled per
   their existing flags or documented as excluded under the WASM core.
3. Wire it behind `wasmCore`; keep the TS fallback.

## Acceptance criteria

- Default run unchanged; existing tests green.
- With `wasmCore` on, the full-run equivalence test (sexual + asexual, predation on)
  stays **bit-for-bit** identical to the TS core over a long run.
- `npm run build` and `npm test` pass.

## Checks

`npm run build`, `npm test`; the full-run equivalence test is the gate. If bit-for-
bit equivalence cannot be achieved (e.g. an irreducible ordering/parity gap), do not
commit — report the precise divergence (first differing tick/field), per AGENTS.md.

## Commit and push

If and only if scope is followed, the default path is unchanged, equivalence holds,
and checks pass, commit using this file's exact filename (`066_wasm_behaviour.md`),
then push. No partial/failing work.

## Final report

End with the required final report specified in `AGENTS.md`.
