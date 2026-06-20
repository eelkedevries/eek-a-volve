# Task: Stable creature identity, lineage, and action state

## Goal

Give every creature a stable identity, a lineage, and a recorded action each tick — the foundation the whole "relatability" half of the overhaul stands on.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Today agents are identified only by slot, and slots are reused on death/birth, so nothing downstream can track *a particular creature* across frames (adopt/follow, records holders, the Elder, birth/death cues, names, lineage all need this). Add the per-agent bookkeeping in `core/` so it is deterministic and testable; the snapshot will carry the id next.

## Required changes

1. Add to `World`: a `id: Uint32Array` (assigned from a monotonic counter in `spawnAgent`, so a reused slot gets a *new* id), a `generation: Uint32Array`, and an `offspringCount: Uint32Array`. Reset appropriately on spawn.
2. In `src/core/state.ts`, define shared `Action` codes as `as const` integers (no `enum`): `IDLE`, `SEEKING`, `EATING`, `FLEEING`, `HUNTING`, `COURTING`, plus `ACTION_COUNT`; add an `action: Uint8Array` column to `World`.
3. Maintain lineage at reproduction (the existing asexual path in `behaviour.ts`): set the child's `generation = parent.generation + 1` and increment the parent's `offspringCount`. Founders/immigrants (`spawnRandomAgent` in `bounds.ts`) get `generation = 0`.
4. Record each acting agent's `action` each tick in `behaviour.ts` (flee ⇒ `FLEEING`; ate ⇒ `EATING`; has food target ⇒ `SEEKING`; else ⇒ `IDLE`) and a successful predator in `predation.ts` ⇒ `HUNTING`.
5. Tests: ids are unique and monotonic, and a reused slot receives a new id; generation increments on reproduction and the parent's offspring count rises; each action is recorded for the right situation; all deterministic; the population-stability test still passes.

## Do not implement

Do not implement:
- the snapshot/worker changes (next prompt), rendering, the inspector, or names;
- life stages or sexual reproduction.

## Acceptance criteria

The task is complete when:
- tests pass for id uniqueness/monotonicity + slot-reuse, lineage tracking, action recording, determinism, and stability;
- `npm run build` succeeds.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`025_identity_and_state.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
