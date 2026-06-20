# Task: a family tree for the adopted creature

## Goal

Show the adopted/inspected creature's local family tree — its ancestry chain and
its living descendants/relatives — as a small node-link diagram, building on the
lineage data added in 044.

## Scope

Implement a worker query that returns a bounded family around an id, and a UI
panel that draws it. Do not build a full population-wide phylogeny, and do not
change the simulation rules.

## Context

044 added a per-creature `parentId` column and a bounded `LineageRegistry` on
`Simulation` (`src/core/lineage.ts`, with `resolveAncestry`). The inspector pulls
a `CreatureDetail` on demand via `src/core/inspect.ts` over the worker protocol
(`src/worker/protocol.ts`, `simulationWorker.ts`, `client.ts`) and renders it in
`src/ui/inspector.ts` (names from `personalName`). Slots recycle, so descendants
must be found by scanning living creatures, and the registry is bounded (deep
links may be unknown) — the tree is necessarily a recent, local view.

## Required changes

1. Add a core helper (in `src/core/lineage.ts` or `inspect.ts`) that, given a
   `Simulation` and an id, returns a bounded family: the ancestry chain (reuse
   `resolveAncestry`) and the living descendants of that id up to a small depth
   (found by checking, for each living creature, whether the id appears in its
   resolved ancestry), capped in count. Plain data, structured-clone friendly.
2. Add a worker message (mirror the `inspect` request/reply) to fetch the family
   for the currently adopted id, throttled like inspect.
3. Add a UI panel (a popover above the dock, like records/legend) that draws the
   family as a simple node-link tree using `personalName(id)` for labels, with
   the focal creature highlighted; shown only while a creature is adopted.
4. Keep it bounded and cheap: cap ancestors (existing `MAX_ANCESTRY`) and
   descendants, and only query while the panel is open.

## Do not implement

Do not implement:
- a full population-wide phylogeny or clade chart;
- persistence of the tree, or historical (dead-creature) graphs beyond what the
  bounded registry supports;
- any simulation-rule change.

## Acceptance criteria

The task is complete when:
- adopting a creature with known parentage and living offspring shows a small
  tree (ancestors above, descendants below) by name, updating as it changes;
- a founder shows just itself and any living descendants;
- the family query is bounded in depth and count, and only runs while the panel
  is open;
- a core test covers the family helper (ancestors + living descendants, including
  a dead intermediate ancestor);
- `npm run build` passes and `npm test` stays green.

## Checks

Run `npm run build` and `npm test`. Add a core test for the family helper; UI
need not be unit-tested.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`052_family_tree.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
