# Task: learned neural-network brains (SPEC-LOCKED — needs approval before running)

> ⚠️ **This prompt conflicts with a locked spec decision and is a major,
> multi-prompt effort.** `specification.md` records learned neural-network brains
> as *deferred* — "the first stretch goal once the core is stable" — i.e. out of
> scope for the first version. Per `AGENTS.md`, the spec is ground truth and a
> conflicting change must be flagged and the spec deliberately updated first. Do
> **not** run this as a single automated prompt. It should be (a) approved by the
> maintainer, (b) split into a numbered sub-sequence, and (c) preceded by a spec
> change that un-defers it. This file captures the intent and the risks.

## Goal

Replace or augment the hand-coded behaviour policy with a small, fixed-topology
neural network per creature whose weights are part of the genome and evolve, so
behaviour itself is selected rather than scripted.

## Why this is large and risky

- **Genome change:** the genome gains many real-valued weights; world columns,
  mutation/crossover, snapshot trait-means, naming, speciation, and the inspector
  all assume a small fixed trait set. Adding a weight vector touches most of
  `core/` and the data schemas.
- **Determinism:** the network evaluation must be deterministic and seeded; no
  platform randomness on the sim path.
- **Performance:** evaluating a net for up to `MAX_POPULATION` (2000) agents every
  tick, allocation-free, within the worker's budget, is the hard part — sensory
  encoding, fixed-size buffers, and no per-tick allocation.
- **Behaviour parity:** the existing seek/flee/eat/court/reproduce outcomes and
  the population-stability guarantees must be preserved or re-tuned; the 012
  stability test and determinism tests must stay green.
- **Scope:** this is realistically several prompts (genome+net representation;
  sensory inputs/motor outputs; integration behind a toggle; tuning/stability;
  inspector/visualisation), not one.

## Suggested decomposition (to be authored as a sub-sequence, after a spec update)

1. Spec: un-defer learned brains; record the chosen representation (fixed-topology
   MLP), determinism, and performance constraints; bump the version.
2. A deterministic, allocation-free network module in `core/` with fixed input
   (senses) and output (motor) layout, plus genome weights.
3. A behaviour mode that uses the network outputs instead of the hand-coded
   policy, behind a parameter (default off → existing behaviour and tests
   unchanged).
4. Stability/determinism tuning and tests at population scale.
5. Inspector/legend support to show a creature's "brain" at a high level.

## Acceptance criteria

Not runnable as-is. Complete only when the maintainer has approved the direction,
the spec has been updated to un-defer it, and the decomposed sub-prompts each pass
`npm run build` and `npm test` with determinism and the 012 stability test green
and the default (hand-coded) path unchanged.

## Commit and push

Do not implement or commit from this file. It is a flagged proposal; await
explicit approval and a spec decision, then author and run the sub-sequence.

## Final report

If asked to act on this file, stop and flag the spec conflict per `AGENTS.md`
instead, then end with the required final report.
