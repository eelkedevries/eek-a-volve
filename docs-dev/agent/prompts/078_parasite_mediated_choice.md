# Task: parasite-mediated mate choice (Hamilton–Zuk)

## Goal

In sexual mode with disease on, let mate choice favour mates of low parasite load
— uninfected neighbours, or those whose `display` ornament is undimmed by infection
— so that choosier lineages gain disease avoidance or resistance, while leaving the
default run byte-for-byte unchanged.

## Goal label

This coupling is **[debated]**: the Hamilton–Zuk parasite-mediated arm of sexual
selection is contested, so it ships as a default-off coefficient that the
synthesis's guidance allows to take **either sign** (avoid-the-infected vs no
preference / the opposite). It must not be presented as settled.

## Scope

Implement only the `parasiteMatingBias` coefficient and its effect on the existing
preference-weighted mate-choice score in the sexual branch of `behaviour.ts`, plus
optionally dimming an infected creature's expressed `display` (honest signal), plus
the accompanying tests and specification update. Do not implement distinct sexes, a
new genome trait, a render cue, a setup-screen control, or any change to the
disease pass itself — these are out of scope.

## Scope guard

This prompt assumes prompt 047 (`sexual_selection`, shipped) **and** prompt 074
(`disease_core`) have landed: the `display` / `matePreference` traits and the
preference-weighted mate score exist in `src/core/behaviour.ts`, and the
`infectionState` column (0 susceptible, 1 infected, 2 recovered/immune) exists on
`World` from 074. If 074 has not landed, stop and flag it rather than implementing
disease here — this prompt only *reads* the infection state, it does not create it.

## Context

Mate choice lives in `src/core/behaviour.ts`. In the sexual branch, the `onAgent`
visitor already, for each compatible (genetic-distance gate over the six ecological
traits), mature, ready neighbour, computes a score that trades proximity against
how well the candidate's `display` matches the chooser's `matePreference`:

```
const mismatch = Math.abs(w.traits[DISPLAY][id] - this.selfPref);
const weighted = dist2 * (1 + MATE_PREFERENCE_WEIGHT * mismatch);
if (weighted < this.bestMateWeighted) { … this.bestMate = id; }
```

The candidate with the lowest `weighted` wins (`MATE_PREFERENCE_WEIGHT` is in
`behaviour.ts`). The parasite term extends this score only: when
`params.disease && params.sexualReproduction && parasiteMatingBias !== 0`, a
candidate's infection load adds to its `weighted` penalty (a positive
`parasiteMatingBias` makes infected candidates *less* attractive — choosers avoid
the sick; a negative value is available per the synthesis's "model competing
positions"). Read infection from `world.infectionState[id]` (the 074 column);
weight an infected candidate (`=== 1`) up, leaving susceptible/recovered unchanged,
so the penalty is contact-/load-driven. Keep the compatibility gate, the
proximity/preference scoring, and the flee / seek-food / eat / court priorities and
ordering otherwise unchanged.

Optionally, also make infection dim the *expressed* ornament so the signal is
honest: where the snapshot/render and the score read a creature's `display`, an
infected creature expresses a reduced effective `display` while ill. If you do
this, apply the reduction consistently wherever effective display is read for mate
scoring (and note it for the render prompt), and keep it inert when `disease` is
off. Do **not** mutate the stored `display` trait — reduce only an effective value
used this tick, so the genome is untouched and the change is reversible on
recovery.

Per the determinism rule, the parasite term must add **no** new RNG draw (mate
choice is deterministic given positions and traits), and must be completely inert
when `parasiteMatingBias === 0` or `disease` is off, so the RNG stream and the
default run are unchanged. The WASM behaviour kernel does not implement disease (074
already forces the TS hot loop whenever `disease` is on, via `canRunBehaviour`), so
this parasite-aware mate choice inherits that fallback and always runs in the TS
behaviour pass; do not add it to the kernel (WASM-fallback rule, plan §4.7).

