# Task: Deployment readiness

## Goal

Confirm the production build is clean, correctly based, and free of development material, ready for the GitHub Pages workflow.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Architecture_ — built output in `dist/`, Pages base path `/eek-a-volve/`, `docs-dev/` must never reach `dist/`. The deploy workflow (`.github/workflows/deploy-pages.yml`) already exists; this prompt makes the build deployment-ready and checks it, without triggering a deploy.

## Required changes

1. Build the site and run `scripts/check-public-build.sh dist`; fix anything it flags (stray `docs-dev/` references, source maps, etc.).
2. Confirm the Vite base path is `/eek-a-volve/` and that built asset URLs resolve under it; ensure production source maps are off.
3. Update `docs/usage.md` (and `README.md` if needed) with how to run, build, and that deployment is via the Pages workflow.

## Do not implement

Do not implement:
- triggering an actual deployment;
- new application features;
- enabling Pages in repository settings (a manual action to report).

## Acceptance criteria

The task is complete when:
- `npm run build` succeeds and `scripts/check-public-build.sh dist` passes;
- the base path is correct and no source maps or `docs-dev/` material are in `dist/`;
- the docs describe build and deploy.

## Checks

Run `npm run build`, `npm test`, and `bash scripts/check-public-build.sh dist`.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`024_deploy_readiness.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
