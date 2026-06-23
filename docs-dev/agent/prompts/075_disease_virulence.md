# Task: evolving pathogen virulence (transmission↔harm trade-off)

## Goal

Let the pathogen's virulence evolve, coupling higher within-host replication to
**both** higher transmission and higher host harm, so that an **intermediate**
virulence maximises spread (an evolutionarily stable interior optimum rather than
ever-increasing or ever-decreasing virulence), while leaving the default run
byte-for-byte unchanged.

## Scope

Implement only: a `virulenceEvolves` toggle; a per-host carried `virulence` value
for the current infection; a transmission–virulence and host-harm–virulence
trade-off in the disease pass; a seeded, clamped Gaussian mutation of virulence on
transmission; and the accompanying tests and specification update. This builds
directly on prompt 074 (`disease_core`) and changes nothing when disease is off.
Do not implement multi-strain coexistence bookkeeping, host-resistance
coevolution beyond what 074 already provides, or any render/UI.

## Scope guard

This prompt assumes prompt 074 (`disease_core`) has landed: the `disease` toggle,
the `infectionState` / `infectionTimer` columns, the `src/core/disease.ts` pass,
its registration in `src/core/loop.ts`, and the WASM-fallback wiring all exist. If
074 has not landed, stop and flag it rather than re-implementing the disease core
here.

## Context

The disease pass (`src/core/disease.ts`, added by 074) already, when
`params.disease` is on: infects susceptible grid neighbours of each infected host
with probability `transmissionRate` via the seeded `Rng`; runs an
`infectionTimer` to recovery (immunity SIR / re-susceptibility SIS) or disease
death (via `dropCarrion` + `world.killAgent`); and optionally drains infected
hosts' energy. Virulence makes those rates *depend on a heritable pathogen trait*
carried by the infected host: a per-agent `virulence` value (added as another
pre-allocated column in `World` / `WorldLayout` exactly as the 074 infection
columns were, appended so existing offsets stay stable — it is a pathogen attribute
stored on the host, **not** a genome trait, so it is not in `TRAITS` and not in the
species-distance gate). It is meaningful only while `infectionState === 1`
(infected); set it on infection, ignore it otherwise.

The trade-off must yield an interior optimum: transmission probability *increases*
with the host's `virulence`, and host harm (disease mortality and/or energy drain,
shortening the infectious period) *also* increases with it, so total expected
onward transmission peaks at an intermediate value (the de Roode monarch result;
the synthesis flags the precise curvature as uncertain, so only "an intermediate
optimum exists" is asserted, not a specific curve). On each transmission event the
newly infected host inherits the transmitter's `virulence` perturbed by a seeded
Gaussian step (`Rng.gaussian()`), clamped to a valid `[min, max]` range (defined as
`core/` constants) — the same clamped-Gaussian pattern as trait mutation in
`src/core/mutation.ts` (`breed`), drawing only from the run's seeded generator.

The seeded generator is `Rng` (`src/core/rng.ts`); per the determinism rule, the
extra virulence-mutation draw must happen **only** when `virulenceEvolves` is on, so
with it off the disease pass advances the RNG stream exactly as 074 did (and with
`disease` off, nothing changes at all). The WASM-fallback wiring from 074 already
forces the TS hot loop whenever `disease` is on, so virulence inherits that
fallback; do not add WASM-kernel virulence logic. Parameters live in
`src/core/params.ts`. The binding canon is
`docs-dev/reference/primary_authoritative/specification.md` (current version 0.6.0,
assuming 074 has landed; otherwise sequence after it); this extends the Disease
domain rule and adds a parameter and a data field, so it must be accompanied by a
specification update and a version bump. Background and rationale (non-binding):
`docs-dev/planning/science_integration_plan.md` §4 (cross-cutting rules) and §5,
prompt 075.

## Required changes

1. Add to `SimulationParameters` in `src/core/params.ts`: `virulenceEvolves:
   boolean` and the trade-off shape constants (the transmission–virulence slope, the
   host-harm–virulence slope, and any optional saturation), documented. Set
   `virulenceEvolves` to `false` in `DEFAULT_PARAMETERS` (and choose constants inert
   while it is off); do not add them to `COMMUNITY_PRESET` or `SWARM_PRESET`.
2. Add a pre-allocated per-agent `virulence` column to `World` (`src/core/world.ts`)
   and `WorldLayout`/`computeWorldLayout` (`src/core/worldLayout.ts`), appended so
   existing offsets stay stable, in both the default and shared-buffer branches. It
   carries the strain virulence of the host's current infection (meaningful only
   while infected). It is **not** a genome trait — do not add it to `TRAITS` or the
   species-distance gate.
3. In `src/core/disease.ts`, when `params.disease && params.virulenceEvolves`: make
   the per-event transmission probability increase with the transmitting host's
   `virulence`, and make host harm (disease mortality and/or infectious-period
   energy drain) increase with it, shaped so total expected onward transmission has
   an **intermediate** maximum. On each successful transmission, set the new host's
   `virulence` to the transmitter's value perturbed by a clamped `Rng.gaussian()`
   step (the `breed`-style pattern). When `virulenceEvolves` is off, use exactly the
   074 rates and draw no extra RNG. Keep the pass allocation-free and deterministic.
4. Update `specification.md`: extend the Domain rule "Disease" (virulence is an
   evolving pathogen attribute carried on the infected host; higher virulence raises
   both transmission and host harm, giving an intermediate optimum; it mutates by a
   seeded clamped Gaussian step on transmission; off by default) and Data schemas
   (the per-host `virulence` field and the `virulenceEvolves` toggle + trade-off
   constants). Bump the version (≈0.6.0 → 0.6.1). Update
   `docs-dev/planning/current_state.md` to note the extension.

## Do not implement

Do not implement:
- multi-strain coexistence or per-strain population bookkeeping (virulence is a
  single scalar carried on the host);
- host-resistance coevolution beyond the optional `resistance` trait already added
  by 074;
- a specific virulence-curvature claim beyond "an intermediate optimum exists";
- any render cue, "sick" visual, setup-screen control, or event-feed text (prompt
  076);
- treating `virulence` as a genome trait or entering it into the species-distance
  gate;
- porting virulence into the WASM kernel;
- any default-on behaviour or any post-start control.

## Acceptance criteria

The task is complete when:
- with `disease = false`, or with `disease = true` and `virulenceEvolves = false`,
  a fixed seed and parameters reproduce a run exactly, identical to the post-074
  core (the determinism tests pass) and the population-stability test (prompt 012)
  stays green — virulence is inert by default and draws no extra RNG;
- with `disease = true` and `virulenceEvolves = true` and a fixed seed and
  parameters, the run is exactly reproducible (a determinism test in the
  virulence-evolving mode passes);
- a focused core test shows the interior optimum: from a spread of starting
  virulences, the population-mean virulence converges toward an **intermediate**
  value (neither the clamp minimum nor maximum), reproducibly per seed;
- a core test confirms the optimum responds to host density / grouping (it shifts
  rather than ratcheting to maximum);
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for determinism in the
virulence-evolving mode, for convergence to an intermediate virulence (not the
clamp extremes), and confirm the prompt-012 stability test still passes unchanged on
the default path.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`075_disease_virulence.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
