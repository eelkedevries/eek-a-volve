# Task: Simulation parameters and trait definitions

## Goal

Define the pre-start parameter set and the genome's trait definitions — the data shapes the rest of `core/` builds on.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Data schemas_ (the pre-start parameter object; the genome as a fixed-length array of real-valued, clamped traits) and _Naming and voice_. This prompt defines types and ranges only — no behaviour.

## Required changes

1. In `src/core/params.ts`, define a single serialisable `SimulationParameters` type with sensible defaults: initial population, world width/height, random seed, food abundance, food regeneration rate, starting energy, baseline metabolism cost, reproduction threshold, mutation rate, mutation magnitude, predation toggle, starting species count, catastrophe toggle, and the time-multiplier bounds.
2. In `src/core/genome.ts`, define the trait set (`size`, `speed`, `senseRadius`, `metabolicEfficiency`, `diet`, `colourHue`) with per-trait min/max ranges, a fixed trait count and order suitable for column-wise SoA storage, and a `clampTrait`/`clampGenome` helper.
3. Add unit tests: defaults are valid and within range; clamping maps out-of-range values back into range.

## Do not implement

Do not implement:
- world-state arrays, mutation, behaviour, or food;
- changes to the RNG;
- any UI or rendering.

## Acceptance criteria

The task is complete when:
- the types compile and the tests pass;
- trait ranges and clamping are covered by tests;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`003_simulation_parameters.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
