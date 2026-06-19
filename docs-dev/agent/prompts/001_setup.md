# Task: Initial Vite + TypeScript scaffold

## Goal

Stand up the minimal runnable Vite + TypeScript scaffold and nothing else.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

This is the first setup task for a new project initialised from the `eek-a-dev`
template. The stack is node-vite + TypeScript (see `AGENTS.md` Project
conventions), and the project is a static, client-side site deployed to GitHub
Pages at base path `/eek-a-volve/`. The binding design is
`docs-dev/reference/primary_authoritative/specification.md`; do not build any of
its simulation features here — that is later prompt work.

Note: the bootstrap step may already have created this scaffold and committed it
as `Initialise eek-a-volve from eek-a-dev`. If so, verify the items below hold
and stop without a new commit; otherwise create the scaffold as described.

## Required changes

1. Initialise a default Vite vanilla-TypeScript app (`npm create vite@latest -- --template vanilla-ts`) with default configuration only.
2. Add a `vite.config.ts` that sets `base: '/eek-a-volve/'` so assets resolve under the project Pages path.
3. Set the project name in `package.json` to `eek-a-volve` and the page `<title>` to `eek-a-volve`.
4. Commit the lockfile (`package-lock.json`) so `npm ci` builds reproducibly; ensure `README.md` records how to run the dev server and build.

## Do not implement

Do not implement:
- any simulation features (worker, core rules, genome, rendering, narrator, UI) from the specification;
- GitHub Pages enablement, CI changes, or a deployment run;
- tests, state management, or architecture beyond the default scaffold.

## Acceptance criteria

The task is complete when:
- dependencies install cleanly with `npm ci` (lockfile committed);
- `npm run build` (the verify command) succeeds and writes `dist/`;
- `npm run dev` starts the development server without errors;
- no feature code beyond the default scaffold has been added.

## Checks

Run `npm ci`, `npm run build`, and `bash scripts/check-public-build.sh dist`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`001_setup.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
