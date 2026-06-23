<!--
Status: SECONDARY BACKGROUND — non-binding, informational only. It does not
override the specification (`../primary_authoritative/specification.md`), which
wins on any conflict. This note records the label-discipline audit for the
Stage-3/4 capacities and the ablation evidence behind each label. It must never
reach the deployed build (`docs-dev/` is excluded from `dist/` by
`scripts/check-public-build.sh`).
The source synthesis is `science_synthesis.md`; the integration plan is
`../../planning/science_integration_plan.md` (§1 label discipline, §5 prompt 086,
§7 forbidden "emergent" labels).
-->

# Emergence audit — label discipline for the Stage-3/4 capacities

## Why this note exists

The synthesis (§1) names four failure modes the design must avoid: treating
intelligence as a monotonic good, treating technology/civilisation as inevitable,
treating complexity as irreversible, and — the one this note enforces — **labelling
"emergent" any capacity that in fact fires at a modeller-designed threshold**.

The Stage-3/4 capacities (culture and its extensions, and the transitions/complexity
state) are **detector- or threshold-driven by construction**: culture copies at a
fidelity probability, the ratchet switches at a fidelity threshold, cultural loss
fires below a critical reachable population, gene–culture unlocks above a knowledge
level and a size band, and the transitions state fires at a sustained
density-plus-knowledge detector. Their honest default label is therefore
**[design-abstraction]** (**[speculative]** for transitions) — **not "emergent"**.

## The "emergent"-upgrade rule

A capacity may be relabelled **"emergent"** **only** if, with its detector / threshold
**disabled**, the target behaviour still arises **reproducibly across seeds** from the
lower-level traits. Nothing in the table below may be moved to "emergent" without that
detector-disabled, cross-seed evidence. Until then every Stage-3/4 capacity stays
[design-abstraction] / [speculative]. This is the precise upgrade threshold to record
if and when it is ever met.

## Audit table

Each row maps a landed Stage-3/4 capacity to its evidence label, the ablation result
(what happens with the detector disabled), and a pointer to the test that demonstrates
it. "Pending" marks a capacity or an ablation not yet present.

| Capacity (prompt) | Detector / threshold | Evidence label | Ablation result (detector disabled) | Test pointer |
| --- | --- | --- | --- | --- |
| **Culture / social learning** (080) | copy at probability `transmissionFidelity`; the `culture` toggle gates the whole channel | **[design-abstraction]** | With `culture` off the knowledge channel is inert: mean `knowledge` stays 0 across seeds — the capacity does **not** appear without the detector. | `src/core/emergence_ablation.test.ts` ("culture (knowledge) is scaffolded, not emergent"); built on `src/core/culture.test.ts` |
| **Cumulative ratchet** (081) | innovation increment gated by the `FIDELITY_THRESHOLD` logistic | **[design-abstraction]** | Sub-threshold fidelity shows no accumulation (extra decay dominates); the ratchet is conditional on the threshold, not open-ended. Knowledge retention vs fidelity is shown in `culture_ratchet.test.ts`; a dedicated detector-disabled ablation is **pending** (the ratchet requires culture, whose own ablation already removes the channel). | `src/core/culture_ratchet.test.ts` (threshold dependence); culture ablation in `emergence_ablation.test.ts` |
| **Cultural loss below critical N** (082) | extra decay when reachable neighbours `< criticalCultureN` | **[debated]** interpretation, **[design-abstraction]** mechanism | The loss is a designed consequence of the critical-N gate; `criticalCultureN ≤ 0` disables the gate and the loss does not occur. Reversibility (U-shape) is demonstrated, not emergence. | `src/core/cultural_loss.test.ts` |
| **Gene–culture coevolution** (083) | unlock above `GENE_CULTURE_KNOWLEDGE_LEVEL` for the above-band `size` genotype | **[established]** for lactase; the knowledge channel it builds on stays **[design-abstraction]** | The unlock is gated on the knowledge level and the size band; `geneCultureCoupling = 0` (or culture off) makes it inert. The biological feedback is real (lactase, s ≈ 0.09–0.19) but the knowledge scaffold is designed, not emergent. | `src/core/gene_culture.test.ts` |
| **Transitions / complexity state** (085) | sustained local density **and** mean knowledge above cutoffs (`transitionDensity`, `transitionKnowledge`, `transitionWindow`) | **[speculative]** | In an identical dense, high-knowledge ecology, with `transitions` off **no** region ever enters the complexity state across seeds; with it on the state arises. The state is the product of the modeller-set detector, not open-ended emergence. | `src/core/emergence_ablation.test.ts` ("the transitions complexity state is scaffolded, not emergent"); `src/core/transitions.test.ts` |

## Reading the result

For every landed capacity the ablation evidence points the same way: **no detector ⇒
no capacity**. That is the expected outcome for a scaffolded capacity, and it is what
keeps the [design-abstraction] / [speculative] labels honest. None of these capacities
has produced the target behaviour with its detector disabled, so **none is labelled
"emergent"**. Should a future change make a capacity recur across seeds without its
detector, this note (and the relevant specification rule) is where the upgrade would be
recorded, against the rule stated above.

This note adds no simulation rule and changes no run; the ablation harness only runs the
existing simulation with the relevant detector toggle on versus off.
