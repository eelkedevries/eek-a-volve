# Task: reversibility metric and the honesty benchmark

## Goal

Make the collapse-and-recovery U-shape measurable — expose an evolutionary-rescue
metric (trough depth, recovery time, whether standing variation enabled recovery) —
and assert the programme-wide honesty benchmark in a multi-seed core test: cognition,
disease-resistance, and knowledge each **sometimes fail to appear and sometimes
regress**, none monotone by default; leaving the default run byte-for-byte unchanged.

## Goal label

This is **[established]** (evolutionary rescue and non-absorbing states are
well-supported) and is mostly *surfacing and testing* existing mechanisms
(near-extinction, immigration, standing variation, and the reversible couplings of
072–083), not adding new simulation rules. It encodes the synthesis's overarching
honesty benchmark as an executable test.

## Scope

Implement only: a rescue/reversibility metric logged or exposed from the existing loop
state; a multi-seed `core/` honesty-benchmark test; and an evolutionary-rescue test
showing a U-shaped trajectory under a survivable shock; plus a short specification note
and the version bump. Do not implement any new subsystem, and do not tune anything to
*guarantee* recovery — recovery must stay conditional on standing variation and
population size. The capabilities under test (cognition cost 072, social brain 079,
disease resistance 074, knowledge 080–082) must already exist or the relevant
assertions are skipped/guarded; see the scope guard.

## Scope guard

This prompt audits capabilities added by earlier prompts. The honesty-benchmark test
should assert non-monotonicity/reversibility for each capability **that has landed** —
cognition (`cognitionCost`, 072, shipped), disease resistance (the `resistance` trait,
074), and knowledge (`culture`, 080–082) — and guard or skip assertions for any not yet
present, so the test is meaningful as the programme fills in. State this dependency in
the test's comments; do not re-implement any capability here.

## Context

The reversibility machinery already exists in the core and needs surfacing, not
building:

- **Near-extinction** is detected each tick (`isNearExtinction`,
  `NEAR_EXTINCTION_THRESHOLD` in `src/core/bounds.ts`; `sim.nearExtinction` and the
  `eventLog.nearExtinction()` transition in `src/core/loop.ts`).
- **Standing variation + immigration** reseed diversity (`immigrate`,
  `spawnRandomAgent` in `src/core/bounds.ts`; the `immigration` toggle).
- **Survivable shocks** come from catastrophes (`src/core/events.ts`, the
  `catastrophes` toggle) and the population is bounded by the food carrying capacity
  (`src/core/food.ts`).
- The **population trajectory** is read straight from `sim.world.population` per tick
  (the prompt-012 stability test, `src/core/stability.test.ts`, already runs many ticks
  and tracks `min`/`max` this way — mirror that idiom).

A "rescue" is a trajectory that drops to a deep trough (near or at the near-extinction
floor) and then recovers. Expose a small metric from the loop's existing counters —
e.g. record the minimum population and the tick of the deepest trough, and the recovery
time to a target fraction of the pre-shock level — as fields/getters on `Simulation`,
or compute them in a helper over the per-tick population series. Keep this observational
only (like lineage and records): it must be derived from existing state, add **no** RNG
draw, and not feed back into any simulation decision, so determinism and the default run
are untouched. Prefer a helper or read-only getters over new hot-loop work; if you add a
field, update it from already-computed values (no extra passes, no allocation on the
hot loop).

The honesty benchmark (plan §1, the acceptance theme for the whole programme): across
seeds, intelligence, disease-resistance and culture must each *sometimes* fail to
appear and *sometimes* regress — none rising monotonically and irreversibly on the
default path. Encode this as a multi-seed test that runs each capability's enabling
parameters across several seeds and asserts the population-mean of the relevant
quantity (mean `senseRadius` for cognition; mean `resistance` for disease resistance;
mean `knowledge` for culture) is **not** monotonically non-decreasing across seeds/time
— i.e. at least one seed shows a decline (regression) and at least one shows failure to
rise (no appearance). This is the executable form of "design against monotone,
irreversible upgrades".

The binding canon is `docs-dev/reference/primary_authoritative/specification.md`; this
adds a short reversibility note (and possibly a tiny metric surface), so it must be
accompanied by a specification update and a version bump. Background and rationale
(non-binding): `docs-dev/planning/science_integration_plan.md` §1 (the honesty
benchmark), §4 (cross-cutting rules), and §5, prompt 084.

## Required changes

1. Expose a rescue/reversibility metric derived from existing loop state — minimum
   population and its tick (trough depth/time), and a recovery time to a target
   fraction of a pre-shock baseline — as read-only getters on `Simulation`
   (`src/core/loop.ts`) and/or a small helper over the per-tick population series.
   Update any field only from already-computed values; add **no** RNG draw and no
   hot-loop allocation, and do not feed the metric back into any simulation decision.
2. Add a multi-seed honesty-benchmark `core/` test (e.g.
   `src/core/honesty_benchmark.test.ts`) that, for each landed capability — cognition
   (`cognitionCost`/`socialBrain`), disease resistance (`disease` + `resistance`), and
   knowledge (`culture`) — runs several seeds and asserts the relevant population-mean
   is **not** monotone/irreversible: across the seed set, at least one run shows the
   quantity *regress* and at least one shows it *fail to rise*. Guard/skip assertions
   for any capability not yet present (see the scope guard).
3. Add an evolutionary-rescue `core/` test that, under a survivable shock (a
   catastrophe and/or a tight-then-relaxed food regime, with standing variation and/or
   immigration available), shows a U-shaped population trajectory — a deep trough
   followed by recovery — reproducibly per seed, asserted via the rescue metric. Do not
   tune parameters so recovery is guaranteed; the test must use a regime where recovery
   is conditional and observed, not forced.
4. Update `specification.md`: a short "Reversibility by construction" note (states are
   non-absorbing — near-extinction, evolutionary rescue, and the optional couplings are
   all reversible; if any quantity becomes a de-facto attractor on the default path, an
   explicit decay hazard is added to restore reversibility) and, if a metric surface is
   added, a one-line Data-schemas/observational mention. Bump the version (≈0.7.4, after
   the culture prompts — choose the next free version at run time). Update
   `docs-dev/planning/current_state.md` to note the benchmark.

## Do not implement

Do not implement:
- any new simulation subsystem or domain rule (this surfaces and tests existing
  mechanisms);
- tuning that hard-guarantees recovery (recovery must remain conditional on standing
  variation and population size);
- a render cue or setup-screen control;
- any post-start control, or any metric that feeds back into a simulation decision;
- new RNG draws or hot-loop allocation.

## Acceptance criteria

The task is complete when:
- the default run is byte-for-byte unchanged (the metric is observational, derived from
  existing counters, with no extra RNG and no feedback) and the population-stability
  test (prompt 012) stays green;
- the rescue metric is reproducible per seed and reads correctly on a known
  collapse-and-recovery trajectory (trough depth/time and recovery time);
- the multi-seed honesty-benchmark test passes: for each landed capability, the
  relevant population-mean is shown to **sometimes regress and sometimes fail to
  appear** across seeds — none monotone/irreversible by default;
- the evolutionary-rescue test shows a U-shaped trajectory under a survivable shock,
  with recovery conditional (not forced) and reproducible per seed;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add the multi-seed honesty-benchmark test and the
evolutionary-rescue (U-shape) test, verify the rescue metric on a known trajectory, and
confirm the prompt-012 stability test still passes unchanged on the default path.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`084_reversibility_benchmark.md`) as the
commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
