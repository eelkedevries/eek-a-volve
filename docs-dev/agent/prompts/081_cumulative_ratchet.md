# Task: cumulative culture above a fidelity threshold (ratchet)

## Goal

Make culture cumulative only above a transmission-fidelity threshold: with high
fidelity, small innovations persist and knowledge ratchets upward; below the
threshold they decay away, so trait longevity rises sharply (≈exponentially) with
fidelity — leaving the default run byte-for-byte unchanged.

## Goal label

This is a **[design-abstraction]**, never "emergent": the ratchet is a designed
non-linearity in fidelity, not an open-ended emergent property. Label it so in the
code and the specification. Sub-threshold runs must show **no** cumulative gain — the
ratchet is conditional, not automatic.

## Scope

Implement only: a small innovation increment applied on a successful copy, and a
fidelity-dependent longevity/decay so accumulation is non-linear in
`transmissionFidelity` (a ratchet above a threshold, decay below it); plus the
accompanying tests and specification update. This builds directly on prompt 080
(`social_learning_core`) and changes nothing when culture is off. Do not implement
cultural loss below a critical population size (082), gene–culture coevolution (083),
unbounded knowledge, or any render/UI.

## Scope guard

This prompt assumes prompt 080 (`social_learning_core`) has landed: the `culture`
toggle, `transmissionFidelity`, the `knowledge` column, the `src/core/culture.ts`
pass and its registration in `src/core/loop.ts`, the foraging return, the appended
snapshot aggregate, and the WASM-fallback wiring all exist. If 080 has not landed,
stop and flag it rather than re-implementing the social-learning core here.

## Context

The culture pass (`src/core/culture.ts`, added by 080) already, when
`params.culture` is on: copies a fraction of the best neighbour's `knowledge` toward
each agent with probability `transmissionFidelity` (seeded `Rng`), optionally decays
knowledge, and improves foraging via knowledge. This prompt makes accumulation
*cumulative and threshold-gated*:

- **Innovation on copy.** On a successful copy, add a small innovation increment so a
  learner can end up slightly *above* its model — the source of ratcheting. Keep it
  bounded.
- **Fidelity-dependent longevity.** Tie how well knowledge persists to fidelity: above
  a fidelity threshold (a `core/` constant or a parameter) the per-tick decay is
  small enough that innovations accumulate; below it, decay dominates and gains are
  lost. Shape this so trait longevity / accumulated knowledge rises steeply with
  fidelity around the threshold (the Lewis & Laland result: longevity grows roughly
  exponentially with fidelity), i.e. accumulation is markedly **non-linear** in
  `transmissionFidelity`, not proportional.

`knowledge` should stay bounded (a clamp or a saturating return, in `core/`), so
"cumulative" means it climbs to and holds a higher level under high fidelity, not
that it grows without limit. Per the determinism rule, any additional stochastic
choice must draw from the run's seeded `Rng` **only** when `culture` is on (with the
default `culture` off, nothing changes; and prefer to fold the innovation into the
existing copy branch so the RNG stream is advanced predictably). The 080
WASM-fallback wiring already forces the TS hot loop whenever `culture` is on, so this
inherits that fallback; do not add ratchet logic to the WASM kernel
(WASM-fallback rule, plan §4.7).

Parameters live in `src/core/params.ts`. The binding canon is
`docs-dev/reference/primary_authoritative/specification.md`; this extends the Culture
domain rule (and may add a threshold/innovation constant or parameter), so it must be
accompanied by a specification update and a version bump. Background and rationale
(non-binding): `docs-dev/planning/science_integration_plan.md` §4 (cross-cutting
rules) and §5, prompt 081.

## Required changes

1. In `src/core/culture.ts`, add a small, bounded innovation increment on a
   successful copy so accumulation is possible, and make knowledge persistence depend
   on fidelity: above a fidelity threshold gains accumulate (small decay); below it
   they decay away. Shape accumulation to rise steeply (≈exponentially) with
   `transmissionFidelity` around the threshold. Keep `knowledge` bounded (clamp or
   saturating). If a threshold or innovation magnitude needs configuring, add it as a
   `core/` constant or a documented parameter in `src/core/params.ts` defaulting to a
   value that is inert when `culture` is off. Keep the pass allocation-free; draw RNG
   only when `culture` is on.
2. Ensure the default path is untouched: with `culture` off, the pass behaves exactly
   as after 080 (no innovation, no extra decay, no extra RNG), so the default run and
   the prompt-012 stability test are byte-for-byte unchanged.
3. Update `specification.md`: extend the Domain rule "Culture (social learning) —
   [design-abstraction]" (accumulation is cumulative only above a fidelity threshold —
   innovations persist and ratchet upward with high fidelity, decay below it, with
   trait longevity rising sharply with fidelity; knowledge stays bounded; off by
   default) and Data schemas (any new threshold/innovation constant or parameter).
   Bump the version (≈0.7.1, after 080 — choose the next free version at run time).
   Update `docs-dev/planning/current_state.md` to note the extension.

## Do not implement

Do not implement:
- cultural loss below a critical population size (prompt 082);
- gene–culture coevolution (prompt 083) or technology→carrying-capacity (prompt 085);
- open-ended or unbounded knowledge growth (keep it bounded/saturating);
- any "emergent" labelling of the ratchet;
- a render cue or setup-screen control;
- porting the ratchet into the WASM kernel;
- any default-on behaviour or any post-start control.

## Acceptance criteria

The task is complete when:
- with `culture = false`, a fixed seed and parameters reproduce a run exactly,
  identical to the post-080 core (the determinism test passes) and the
  population-stability test (prompt 012) stays green — the ratchet is inert by
  default;
- with `culture = true` and a fixed seed and parameters, the run is exactly
  reproducible (a determinism test passes);
- a focused core test shows the conditional ratchet: above the fidelity threshold,
  mean `knowledge` climbs to and holds a higher level than the copy-only behaviour
  (080) would; below the threshold it shows **no** cumulative gain (it decays toward
  zero) — accumulation is non-linear in fidelity, not automatic;
- `knowledge` stays bounded across a long run;
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for determinism with the ratchet,
for above-threshold accumulation vs below-threshold decay, and confirm the prompt-012
stability test still passes unchanged on the default path.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`081_cumulative_ratchet.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
