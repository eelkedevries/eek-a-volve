# Task: optional WebAssembly simulation core (default-off)

## Goal

Add an optional, default-off WebAssembly implementation of the hot simulation
loop that produces results equivalent to the TypeScript core, with the TS core
retained as the default and automatic fallback — raising the performance ceiling
for very large worlds.

## Scope

An alternative compute core for the deterministic hot path only (grid, behaviour,
energy, food, mutation, reproduction, bounds, loop). No change to defaults, to the
worker/render protocol, or to drawn output. Gated behind a capability check and a
toggle.

## Context (optional-capability principle, spec v0.4.0)

Per the spec, default-off with the TS core as the automatic fallback, no change to
the default run, and **equivalent results** to the TS core. The hard problems —
flagged deliberately — are (a) **determinism parity**: floating-point and
transcendental functions (`sin`, `cos`, `sqrt`, `log` in `rng.ts`/`behaviour.ts`)
can differ between JS and a WASM stdlib, so byte-identical parity may be
unattainable and the realistic contract is *statistical/behavioural equivalence*
(same population-stability envelope and trait dynamics from the same seed), which
the spec language must reflect; (b) **toolchain**: a compiled language
(AssemblyScript is closest to the TS source and avoids a heavy toolchain) and a
build step that fits the Vite/Pages pipeline; (c) **no `SharedArrayBuffer`** (Pages
lacks COOP/COEP), so the WASM memory is owned by the worker and snapshots are
copied out as today.

## Required changes

1. Decide and record the equivalence contract (byte-identical if achievable, else
   documented statistical/behavioural equivalence) and the toolchain in
   `specification.md`; bump the version.
2. Add the WASM core (AssemblyScript recommended) implementing the hot path with the
   same fixed timestep and the same seeded RNG algorithm, built into the Vite
   pipeline without breaking the Pages build or committing secrets.
3. Gate it behind a capability check and a default-off toggle; the TS core remains
   the default and the automatic fallback when WASM is unavailable or off.
4. Add parity tests comparing the WASM core to the TS core from the same seed
   against the agreed equivalence contract, plus the population-stability envelope.
5. Update `docs-dev/planning/current_state.md`.

## Do not implement

Do not implement: removal of the TS core; reliance on `SharedArrayBuffer`; a change
to defaults or to drawn output; a GPU-compute core (separate, still out of scope).

## Acceptance criteria

- With the toggle off (default), the simulation is the TS core, unchanged
  (determinism and 012 stability green).
- With it on and supported, the WASM core advances the simulation and meets the
  agreed equivalence contract vs the TS core from the same seed; on an unsupporting
  browser it falls back to the TS core automatically.
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add parity and stability tests. **If
determinism/equivalence parity cannot be met or the toolchain cannot be integrated
safely in this environment, do not commit** — report what was achieved and the
blocker, per `AGENTS.md` (faithful reporting).

## Commit and push

If and only if the scope was followed, the default path is provably unchanged, the
equivalence contract is met, and checks pass, commit on `main` using this file's
exact filename (`060_wasm_core.md`), then push. Do not commit partial, failing, or
unverifiable work.

## Final report

End with the required final report specified in `AGENTS.md`.

## Delivery status (incremental)

A full-core port (~2,757 lines of interdependent logic to AssemblyScript) is not a
single-session unit, so this prompt is delivered incrementally, equivalence-gated:

- **Increment 1 (done, v0.4.3):** the per-tick metabolism/reap pass runs in a
  WebAssembly kernel (`src/wasm/metabolism.as.ts` → `metabolism.wasm`, via
  `metabolismCore.ts`), **bit-for-bit identical** to the TS pass (proven by a
  full-run equivalence test) behind the default-off `wasmCore` toggle, with the
  AssemblyScript toolchain wired into `npm run build` and automatic TS fallback.
- **Remaining (TS for now):** spatial-grid build, behaviour/movement, food
  regeneration, mutation/reproduction, predation, bounds, and the loop driver. The
  equivalence contract for those becomes *statistical* once transcendentals
  (`sin/cos/log` in the RNG/seasons) are involved. Performance gains require these
  heavy passes ported and copy-free shared memory between JS and wasm.
