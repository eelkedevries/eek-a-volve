# Task: Expanded render snapshot (food, heading, state)

## Goal

Carry everything the renderer needs to draw a legible world: food items, and per-agent heading and packed state (action + life stage).

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

The snapshot currently carries only agent x, y, colour index, and scale — too little to draw food, facing, or behaviour. Extend it once, cleanly, since many later prompts depend on it. Keep serialisation pure/testable; resize the worker's ping-pong buffers to fit.

## Required changes

1. In `src/core/snapshot.ts`, extend the format **by appending only, so existing offsets stay valid** and current consumers (renderer, chart, narrator) keep working: add the food count as a new header field *after* the existing ones; *after* the existing four agent fields (x, y, colourIdx, scale) append `heading` (from velocity), a packed `stateCode`, the agent's stable `id` (from 025; carried as a float — exact for the in-window ids of live agents), and an `energyFraction` (current energy ÷ capacity, 0–1, for hunger/starvation tells); then append a food block of `(x, y, type)` per live food item after the whole agent block.
   - **Pin the packing:** `stateCode = (stage << 3) | action` — low 3 bits = action (0–5), next 2 bits = life stage (0–2). Export the masks so 027/031/033/034 decode identically.
   - Export updated stride/offset constants and `snapshotLength(agentCapacity, foodCapacity)` taking **both** capacities.
   - **Channel convention:** only the agent and food blocks ride the ping-pong snapshot buffer; later metadata (events, inspect replies, records) travels as separate typed worker messages, not appended to this buffer.
2. Update `serialiseSnapshot` to write the new fields and the food block, returning agent and food counts.
3. Resize the worker's two transferable buffers (`src/worker/simulationWorker.ts`) to `snapshotLength(MAX_POPULATION, world.foodCapacity)` — food capacity is run-dependent, so read it from the world, not a constant; update the client/snapshot consumers to read agent and food counts.
4. Tests: header food count matches; agent heading and packed state round-trip (and unpack) correctly; the food block lists live food; lengths are correct.

## Do not implement

Do not implement:
- the detailed renderer, emotes, or camera (later prompts);
- life-stage mechanics (only carry the stage byte, default 0 for now).

## Acceptance criteria

The task is complete when:
- tests pass for the new header, agent, and food fields;
- `npm run build` succeeds and the worker still bundles.

## Checks

Run `npm run build` and `npm test`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`026_expanded_snapshot.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
