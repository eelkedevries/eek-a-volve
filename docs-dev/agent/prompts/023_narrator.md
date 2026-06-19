# Task: Optional AI narrator

## Goal

Add the optional narrator: summarise snapshots, call OpenRouter with a user-supplied key, and fall back to templated lines.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Naming and voice_ and _Locked decisions_ — a wildlife-presenter voice; OpenRouter with a user-supplied key stored in the browser (never embedded or committed); calls rate-limited and non-blocking; degrades to templated lines when no key is present or a call fails; a default low-cost model, user-configurable; the narrator must not invent statistics absent from the supplied snapshot.

## Required changes

1. In `src/narrator/summary.ts`, build a compact textual summary from snapshot stats and the latest event/milestone (pure, testable; no invented figures).
2. In `src/narrator/templates.ts`, templated fallback lines in the presenter voice derived only from the summary.
3. In `src/narrator/openrouter.ts`, a client that reads the key/model from browser storage, calls OpenRouter for a line from the summary, is rate-limited and non-blocking, and falls back to a template on missing key or failure. No key is embedded or committed.
4. A minimal UI affordance to enter/store the key and model, and to show the latest narrator line; wire into `main.ts`.

## Do not implement

Do not implement:
- a server-side proxy;
- streaming responses or conversation history;
- committing any key or `.env` file.

## Acceptance criteria

The task is complete when:
- tests pass for the summariser and templated fallback (no network in tests);
- the OpenRouter client degrades gracefully with no key;
- `npm run build` succeeds and no secret is committed.

## Checks

Run `npm run build` and `npm test`. Confirm no key or `.env*` is added (`scripts/check-public-build.sh dist` for the build).

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`023_narrator.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
