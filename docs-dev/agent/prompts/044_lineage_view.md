# Task: lineage tracking and an ancestry line in the inspector

## Goal

Give every creature a recorded parent and let the inspector show its short
ancestry chain (by name), so an adopted creature has a visible family tree going
back a few generations, while keeping the simulation deterministic and the
per-tick path allocation-free.

## Scope

Implement only single-parent lineage tracking and the inspector's ancestry line.
Do not implement a population-wide phylogeny chart, a clade tree visualisation, a
descendants count beyond the existing `offspringCount`, or any render overlay —
those are later prompts.

## Context

Core conventions: a structure-of-arrays world with pooled, reused slots
(`src/core/world.ts`), a stable per-creature `id` column (a reused slot gets a
fresh id; 0 means none), and `generation` / `offspringCount` columns already on
the world. Births happen in `src/core/behaviour.ts` (both the sexual branch,
which has two parents, and the asexual branch, which has one) and via
immigration / founding in `src/core/bounds.ts` (`spawnRandomAgent`). The
inspector pulls a `CreatureDetail` on demand through `src/core/inspect.ts`, which
crosses the worker boundary by structured clone and is rendered by
`src/ui/inspector.ts` (names come from `personalName(id)` in
`src/humour/names.ts`). The render snapshot is append-only and is **not**
involved here. The binding canon is
`docs-dev/reference/primary_authoritative/specification.md`; this prompt adds a
data field and a small rule, so it must be accompanied by a specification update
and a version bump.

Because slots are recycled on death, the world arrays alone cannot walk an
ancestry past a living creature: a bounded registry is needed to remember recent
`id → parentId` links after the parent has died.

## Required changes

1. Add a `parentId: Uint32Array` column to `World` (`src/core/world.ts`),
   allocated with the other agent columns. Have `spawnAgent()` reset it to `0`
   (so founders and immigrants are parent-less, matching the `id`-0 convention).
2. In `src/core/behaviour.ts`, set `world.parentId[child]` at every birth: the
   single initiating parent (`s`) in the asexual branch, and one designated
   parent (the initiating parent `s`) in the sexual branch. Do not allocate.
3. Add a bounded lineage registry to `core` (e.g. `src/core/lineage.ts`): a
   fixed-capacity, pre-allocated ring of `id → parentId` records with a
   `record(id, parentId)` call (allocation-free) and a `parentOf(id)` lookup that
   returns the parent id or `0` when unknown/too old. Own one on `Simulation`
   (`src/core/loop.ts`) and record each newborn this tick (mirror the existing
   `freakBirths` drain pattern — expose the tick's newborn slots from `Behaviour`
   via a pre-allocated array, and have the `Simulation` record them). The
   registry must not influence any simulation decision.
4. Extend `inspectCreature` (`src/core/inspect.ts`) to add an
   `ancestry: number[]` to `CreatureDetail`: the chain of ancestor ids,
   nearest-first, excluding self, resolved by walking `parentId` (from the world
   for living ancestors, else the registry) up to a small fixed depth
   (e.g. 8), stopping at `0` or an unknown id. A small array here is acceptable —
   this is the on-demand inspect path, not the per-tick path.
5. In `src/ui/inspector.ts`, render the ancestry as one compact line using
   `personalName(id)` for each ancestor (for example, `Lineage: Gary ←
   Wigglethorpe ← Mossbeak`), shown only when the chain is non-empty. Keep the
   card within its existing size; do not introduce a new scrollable region.
6. Update `specification.md` (Data schemas: the `parentId` column and the bounded
   lineage registry for ancestry display; a one-line Domain-rules note that
   lineage is observational metadata and never affects simulation decisions) and
   bump the version. Update `docs-dev/planning/current_state.md` to note the new
   system.

## Do not implement

Do not implement:
- a population-wide phylogeny / clade tree, or any tree visualisation;
- a render overlay, lineage lines beyond the existing parent→newborn FX, or a
  minimap;
- storing both parents of a sexual birth (single designated parent only in this
  minimal version);
- any post-start control or god tool.

## Acceptance criteria

The task is complete when:
- a fixed seed and parameters reproduce a run exactly (the determinism test
  passes) — the lineage data is recorded but never read back into the
  simulation;
- a core test shows that breeding sets `parentId` correctly and that
  `inspectCreature` returns a correct multi-generation ancestry chain, including
  the case where an intermediate ancestor has died (resolved via the registry)
  and the case of a founder (empty chain);
- the registry is bounded: it does not grow without limit over a long run;
- the population-stability test remains green;
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for `parentId` assignment, the
bounded registry, and ancestry resolution across generations and deaths.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`044_lineage_view.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
