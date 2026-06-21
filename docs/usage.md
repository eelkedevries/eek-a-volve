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

## Optional capabilities

All of these are configured on the setup screen, are **off by default**, and never
change a default run — the original behaviour is always retained as the fallback.

- **Larger worlds (`maxPopulation`).** The population ceiling (and creature-pool
  size) defaults to 2000. Raise it for bigger ecosystems — pair it with more food.
  Large worlds are much cheaper with the WASM core (below); very high values use
  more memory.
- **Neural brains (`neuralBrains`, experimental).** Movement is driven by a small,
  evolvable neural network that is part of each creature's genome, instead of the
  hand-coded rules. The hand-coded policy remains the default and the fallback.
- **OffscreenCanvas rendering (`offscreenRender`, experimental).** Rendering runs in
  a background worker via a transferred `OffscreenCanvas`, freeing the main thread.
  It is capability-checked and falls back automatically to the standard main-thread
  renderer if unsupported; some effects and overlays are simplified in this mode.
  *This path is experimental — the default renderer is unaffected.*
- **WebAssembly core (`wasmCore`, experimental).** The per-tick simulation runs in a
  compiled WebAssembly core that is **bit-for-bit identical** to the standard core
  (same seed → same run) and roughly **1.7× faster**, which is what makes large
  worlds practical. It is capability-checked and falls back automatically to the
  TypeScript core. For full speed it currently needs neural brains and pheromones
  off; with those on, behaviour falls back to the (still correct) TypeScript path.
  The WASM kernel is compiled from AssemblyScript by `npm run asbuild` (part of
  `npm run build`).

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
