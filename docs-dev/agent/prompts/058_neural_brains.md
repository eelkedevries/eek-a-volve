# Task: optional learned neural-network brains (default-off)

## Goal

Add an optional, default-off capability where each creature's movement is driven
by a small fixed-topology neural network whose weights are part of its genome and
evolve, instead of the hand-coded movement policy. The hand-coded behaviour
remains the default and the fallback.

## Scope

Implement the network, evolvable per-creature weights, and the behaviour
integration behind a `neuralBrains` toggle. Do not implement NEAT (topology
evolution), learning within a lifetime, or a brain visualiser. Eating,
reproduction, energy, predation, and bounds are unchanged — only the per-tick
movement *heading* is produced by the net when the toggle is on.

## Context (optional-capability principle, spec v0.4.0)

The toggle must be **default-off**, leave the default run byte-for-byte unchanged
(no extra RNG draws, identical code path when off), preserve determinism, and keep
the 012 stability guarantee on the default path. The hand-coded policy is in
`src/core/behaviour.ts` (it already computes the nearest-food direction, the
threat direction, and energy each tick). The genome/world is structure-of-arrays
(`src/core/world.ts`, `src/core/genome.ts`); founders are seeded in
`src/core/bounds.ts` (`spawnRandomAgent`); offspring inherit/mutate in
`src/core/mutation.ts` (`breed`, `breedSexual`); the deterministic RNG is
`src/core/rng.ts`. Per-tick paths must not allocate.

## Required changes

1. Add `src/core/brain.ts`: a fixed-topology MLP (e.g. inputs → one hidden layer →
   2 outputs) with a constant `BRAIN_WEIGHT_COUNT` (weights + biases) and a pure,
   allocation-free `evaluate(weights, weightBase, inputs, out)` using a reused
   hidden-layer scratch and `tanh`. Deterministic; no RNG, no platform randomness.
2. Add an optional per-creature weight store to `World`: a `brainWeights:
   Float32Array | null` (default `null`) and an `enableBrains(weightCount)` that
   allocates `agentCapacity * weightCount` once. Everything else keys off
   `brainWeights !== null`, so the column does not exist when brains are off.
3. Add a `neuralBrains: boolean` parameter (default `false`) to
   `SimulationParameters` / `DEFAULT_PARAMETERS` (`src/core/params.ts`), and clamp
   it in the share codec. When set, the `Simulation` calls `world.enableBrains(...)`
   before seeding.
4. Seed and inherit weights only when enabled: in `spawnRandomAgent`, fill a
   founder's weights with small seeded random values; in `breed` / `breedSexual`,
   copy (asexual) or uniformly cross over (sexual) the parents' weights and apply
   the same per-weight Gaussian mutation as traits. All gated on `brainWeights`.
5. In `behaviour.ts`, when `world.brainWeights !== null`, build the sensory input
   vector from values already computed (normalised nearest-food direction, threat
   direction, energy fraction, a bias) and set the movement heading from the net's
   two outputs, replacing the flee/court/seek/wander heading chain for that tick;
   eating and reproduction proceed as before. When `brainWeights === null` the
   existing chain runs unchanged (no net, no extra RNG).
6. Update `specification.md` (Data schemas: the optional brain-weight store and the
   `neuralBrains` parameter; Domain rules → Behaviour: when enabled, a fixed
   evolvable network produces movement, default-off and fallback per the
   optional-capability principle) and bump the version. Update
   `docs-dev/planning/current_state.md`.

## Do not implement

Do not implement: NEAT/topology evolution; lifetime learning; a brain
visualiser/inspector panel (a later prompt); any change to the default (off) path;
networks for anything other than the movement heading.

## Acceptance criteria

- With `neuralBrains` off, the run is byte-for-byte identical to before (the
  determinism and 012 stability tests stay green on the defaults), and no
  brain-weight memory is allocated.
- With `neuralBrains` on, a fixed seed and parameters reproduce a run exactly (a
  determinism test passes), the network drives movement (a test asserts movement
  follows the weights — e.g. weights that map a food-direction input to the output
  steer the creature toward food), and weights are inherited and mutated.
- The per-tick path performs no new allocation in either mode.
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for the network (determinism,
allocation-free), weight inheritance/mutation, and the on-vs-off behaviour
(off-path unchanged; on-path steered by weights).

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main`
using this file's exact filename (`058_neural_brains.md`) as the commit message,
then push. Do not commit partially completed or failing work.

## Final report

End with the required final report specified in `AGENTS.md`.
