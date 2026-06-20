# Task: optional OffscreenCanvas (worker) rendering (default-off)

## Goal

Add an optional, default-off rendering path that runs PixiJS on an
`OffscreenCanvas` in a dedicated render worker, freeing the main thread, with the
current main-thread renderer retained as the default and automatic fallback.

## Scope

A capability-gated alternative rendering location only. No change to what is drawn
or to the simulation. The default path (main-thread PixiJS) stays the shipped
default; OffscreenCanvas is used only when explicitly enabled and supported.

## Context (optional-capability principle, spec v0.4.0)

Per the spec, this must be optional and default-off, with the main-thread renderer
as the automatic fallback when OffscreenCanvas is unsupported or the toggle is off,
and it must not change what the user sees. Today `src/render/renderer.ts` owns the
PixiJS `Application`, camera, picking, and overlays on the main thread; `src/main.ts`
wires input and the snapshot loop; the simulation already runs in
`src/worker/simulationWorker.ts` and posts transferable snapshots. Picking
(click-to-adopt), the camera/director, minimap, and overlays all read renderer
state on the main thread, so the design must keep their behaviour identical via the
chosen split. `SharedArrayBuffer` is unavailable (no COOP/COEP on Pages).

## Required changes

1. Add a capability check and a user toggle (default off) for OffscreenCanvas
   rendering; when off or unsupported, behaviour is exactly as today.
2. When enabled: transfer the canvas via `transferControlToOffscreen()` to a render
   worker that hosts the PixiJS `Application` and the existing render modules;
   forward pointer/resize input from the main thread; route render-snapshots to the
   render worker; and surface back to the main thread whatever picking/camera state
   the inspector, director, minimap, and overlays need, so all of those keep working
   identically.
3. Keep the existing renderer and all features (LOD, FX, overlays, colour modes,
   ornament, camera/director, picking) working on both paths; share the render code
   between them rather than forking it.
4. Update `specification.md` (Architecture / Locked decisions: OffscreenCanvas as an
   optional capability with fallback) and bump the version; update
   `docs-dev/planning/current_state.md`.

## Do not implement

Do not implement: removal of the main-thread path; a change to the simulation core
or to drawn output; reliance on `SharedArrayBuffer`.

## Acceptance criteria

- With the toggle off (default), rendering is unchanged and on the main thread.
- With it on and supported, the same scene renders from the render worker, and
  click-to-adopt, camera/director, minimap, overlays, and colour modes all behave
  identically; on an unsupporting browser it falls back to the main thread
  automatically.
- `npm run build` and `npm test` pass (core/determinism tests unaffected).

## Checks

Run `npm run build` and `npm test`. Rendering is not unit-tested; verify the build,
the existing tests, and that the default path is untouched. If you cannot complete
this safely without regressing the default path, do not commit — report instead.

## Commit and push

If and only if the scope was followed, the default path is provably unchanged, and
checks pass, commit on `main` using this file's exact filename
(`059_offscreen_render.md`), then push. Do not commit partial or regressing work.

## Final report

End with the required final report specified in `AGENTS.md`.
