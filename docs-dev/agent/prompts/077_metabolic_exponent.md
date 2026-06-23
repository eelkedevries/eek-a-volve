# Task: tunable metabolic scaling exponent (Kleiber)

## Goal

Make the size→metabolic-cost relationship scale as `size^exponent` with a tunable
`metabolicExponent`, since the literature contests whether metabolic rate scales
with mass at 2/3, 3/4, or ~1; default it to the value that reproduces today's
linear-in-size cost, leaving the default run byte-for-byte unchanged.

## Goal label

This coupling is **[debated]**: the allometric exponent (Kleiber's 3/4 vs the
surface-rule 2/3 vs isometric 1) is genuinely contested, so it is exposed as a
tunable choice defaulting to the conservative value that reproduces current
behaviour — not asserted as a settled constant.

## Scope

Implement only the `metabolicExponent` parameter and raising the `size` term of
`metabolicCost` to that exponent, plus the accompanying tests and specification
update. Do not implement a WBE-style metabolic-network model, per-trait exponents,
an exponent on the `speed` term, any setup-screen control, or any coupling to other
systems — these are out of scope.

## Context

Per-tick metabolic drain is computed in `metabolicCost` in `src/core/energy.ts`.
The current baseline is `cost = (baseMetabolicCost * (size + speed)) / efficiency`,
where `size` is `world.traits[SIZE][slot]` and ranges `0.5..2.0`
(`TRAIT_RANGES[SIZE]`, `src/core/genome.ts`). The `size` term enters **linearly**
(exponent 1), so the default value of the new exponent must be exactly `1` for a
byte-for-byte-identical default run. `metabolicCost` is also where prompt 072's
optional `cognitionCost` factor and the sexual `DISPLAY_COST` factor are applied
(both multiplicative, after the base cost); this prompt changes only how `size`
enters the base term and leaves those factors untouched.

The same baseline cost is computed bit-for-bit in the WASM metabolism kernel
(`run` in `src/wasm/metabolismCore.ts`, the `metabolise` pass), which takes
`baseMetabolicCost` as a parameter and combines `size`, `speed`, and `efficiency`
identically to the TypeScript pass; the WASM core is gated to be bit-for-bit
identical to the TS pass (specification: Locked decisions). Because raising `size`
to a non-unit exponent would diverge from the kernel — which has no exponent
parameter — the run must fall back to the TypeScript metabolism pass whenever
`metabolicExponent !== 1`, exactly as the loop already falls back to TS when
`cognitionCost !== 0` (`src/core/loop.ts`, step 4: `this.wasm !== null &&
params.cognitionCost === 0 ? this.wasm.metabolise(...) : metaboliseAndReap(...)`).
Extend that condition so the WASM `metabolise` path is used only when both
`cognitionCost === 0` **and** `metabolicExponent === 1`; with the default exponent
the WASM path is taken exactly as today. Do not add an exponent to the kernel
(WASM-fallback rule, plan §4.7) — porting it is out of scope.

Parameters live in `src/core/params.ts` (`SimulationParameters` +
`DEFAULT_PARAMETERS`). The binding canon is
`docs-dev/reference/primary_authoritative/specification.md`; this prompt adds a
parameter and extends a domain rule, so it must be accompanied by a specification
update and a version bump. This coupling is independent of the disease/grouping
work and can land in any order relative to 073–076. Background and rationale
(non-binding): `docs-dev/planning/science_integration_plan.md` §4 (cross-cutting
rules) and §5, prompt 077.

## Required changes

1. Add `metabolicExponent: number` to `SimulationParameters` in `src/core/params.ts`,
   documented as the allometric exponent applied to `size` in the per-tick
   metabolic drain (a debated modelling choice: ≈0.67 surface-rule, 0.75 Kleiber,
   1.0 isometric); a tunable coefficient whose default reproduces today's
   behaviour. Set it to `1` in `DEFAULT_PARAMETERS` — the value that reproduces the
   current linear-in-size cost. Do not add it to `COMMUNITY_PRESET` or
   `SWARM_PRESET`.
2. In `metabolicCost` (`src/core/energy.ts`), replace the `size` contribution to
   the base term with `size` raised to `params.metabolicExponent`, so the base cost
   becomes `(baseMetabolicCost * (size^exponent + speed)) / efficiency`. Guard the
   common case so the default run is unchanged: when `metabolicExponent === 1`, take
   exactly the current arithmetic (`size`, not `Math.pow(size, 1)`), so the result
   is byte-for-byte identical and the prompt-012 stability test is unaffected. Keep
   the per-tick path allocation-free and deterministic (no new RNG draws); leave the
   `cognitionCost` and `DISPLAY_COST` factors exactly as they are.
3. In `src/core/loop.ts`, extend the metabolism-pass branch so the WASM
   `metabolise` kernel is used only when `cognitionCost === 0` **and**
   `metabolicExponent === 1`, otherwise `metaboliseAndReap` runs in TypeScript
   (WASM-fallback rule). Do not change `metabolismCore.ts` or the kernel.
4. Update `specification.md`: Domain rules → Energy budget (the `size` contribution
   to the per-tick drain is raised to a tunable `metabolicExponent`, a debated
   allometric choice defaulting to 1 — the byte-for-byte default; sublinear values
   make large bodies relatively cheaper, isometric keeps cost proportional to size)
   and Data schemas (the new `metabolicExponent` parameter, default 1). Bump the
   version (≈0.6.3, sequencing after the disease prompts — choose the next free
   version at run time if they have not all landed). Update
   `docs-dev/planning/current_state.md` to note the new coupling.

## Do not implement

Do not implement:
- a West–Brown–Enquist (WBE) metabolic-network derivation of the exponent;
- per-trait or per-lineage exponents, or an exponent on the `speed` term;
- adding the exponent to the WASM kernel (it falls back to TS when the exponent is
  non-unit; porting it is a separate, later optimisation);
- exposing `metabolicExponent` in the setup screen, the setup help, or any preset
  (a later UI prompt);
- any coupling to disease, culture, grouping, predation, or reproduction;
- any default-on behaviour (non-unit default) or any post-start control.

## Acceptance criteria

The task is complete when:
- with `metabolicExponent = 1`, a fixed seed and parameters reproduce a run
  exactly, identical to the pre-change core (the determinism test passes), the WASM
  metabolism path is still taken when the core is on, and the population-stability
  test (prompt 012) stays green — the exponent is inert at its default;
- with `metabolicExponent !== 1` and a fixed seed and parameters, the run is
  exactly reproducible (a determinism test in a non-unit-exponent mode passes) and
  the metabolism pass runs in TypeScript;
- a focused core test shows the expected effect on body size: from the same seed, a
  sublinear exponent (e.g. 0.67) ends with a higher population-mean `size` than an
  isometric run (exponent 1) under otherwise identical ecology — larger bodies are
  relatively cheaper when the exponent is below 1;
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for determinism with a non-unit
exponent and for the size-distribution shift (sublinear vs isometric), and confirm
the prompt-012 stability test still passes unchanged on the default path.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`077_metabolic_exponent.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
