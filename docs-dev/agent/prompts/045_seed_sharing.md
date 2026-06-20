# Task: share a run by seed + parameters in the URL

## Goal

Let a run be shared and restored: encode the whole `SimulationParameters` object
(including the seed) into a URL-safe string, expose a "Copy share link" button on
the setup screen, and prefill the setup form from a `#w=…` hash when the page
loads — so a reproducible run can be handed to someone else by link.

## Scope

Implement only the pure codec, the setup-screen button, and the load-time hash
prefill. Do not implement genome export, cross-reload autosave, server storage,
short-link services, or any change to the worker or the simulation core's
behaviour.

## Context

A run is fully reproducible from `SimulationParameters` plus the seed and the
fixed timestep (specification: Data schemas; Locked decisions — "an export and
import of seed, parameters … is the intended low-cost route to persistence
later"). The parameter object is defined in `src/core/params.ts`
(`DEFAULT_PARAMETERS`). The setup screen
(`src/ui/setupScreen.ts`) builds a form over that object and calls `onStart`;
wiring lives in `src/main.ts`. `core/` is pure and headless (no DOM), so the
codec belongs there and is unit-testable under the core testing policy; the
button and hash-reading are DOM and belong in `ui` / `main.ts`. This prompt
implements an explicitly anticipated capability rather than a new domain rule, so
no new simulation law is added.

## Required changes

1. Add a pure codec to `core` (e.g. `src/core/share.ts`): `encodeParams(params):
   string` and `decodeParams(text): SimulationParameters`. Encoding must produce
   a compact, URL-safe string. Decoding must be defensive: validate types, clamp
   every numeric field to a sensible range, coerce the enumerated `viewMode` to a
   valid value, drop unknown keys, and fall back to `DEFAULT_PARAMETERS` for
   anything missing or malformed, so a corrupt string can never throw or inject
   absurd values. No DOM access.
2. Allow the setup screen to start from supplied parameters: extend
   `createSetupScreen` to accept optional initial parameters (defaulting to
   `DEFAULT_PARAMETERS`) and seed the form fields from them.
3. Add a "Copy share link" button to the setup screen that reads the current form
   values, encodes them, builds a `#w=<encoded>` URL from the current location,
   and copies it to the clipboard (with a brief, accessible confirmation). The
   button must not start the run.
4. In `src/main.ts`, on load, if `location.hash` begins with `#w=`, decode it and
   pass the resulting parameters to `createSetupScreen` so the form is prefilled;
   otherwise use the defaults as before. A malformed hash falls back to defaults
   silently.
5. Update `docs-dev/planning/current_state.md` to note the feature. Update the
   relevant Locked-decisions note in `specification.md` to record that seed +
   parameter sharing is now implemented, and bump the version. No new domain rule
   is added.

## Do not implement

Do not implement:
- genome / population export, or any persistence of live simulation state;
- automatic save/restore across reloads without an explicit link;
- a URL-shortening or server round-trip;
- any change to worker messages or to the simulation's behaviour.

## Acceptance criteria

The task is complete when:
- a round-trip unit test passes: `decodeParams(encodeParams(p))` deep-equals `p`
  for valid parameter sets, including non-default seeds and `viewMode`;
- a robustness unit test passes: decoding empty, truncated, and garbage strings
  returns a valid, clamped parameter set (defaults where needed) without
  throwing;
- opening the app with a `#w=…` link prefills the form to match the encoded run,
  and starting it reproduces that run (same seed and parameters);
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for the codec round-trip and
for decode robustness / clamping.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`045_seed_sharing.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
