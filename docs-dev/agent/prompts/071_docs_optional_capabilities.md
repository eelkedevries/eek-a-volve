# Task: document the optional capabilities (user-facing)

## Goal

Document the three optional, default-off capabilities added under the
optional-capability principle so users know they exist and how they behave. Docs
only — no behaviour change.

## Scope

Update the user-facing docs under `docs/` (and the in-app setup help where thin) to
cover, for each capability: what it does, that it is default-off and safe, and any
limitations. No change to `src/` behaviour beyond help-text wording.

## Required changes

1. **Neural brains** (`neuralBrains`): movement driven by an evolvable fixed-topology
   network instead of the hand-coded policy; default-off; the hand-coded policy is
   the fallback. Note it is experimental.
2. **OffscreenCanvas rendering** (`offscreenRender`): renders in a worker via a
   transferred OffscreenCanvas to free the main thread; capability-gated with
   automatic fallback to the main-thread renderer; some effects/overlays are
   simplified in that mode; experimental and (note honestly) not yet visually
   verified.
3. **WASM core** (`wasmCore`): runs the per-tick hot loop in WebAssembly, bit-for-bit
   identical to the default core and ~1.7× faster; capability-gated with automatic
   TS fallback; note the feature combinations that currently fall back to TS (until
   069 lands).
4. Keep `docs-dev/` out of the published build (the existing guard covers this);
   ensure new `docs/` content is consistent with the spec.

## Acceptance criteria

- `docs/` describes all three capabilities accurately, matching the spec.
- `npm run build` passes and `scripts/check-public-build.sh` stays green.

## Checks

`npm run build`; `bash scripts/check-public-build.sh`. Commit on `main` using this
filename (`071_docs_optional_capabilities.md`) only if scope is followed.

## Final report

End with the required final report specified in `AGENTS.md`.
