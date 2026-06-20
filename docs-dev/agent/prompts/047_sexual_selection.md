# Task: preference-driven sexual selection (ornamentation)

## Goal

Add two genome traits — a costly `display` ornament and a `matePreference` for
ornament size — and let mate choice weight a candidate's display against the
chooser's preference within the existing compatibility gate, so that in sexual
runs ornamentation can be driven by preference (a runaway-selection signature)
while the cost keeps it honest. Inert by default (asexual), so the default run is
unchanged.

## Scope

Implement only the two new traits, the display cost, and the preference-weighted
mate choice in the sexual branch. Do not implement a visible ornament render cue,
female/male sexes, assortative speciation, or any change to asexual reproduction
— a visible plume is a noted follow-on.

## Context

The genome is a fixed-length, column-wise trait array (`src/core/genome.ts`):
`TRAITS`, `TRAIT_COUNT`, per-trait indices, and `TRAIT_RANGES`. Crucially, the
render snapshot header (`H_TRAIT_MEANS`, `H_FOOD_COUNT`, `HEADER_LENGTH` in
`src/core/snapshot.ts`), the world's trait columns (`src/core/world.ts`), founder
/ immigrant trait initialisation (`spawnRandomAgent` in `src/core/bounds.ts`),
breeding (`src/core/mutation.ts`), and the inspector's trait chips
(`src/ui/inspector.ts`) are all derived from `TRAIT_COUNT` and iterate the trait
columns generically — so appending traits should extend them automatically.
Mate choice and the sexual birth live in `src/core/behaviour.ts`, gated behind
the existing genetic-distance compatibility check and `params.sexualReproduction`
(default off; on in the community preset). Metabolic cost is applied in
`src/core/energy.ts`. The binding canon is
`docs-dev/reference/primary_authoritative/specification.md`; this prompt adds data
fields and a domain rule, so it must be accompanied by a specification update and
a version bump.

## Required changes

1. Append two traits to `TRAITS` in `src/core/genome.ts`, taking `TRAIT_COUNT`
   from 6 to 8: `display` (ornament magnitude) and `matePreference` (preferred
   display level). Add their column indices and `TRAIT_RANGES` entries. Keep the
   six existing traits and their order unchanged so earlier columns are stable.
2. Verify (and adjust only where something is hard-coded rather than derived from
   `TRAIT_COUNT`) that the world columns, `spawnRandomAgent`, `breed` /
   `breedSexual`, the snapshot offsets, and the inspector chips all extend to the
   two new traits without manual offset edits.
3. Apply a viability cost to `display` so ornament is honest: increase a
   creature's per-tick metabolic drain in proportion to its `display`
   (`src/core/energy.ts`). Gate this cost behind `params.sexualReproduction` so
   that asexual default runs (and the 012 stability test) are unaffected, and the
   two new traits merely drift in asexual mode.
4. In the sexual branch of `src/core/behaviour.ts`, within the existing
   compatibility gate, score candidate mates by a combination of proximity and
   how well the candidate's `display` matches the chooser's `matePreference`, and
   court / pair with the best-scoring compatible candidate rather than simply the
   nearest. Keep it allocation-free and deterministic; leave flee / seek-food /
   eat priorities and the asexual branch unchanged.
5. Update `specification.md` (Data schemas: the `display` and `matePreference`
   traits; Domain rules → Reproduction and mutation: in sexual mode, mate choice
   weights display against preference inside the compatibility gate, and display
   carries a viability cost; both are inert in asexual mode) and bump the version.
   Update `docs-dev/planning/current_state.md` to note the new system.

## Do not implement

Do not implement:
- a visible ornament / plume render cue (a noted follow-on prompt);
- distinct sexes, or a female-chooses / male-displays asymmetry;
- preference-based changes to the compatibility (speciation) threshold itself;
- any change to asexual reproduction or any post-start control.

## Acceptance criteria

The task is complete when:
- snapshot offsets remain correct with `TRAIT_COUNT = 8` (a test asserts
  `HEADER_LENGTH`, `H_FOOD_COUNT`, and `snapshotLength` follow from
  `TRAIT_COUNT`), and the inspector shows eight trait chips;
- the population-stability test stays green on the default (asexual) parameters —
  the new traits and cost are inert there;
- a fixed seed and parameters reproduce a run exactly in both modes (the
  determinism test passes);
- a focused core test shows directional change: in a sexual run with a strong,
  consistent preference, the population mean `display` shifts across generations
  relative to a control run without preference weighting;
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for the snapshot-offset
invariants at `TRAIT_COUNT = 8`, for determinism in sexual mode, and for the
sexual-selection directional-change effect.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`047_sexual_selection.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
