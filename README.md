# eek-a-volve

A not-too-serious, agent-based evolution simulator that runs in the browser.
Creatures with evolvable traits undergo continuous, energy-driven natural
selection — with procedural names, rare freak mutations, optional catastrophes,
and an optional AI narrator. It runs entirely client-side as a static site; you
set the parameters before starting, then watch an ecosystem find its own balance.

The binding design lives in
[`docs-dev/reference/primary_authoritative/specification.md`](docs-dev/reference/primary_authoritative/specification.md),
with a plain-language tour in
[`docs-dev/reference/secondary_background/overview.md`](docs-dev/reference/secondary_background/overview.md).

## Develop

```bash
npm ci        # reproducible install from the committed lockfile
npm run dev   # start the local development server
```

Open the printed local URL in a desktop browser (current Chrome or Firefox on
Windows/Linux/macOS, or Safari on macOS).

## How it builds and deploys

- **Verify command:** `npm run build` — the gate that must pass before each
  commit (it type-checks with `tsc` and bundles with Vite).
- **Build output:** the static site is written to `dist/`.
- **Reproducible installs:** CI and deploys use `npm ci` against the committed
  `package-lock.json`, so builds are reproducible rather than dependent on a
  developer's machine.
- **Deploy target:** GitHub Pages, served from this repository at base path
  `/eek-a-volve/` (configured in `vite.config.ts`). Deployment runs via
  `.github/workflows/deploy-pages.yml`; `scripts/check-public-build.sh` guards
  the build so development material in `docs-dev/` never reaches the live site.

## Working in this repository

This project is developed prompt-by-prompt with a coding agent. The map of how
that works is in [`docs-dev/agent/how_to_use.md`](docs-dev/agent/how_to_use.md);
`AGENTS.md` holds the agent rules and project conventions. Everything under
`docs-dev/` is development material and is kept out of the deployed build.