Parameters live in `src/core/params.ts`. The binding canon is
`docs-dev/reference/primary_authoritative/specification.md`; this prompt extends the
Sexual selection domain rule and adds a parameter, so it must be accompanied by a
specification update and a version bump. Background and rationale (non-binding):
`docs-dev/planning/science_integration_plan.md` §4 (cross-cutting rules) and §5,
prompt 078.

## Required changes

1. Add `parasiteMatingBias: number` to `SimulationParameters` in
   `src/core/params.ts`, documented as how strongly mate choice avoids infected /
   dimmed-ornament candidates in sexual mode with disease on (0 = off, the
   byte-for-byte default; positive avoids the infected; negative is available to
   model the competing position). Set it to `0` in `DEFAULT_PARAMETERS`; do not add
   it to `COMMUNITY_PRESET` or `SWARM_PRESET`.
2. In the sexual mate-choice path of `src/core/behaviour.ts`, when
   `params.disease && params.sexualReproduction && params.parasiteMatingBias !== 0`,
   extend the candidate's `weighted` score with a parasite-load term read from
   `world.infectionState[id]` (infected candidates penalised for a positive bias),
   keeping the existing proximity/preference trade-off intact and the lowest score
   winning. Add **no** RNG draw. When `parasiteMatingBias === 0` or `disease` is
   off, take exactly the current scoring so the default run is byte-for-byte
   unchanged.
3. Optionally express a *reduced effective* `display` for infected creatures while
   ill (honest signalling), applied consistently wherever effective display is read
   for mate scoring, inert when `disease` is off, and **without** mutating the
   stored `display` trait (so it is reversible on recovery). If implemented, note it
   for the disease render prompt (076).
4. Update `specification.md`: extend the Domain rule "Sexual selection" (with
   disease on, mate choice may additionally avoid infected / dimmed-ornament
   candidates by an optional, signed `parasiteMatingBias`, off by default; infection
   may reduce a creature's expressed ornament so the signal stays honest) and Data
   schemas (the new `parasiteMatingBias` parameter, default 0). Bump the version
   (≈0.6.4, sequencing after 074 and 047 — choose the next free version at run
   time). Update `docs-dev/planning/current_state.md` to note the new coupling.

## Do not implement

Do not implement:
- distinct sexes or a female-chooses / male-displays asymmetry;
- a new genome or pathogen trait (read the existing 074 `infectionState`; the
  optional `resistance` trait, if present, is 074's);
- changes to the disease transmission/recovery pass itself (`src/core/disease.ts`)
  or to the genetic-distance compatibility threshold;
- treating Hamilton–Zuk as established, or making `parasiteMatingBias` default-on;
- a "sick" render cue or setup-screen control (prompt 076);
- porting the coupling into the WASM kernel;
- any default-on behaviour or any post-start control.

## Acceptance criteria

The task is complete when:
- with `parasiteMatingBias = 0` (or `disease = false`), a fixed seed and parameters
  reproduce a run exactly, identical to the pre-change core (the determinism test
  passes), the mate-choice path draws no extra RNG, and the population-stability
  test (prompt 012) stays green — the coupling is inert by default;
- with `disease = true`, `sexualReproduction = true`, `parasiteMatingBias > 0`, and
  a fixed seed and parameters, the run is exactly reproducible (a determinism test
  in the parasite-choice mode passes);
- a focused core test shows the effect: under disease, a sexual run with a strong
  positive `parasiteMatingBias` ends with a lower mean infection prevalence (or a
  measurable shift in who reproduces toward the uninfected) than a control run with
  `parasiteMatingBias = 0`, same seed and ecology;
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for determinism in the
parasite-choice mode, for the lower-prevalence (or choosier-reproduction) effect
versus a control, and confirm the prompt-012 stability test still passes unchanged
on the default path.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`078_parasite_mediated_choice.md`) as the
commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
