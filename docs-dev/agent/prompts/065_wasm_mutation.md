# Task: WASM mutation + genome helpers (WASM core, increment 6)

## Goal

Port the genome inheritance/mutation routines (`breed`, `breedSexual`,
`src/core/mutation.ts`) and the genome clamp/range helpers to the WASM core, using
the shared RNG. These are called by reproduction inside behaviour, so they must be
available in WASM before the behaviour pass (066). Default off; TS fallback retained.

## Context

`breed`/`breedSexual` draw from the shared `Rng` (`next`, `gaussian`, `int`) and
clamp against `TRAIT_RANGES`. Using the imported-RNG + JSMath technique from 063,
the WASM versions are bit-identical. Brain-weight inheritance (when `neuralBrains`
is also on) must be handled or explicitly excluded (document the combination).

## Required changes

1. Add WASM `breed`/`breedSexual` (and trait clamp) bit-identical to the TS ones:
   same draw order, same freak-mutation branch, same `TRAIT_RANGES`, operating on the
   shared trait columns and the imported RNG.
2. Expose them for the behaviour pass (066) to call; keep TS fallbacks.
3. Decide and document the `wasmCore` + `neuralBrains` combination (support brain
   weights, or require brains off when the WASM core is on).

## Acceptance criteria

- Default run unchanged; existing tests green.
- A unit test: WASM `breed`/`breedSexual` produce identical child genomes and leave
  the RNG in the identical state as the TS versions, for the same parents/seed.
- `npm run build` and `npm test` pass.

## Checks

`npm run build`, `npm test`; the breed-equality unit test. Do not commit if genomes
or RNG state diverge.

## Commit and push

If and only if scope is followed and checks pass, commit using this file's exact
filename (`065_wasm_mutation.md`), then push.

## Final report

End with the required final report specified in `AGENTS.md`.
