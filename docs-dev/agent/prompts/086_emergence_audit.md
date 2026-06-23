# Task: emergence audit (label discipline + optional ablation)

## Goal

Enforce the synthesis's label discipline: document, for every Stage-3/4 capacity,
whether it is a **[design-abstraction]** (it fires at a modeller-set detector) or has
**earned the "emergent" label** (it recurs reproducibly across seeds with that detector
disabled), and provide the optional ablation that tests the latter — adding **no** new
simulation rules and leaving the default run byte-for-byte unchanged.

## Goal label

This prompt *is* the label-discipline enforcement (plan §1, §7): "emergent" is reserved
for a capacity that reproducibly appears across seeds from lower-level traits **with its
detector disabled**. Nothing may be relabelled "emergent" without that detector-disabled,
cross-seed evidence. By default every Stage-3/4 capacity stays **[design-abstraction]**
(or [speculative] for 085).

## Scope

Implement only: a non-binding `docs-dev/reference/secondary_background/` note mapping each
Stage-3/4 capacity to its evidence label and recording the ablation result; and an
**optional** `core/` ablation harness/test that runs a capacity with its detector
disabled across seeds and checks whether the target behaviour still appears. No new
simulation rules, no new parameters that change a run, and no render/UI. This may fold
into prompt 085 if preferred (note that in the doc), but is written here as its own
documentation-plus-ablation unit.

## Scope guard

This prompt audits capacities added by earlier prompts — culture / social learning
(080), the cumulative ratchet (081), cultural loss (082), gene–culture coevolution
(083), and the transitions/complexity state (085). Audit each capacity **that has
landed**; for any not yet present, record it as "pending" in the note rather than
asserting a label. State this in the note. Do not re-implement any capacity here.

## Context

The label discipline (plan §1, §7): the four failure modes to design against are treating
intelligence as a monotonic good, treating technology/civilisation as inevitable,
treating complexity as irreversible, and **labelling "emergent" any capacity that in fact
fires at a modeller-designed threshold**. The Stage-3/4 capacities are detector- or
threshold-driven by construction (culture's copy-at-fidelity, the ratchet's
fidelity-threshold, the transitions detector), so their honest default label is
**[design-abstraction]** ([speculative] for 085). A capacity may be upgraded to "emergent"
**only** if, with its detector/threshold disabled, the target behaviour still arises
reproducibly across seeds from lower-level traits — the precise upgrade threshold to
record if/when met.

The ablation harness is a headless `core/` test in the established idiom (mirror
`src/core/stability.test.ts` and the cognition-cost test: build a `Simulation` with
`createSimulation`, run many ticks across several seeds, read population means from
`sim.world`). For a chosen capacity, run two configurations across the same seed set —
detector/threshold *enabled* vs *disabled* — and measure whether the target signal (e.g.
sustained high mean `knowledge`, or a complexity-state region) appears without the
detector. By construction it should **not** (the capacities are scaffolded), so the
default expectation the test encodes is "no detector ⇒ no capacity", which is exactly the
evidence that keeps the [design-abstraction] label honest. The harness/test must add
**no** RNG draw beyond running the existing sim, no new simulation rule, and must not
change the default run.

The audit note lives under `docs-dev/reference/secondary_background/` (non-binding
background, alongside `science_synthesis.md`); it is a table mapping each capacity →
evidence label → ablation result → pointer to the test. It must never reach `dist/`
(`docs-dev/` is excluded from the build by `scripts/check-public-build.sh`). The binding
specification needs **no** change (this is documentation); at most add a one-line pointer
to the audit note from the relevant spec rule, with no version bump unless a pointer is
added.

Background and rationale (non-binding):
`docs-dev/planning/science_integration_plan.md` §1 (the label discipline and honesty
benchmark), §5 (prompt 086), and §7 (forbidden "emergent" labels and the out-of-scope
agent↔civilisation coupling); the source synthesis is
`docs-dev/reference/secondary_background/science_synthesis.md`.

## Required changes

1. Add a non-binding audit note under `docs-dev/reference/secondary_background/` (e.g.
   `emergence_audit.md`) with a table mapping each Stage-3/4 capacity — culture (080),
   ratchet (081), cultural loss (082), gene–culture (083), transitions (085) — to its
   evidence label ([design-abstraction] / [speculative]), the ablation result
   (detector-disabled cross-seed outcome, or "pending" if the capacity or ablation is not
   yet present), and a pointer to the ablation test. State the upgrade rule: "emergent"
   requires the behaviour to recur across seeds with the detector disabled.
2. Add an **optional** `core/` ablation harness/test (e.g.
   `src/core/emergence_ablation.test.ts`) that, for at least one landed capacity (culture
   knowledge is the natural first case), runs detector-enabled vs detector-disabled across
   several seeds and asserts whether the target behaviour appears without the detector —
   encoding the default expectation that, being scaffolded, it does **not**. Use the
   existing headless idiom; add no new simulation rule and no new run-changing parameter.
3. Optionally add a one-line pointer to the audit note from the relevant
   specification rule(s) (Culture and/or Transitions). If — and only if — such a pointer
   is added, bump the version (≈0.8.1) and update `docs-dev/planning/current_state.md`;
   otherwise no spec change and no version bump are required (note this in the final
   report).

## Do not implement

Do not implement:
- any new simulation rule, pass, or run-changing parameter (documentation + ablation
  only);
- relabelling any capacity "emergent" without detector-disabled, cross-seed evidence;
- the artificial-agents ↔ civilisation coupling (plan §7, out of scope);
- a render cue or setup-screen control;
- anything that changes the default run;
- placing the audit note anywhere it could reach `dist/` (keep it under `docs-dev/`).

## Acceptance criteria

The task is complete when:
- the default run is byte-for-byte unchanged (no new simulation rule or run-changing
  parameter) and the population-stability test (prompt 012) stays green;
- the audit note exists under `docs-dev/reference/secondary_background/`, mapping each
  Stage-3/4 capacity to its evidence label, ablation result (or "pending"), and the test
  pointer, and states the "emergent"-upgrade rule; `scripts/check-public-build.sh`
  confirms `docs-dev/` stays out of `dist/`;
- the optional ablation test runs at least one landed capacity detector-disabled across
  seeds and asserts the scaffolded behaviour does not appear without the detector
  (keeping the [design-abstraction] label honest), reproducibly per seed;
- no capacity is labelled "emergent" without the detector-disabled, cross-seed evidence;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Confirm the audit note is present and excluded from
the build (`scripts/check-public-build.sh`), the optional ablation test passes, and the
prompt-012 stability test still passes unchanged on the default path.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`086_emergence_audit.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
