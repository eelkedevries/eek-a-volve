# Task: performance/scaling core (SPEC-LOCKED — needs approval before running)

> ⚠️ **This prompt conflicts with locked spec decisions and is a major
> architectural effort.** `specification.md` records WebAssembly/GPU-compute
> simulation cores and OffscreenCanvas rendering as *out of scope for the first
> version*. Per `AGENTS.md`, the spec is ground truth; a conflicting change must
> be flagged and the spec deliberately updated first. Do **not** run this as a
> single automated prompt. This file captures the intent and the risks.

## Goal

Raise the performance ceiling so much larger worlds/populations stay smooth, via
one of: OffscreenCanvas rendering (move PixiJS off the main thread) and/or a
WebAssembly simulation core for the hot loop.

## Why this is large and risky

- **Out of scope by decision:** both options are explicitly deferred in the spec;
  adopting one is an architecture change, not a feature, and must be a deliberate,
  documented decision with a version bump.
- **OffscreenCanvas:** moves rendering to a worker, changing the main-thread/worker
  split, input handling, and the PixiJS bootstrap; needs a fallback for browsers
  without it; interacts with the existing transferable-snapshot design.
- **WASM core:** reimplements the deterministic hot path (grid, behaviour, energy,
  reproduction) in a compiled language with identical results; the build, the
  determinism guarantees, and the no-`SharedArrayBuffer` constraint (GitHub Pages
  lacks COOP/COEP) all bear on it. Bit-for-bit determinism parity with the TS core
  is a hard requirement and a hard problem.
- **Scope:** realistically several prompts with careful benchmarking, behind a
  capability check, with the current path retained as the default/fallback.

## Suggested decomposition (to be authored as a sub-sequence, after a spec update)

1. Spec: decide which path (OffscreenCanvas and/or WASM), record the constraints
   (determinism parity, fallback, no `SharedArrayBuffer`), and bump the version.
2. A benchmark harness and target (population × tick-rate) to measure against.
3. The chosen implementation behind a capability check, with the existing core/
   renderer retained as the default and automatic fallback.
4. Determinism-parity tests vs the TS core and stability at the new scale.

## Acceptance criteria

Not runnable as-is. Complete only when the maintainer has approved a specific path,
the spec has been updated, and the decomposed sub-prompts each pass `npm run build`
and `npm test` with determinism parity and the 012 stability test green, and the
existing path retained as a fallback.

## Commit and push

Do not implement or commit from this file. It is a flagged proposal; await explicit
approval and a spec decision, then author and run the sub-sequence.

## Final report

If asked to act on this file, stop and flag the spec conflict per `AGENTS.md`
instead, then end with the required final report.
