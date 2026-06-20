# Task: export and import an evolved population

## Goal

Let a run's whole living population (genomes and key state) be exported to a file
and imported to start a new run from that exact population — the next persistence
step after 045's seed/parameter share link.

## Scope

Implement a serialiser for the living population, a worker init path that seeds
from it, and minimal UI to export (download) and import (file). Do not implement
autosave, cloud storage, or mid-run loading.

## Context

A run starts from `SimulationParameters` + seed; the worker creates the
`Simulation`, which seeds a random founding population (`src/core/loop.ts`
`seed()` via `spawnRandomAgent`). 045 added a pure params codec
(`src/core/share.ts`). The world is structure-of-arrays
(`src/core/world.ts`: id, parentId, generation, age, energy, x, y, traits) with a
fixed `TRAIT_COUNT`. The worker protocol/init is in `src/worker/protocol.ts` and
`simulationWorker.ts`; setup/start UI is `src/ui/setupScreen.ts` and
`src/main.ts`. The spec's locked decision already anticipates "export and import
of seed, parameters, and optionally genomes"; this implements the genome part, so
update that locked-decision note and bump the version.

## Required changes

1. Add a pure serialiser (e.g. `src/core/population.ts`): encode the live
   population (per creature: traits, energy, age, generation, position, and ids)
   plus the parameters and current tick to a compact, versioned, validated form;
   and decode it back, clamping/validating defensively (never throw on bad
   input), reusing the params codec where sensible.
2. Add an optional `population` payload to the worker `init` message and a
   `Simulation` seeding path that, when present, loads creatures from it (within
   the population ceiling, traits clamped) instead of generating random founders;
   the RNG is still seeded from `params.seed`, so the continuation is itself
   deterministic.
3. Add a worker→main "export" reply (or compute on main from a state request)
   returning the serialised population for download, and wire UI: an "Export
   population" action during a run (download a file) and an "Import" control on
   the setup screen (load a file, then start from it).
4. Update `specification.md` (Locked decisions — genome export/import now
   implemented; note continuation determinism) and bump the version. Update
   `docs-dev/planning/current_state.md`.

## Do not implement

Do not implement:
- automatic save/restore across reloads;
- loading a population into an already-running simulation (start only);
- server upload or short links;
- bit-identical continuation of the *original* future (only that the loaded run
  is itself reproducible).

## Acceptance criteria

The task is complete when:
- a round-trip unit test passes: decoding an encoded population yields the same
  creatures (traits/state) within tolerance, and decoding garbage yields a valid,
  clamped result without throwing;
- exporting a run and importing the file starts a new run whose initial
  population matches the exported one, and that run is deterministic from there;
- the default random-seeding path is unchanged when no population is supplied
  (stability and determinism tests stay green);
- `npm run build` passes and `npm test` stays green.

## Checks

Run `npm run build` and `npm test`. Add core tests for the serialiser round-trip,
robustness, and the population-seeding init path.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`053_population_export.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
