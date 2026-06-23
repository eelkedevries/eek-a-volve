# Task: cultural loss below a critical population size (Tasmania)

## Goal

Make mean knowledge *decline* when the effective population that can sustain it falls
below a critical size, and *recover* when the population rebounds — the U-shaped,
reversible maladaptive-loss signature — leaving the default run byte-for-byte
unchanged.

## Goal label

This coupling is **[debated]** (the Tasmania interpretation is contested) and a
deliberate **reversibility** demonstration: loss must be a *default-possible* outcome,
not an edge case, and must be recoverable on rebound. There is no permanent "dark age"
lock. It remains a [design-abstraction] in mechanism — knowledge is the designed 080
channel — and earns no "emergent" label.

## Scope

Implement only: a `criticalCultureN` threshold and the tie between knowledge
maintenance and the local/effective population, so that below the threshold copy
opportunities are too sparse to offset loss-on-death and mean knowledge falls, and a
"knowledge lost" event surfaced in the feed; plus the accompanying tests and
specification update. This builds directly on prompt 080 (`social_learning_core`,
and works with 081 if present) and changes nothing when culture is off. Do not
implement gene–culture coevolution (083), technology→carrying-capacity (085), or any
permanent/irreversible loss.

## Scope guard

This prompt assumes prompt 080 (`social_learning_core`) has landed: the `culture`
toggle, the `knowledge` column, the `src/core/culture.ts` pass, and its registration
in `src/core/loop.ts` exist. (Prompt 081's ratchet, if present, composes with this —
the same maintenance/decay machinery — but is not required.) If 080 has not landed,
stop and flag it.

## Context

The Tasmania mechanism follows directly from 080's design: `knowledge` is **not**
genetic and is **lost on death** (a recycled slot starts at zero), so a population
maintains its mean knowledge only by enough surviving, knowledgeable neighbours being
present to copy from. When the effective population that can act as models falls below
a critical size, copy opportunities become too sparse to replace what dies with each
generation, and mean knowledge falls — recovering when the population (and its pool of
models) rebounds. This makes the loss U-shaped and reversible by construction.

The culture pass (`src/core/culture.ts`) already copies from the best neighbour with
probability `transmissionFidelity` and may decay knowledge. Tie maintenance to the
*effective* population: define `criticalCultureN` and make the per-tick maintenance
weaker (relative to loss-on-death/decay) when the relevant population is below it —
either via the global `world.population` or, better matching the dilution logic, via
the local model density a creature can actually reach (a neighbour count using
`SpatialGrid.query`, reusing the 080 copy-radius query; allocation-free). Below
`criticalCultureN`, expected knowledge declines; above it, copying sustains or builds
it. Surface a "knowledge lost" moment in the event feed so the loss is legible: the
bounded event log is `EventLog`, owned by the `Simulation` in `src/core/loop.ts` and
reconciled each tick (`eventLog.reconcile(world)`); add a culture-loss event in the
same style as the existing mass-death / near-extinction events (see how
`eventLog.massDeath` / `eventLog.nearExtinction` are raised in `loop.ts`) — a
narration hook only, never read back into a simulation decision (so determinism is
unaffected).

Per the determinism rule, any added stochastic step must draw from the run's seeded
`Rng` **only** when `culture` is on; with the default `culture` off, nothing changes.
The 080 WASM-fallback wiring already forces the TS hot loop whenever `culture` is on,
so this inherits that fallback; do not add loss logic to the WASM kernel
(WASM-fallback rule, plan §4.7).

Parameters live in `src/core/params.ts`. The binding canon is
`docs-dev/reference/primary_authoritative/specification.md`; this extends the Culture
domain rule and adds a parameter, so it must be accompanied by a specification update
and a version bump. Background and rationale (non-binding):
`docs-dev/planning/science_integration_plan.md` §4 (cross-cutting rules) and §5,
prompt 082.

## Required changes

1. Add `criticalCultureN: number` to `SimulationParameters` in `src/core/params.ts`,
   documented as the effective population size below which knowledge maintenance fails
   and mean knowledge declines (reversible on rebound). Choose a default that is inert
   while `culture` is off; do not add it to `COMMUNITY_PRESET` or `SWARM_PRESET`.
2. In `src/core/culture.ts`, tie knowledge maintenance to the effective population:
   below `criticalCultureN` (global population or, preferably, reachable local model
   density), make loss-on-death/decay outweigh copying so mean knowledge falls; above
   it, copying sustains/builds it. Keep the U-shape reversible — recovery must follow
   naturally when the population rebounds (no permanent floor, no absorbing "dark
   age"). Keep the pass allocation-free; draw RNG only when `culture` is on; change
   nothing when `culture` is off.
3. Surface a "knowledge lost" event in the feed (via `EventLog` in `src/core/loop.ts`,
   in the style of the existing mass-death / near-extinction events) when mean
   knowledge drops markedly under a sub-critical population — narration metadata only,
   never read back into the simulation.
4. Update `specification.md`: extend the Domain rule "Culture (social learning) —
   [design-abstraction]" (below a critical effective population size knowledge
   maintenance fails and mean knowledge declines, recovering on rebound — a U-shaped,
   reversible loss; off by default) and Data schemas (the `criticalCultureN`
   parameter). Bump the version (≈0.7.2, after 080/081 — choose the next free version
   at run time). Update `docs-dev/planning/current_state.md` to note the extension.

## Do not implement

Do not implement:
- gene–culture coevolution (prompt 083) or technology→carrying-capacity (prompt 085);
- permanent or irreversible knowledge loss, or a hard "dark age" lock (recovery must
  remain possible on rebound);
- any "emergent" labelling;
- a render cue or setup-screen control (the event-feed hook is the only legibility
  added here);
- porting the loss logic into the WASM kernel;
- any default-on behaviour or any post-start control.

## Acceptance criteria

The task is complete when:
- with `culture = false`, a fixed seed and parameters reproduce a run exactly,
  identical to the post-080/081 core (the determinism test passes) and the
  population-stability test (prompt 012) stays green — the loss coupling is inert by
  default;
- with `culture = true` and a fixed seed and parameters, the run is exactly
  reproducible (a determinism test passes);
- a focused core test reproduces the U-shape: a scripted bottleneck (drive the
  population below `criticalCultureN`, e.g. via a survivable shock or tight food)
  produces a documented decline in mean knowledge, followed by recovery when the
  population rebounds — reproducible per seed, with loss a default-possible outcome
  (not an edge case);
- the "knowledge lost" event is raised during the decline;
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for determinism with the loss
coupling, for the U-shaped loss-and-recovery under a scripted bottleneck, and confirm
the prompt-012 stability test still passes unchanged on the default path.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`082_cultural_loss.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
