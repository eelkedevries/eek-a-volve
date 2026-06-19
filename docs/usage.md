# Usage

eek-a-volve runs entirely in a desktop browser. There is no install for end
users — open the deployed site. To run it from source, see below.

## Using the simulator

1. On the **setup screen**, configure the world — population, world size, seed,
   food, metabolism, mutation, predation, catastrophes, and so on — then press
   **Start**. These are fixed for the run; a given seed and parameter set
   reproduce a run exactly.
2. While it runs, the only controls are the **speed multiplier**, **pause/resume**,
   and **reset** (which returns to the setup screen). Leave it running for a long
   time to watch adaptation unfold.
3. A live **population chart**, **toast messages** (e.g. near-extinction
   warnings), and an optional **AI narrator** sit over the world.

### Optional AI narrator

Open the narrator panel and paste an [OpenRouter](https://openrouter.ai) API key
to have events narrated by a wildlife-presenter voice. The key and model are
stored only in your browser; nothing is sent anywhere except OpenRouter. Without
a key, the narrator falls back to built-in templated lines.

## Run from source

```bash
npm ci          # reproducible install from the committed lockfile
npm run dev     # local development server; open the printed URL
npm run build   # type-check and bundle to dist/ (the verify command)
npm run preview # serve the production build locally
npm test        # run the core/ test suite (Vitest)
```

## How it deploys

The site is a static bundle in `dist/`, served from GitHub Pages at the base path
`/eek-a-volve/`. Deployment runs via the `.github/workflows/deploy-pages.yml`
workflow (which builds and runs `scripts/check-public-build.sh` before
publishing); it requires Pages to be enabled with **Source: GitHub Actions** in
the repository settings. Development material under `docs-dev/` is kept out of the
deployed build.
