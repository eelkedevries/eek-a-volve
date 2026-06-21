# Task: WASM-core feature completeness (remove the TS-fallback gaps)

## Goal

Extend the WASM core so it runs in WASM for **every** feature combination, not just
default-feature runs. Today it falls back to the (correct, slower) TypeScript path
when certain toggles are on; this prompt closes those gaps so the speed-up applies
universally. Default-off principle and bit-for-bit equivalence are unchanged.

## Current fallbacks (from 063–067)

- **Behaviour + predation** run in TS when `neuralBrains` **or** `pheromones` is on
  (`canRunBehaviour`).
- **Food regeneration** runs in TS when `seasonAmplitude > 0` (seasonal `sin`) or
  `biomeStrength > 0` (biome rejection sampling with `sin`/`cos`).
- **Catastrophes** and **immigration** always run in TS (default off; they share the
  RNG via the host import).

## Required changes (each behind its existing toggle, equivalence-gated)

1. **Brains in WASM behaviour:** evaluate the fixed-topology net (the genome weight
   block already lives in the world SoA) and inherit weights in the WASM `breed`,
   so the WASM behaviour path no longer requires brains off. Use `tanh` via a host
   import for parity.
2. **Pheromones in WASM behaviour:** place the pheromone field in shared memory and
   port deposit + gradient sampling, so the WASM path no longer requires pheromones
   off (mirror `PheromoneField`).
3. **Seasonal/biome food regen in WASM:** port `seasonalFactor` and `fertilityAt`
   (their `sin`/`cos` via host imports for parity) and the rejection-sampling
   `placePlant`, so regen runs in WASM for all cases.
4. **Catastrophes + immigration in WASM:** port `events.step` and `immigrate` (RNG
   via the host import; `spawnRandomAgent` over the shared free-list).

## Acceptance criteria

- The full-run equivalence test passes **bit-for-bit** with each toggle on
  (brains, pheromones, seasons, biomes, catastrophes, immigration), individually and
  combined, against the TS core.
- Default path unchanged; `npm run build` and `npm test` pass.

## Checks

`npm run build`, `npm test`; extend the equivalence test with feature-on variants.
This is large and may be split into per-feature commits if cleaner; do not commit a
variant whose equivalence is not met.

## Final report

End with the required final report specified in `AGENTS.md`.
