# Task: disease render and UI (make plague legible)

## Goal

Make disease visible and configurable: append an infection cue to the render
snapshot (append-only), draw a "sick" creature, add disease controls and a legend
entry to the setup screen and legend, and route plague deaths into the event feed
and obituaries — with no new core simulation rules and no change to the default
(disease-off) run.

## Scope

Implement only the render/UI surfacing of the disease subsystem from prompts
074–075: the appended snapshot field, the "sick" visual, the setup-screen controls,
the legend entry, and the plague-death event text. Do not add or change any core
simulation rule, parameter semantics, or trait; do not add a post-start disease
control. No new core test is required.

## Scope guard

This prompt assumes prompts 074 (`disease_core`) and ideally 075
(`disease_virulence`) have landed: the `disease` toggle and its rate parameters, the
`infectionState` / `infectionTimer` columns, and the disease pass all exist. If 074
has not landed, stop and flag it. This prompt is render/UI only — read the relevant
core fields, never change a core rule.

## Context

The render snapshot is built in `src/core/snapshot.ts` and is **append-only**: the
per-agent record packs fields at fixed offsets (`A_X` … `A_DISPLAY`) with
`AGENT_STRIDE` the record width; existing offsets must stay stable, so a new
infection cue is **appended** as the next `A_*` index (e.g. `A_INFECTED`) with
`AGENT_STRIDE` incremented — exactly as `A_DIET` / `A_SENSE` / `A_DISPLAY` were
appended. `serialiseSnapshot` writes each agent's fields; add a write for the
infection cue derived from `world.infectionState[s]` (and, if useful, a normalised
`virulence`). The renderer reads these by the same `HEADER_LENGTH + i * AGENT_STRIDE
+ A_*` indexing (`src/render/renderer.ts`, e.g. `drawDetailed`, which already reads
`A_DIET` / `A_SENSE` / `A_DISPLAY` and passes them into `CreatureSprite.update`).

The creature is drawn by `src/render/creatureSprite.ts` (`CreatureSprite`), which
re-shapes a prebuilt sprite each frame from snapshot fields — `update(...)` already
takes `diet`, `sense`, `energy`, `display`, etc., and applies a starvation
desaturation (`blend` toward `STARVE_GREY`) and a hunt/damage flash. The "sick"
cue follows that pattern: pass the infection cue into `update` and apply a static,
reduced-motion-safe tell (e.g. a desaturated/spotted body or a sickly tint),
distinct from the starvation fade. Add the call-site argument in
`renderer.ts:drawDetailed` (and the swarm path may stay as-is or apply a tint).

The setup screen is `src/ui/setupScreen.ts`: it builds the parameter UI from the
typed `SimulationParameters` via `CORE`, `CHIPS`, `ADV_TABS`, and `ROWDEF` (sliders
and toggles), all bound to the real params object. Add the disease controls here —
a behaviour chip and/or an advanced "Disease" tab with the `disease` toggle and the
074/075 rate parameters (`transmissionRate`, `recoveryRate`, `diseaseMortality`,
`immunityMode`, and `virulenceEvolves` if 075 has landed) as toggle/slider rows;
icons come from `src/ui/icons.ts` (add a disease glyph if needed). The legend is
`src/ui/legend.ts` (`createLegend`): add a row under "What just happened" or a new
marker explaining the sick visual, in the existing `row(...)` / `glyph(...)` /
`swatch(...)` style.

Plague deaths reach the feed through the event pipeline, not by inventing UI state:
the core `EventLog` (`src/core/eventlog.ts`) records notable moments
(`catastrophe`, `massDeath`, `obituary`, …); `Simulation.step` (`src/core/loop.ts`)
already calls `eventLog.massDeath(deaths)` on a non-catastrophe death spike and
`eventLog.reconcile(world)` to emit obituaries for watched creatures. The UI maps
those `SimEvent`s to story lines in `src/ui/storyLog.ts` (`describe`), which already
handles `massDeath` and `obituary`. Route plague mortality so it reads as disease:
either give the disease pass a way to flag a plague death spike that the loop logs
(e.g. a dedicated event kind or reusing the existing spike path with a disease
flavour) and add/branch the `describe` text ("succumbed to the pox"), keeping the
existing `EventKind` colour taxonomy — without changing the simulation's outcomes.
Prefer reusing existing event plumbing over adding a parallel channel; if a new
`SimEventKind` is genuinely needed, append it and map it in `storyLog.ts`.

The narrator may *describe* prevalence only if it is present in the snapshot
aggregates — it must never invent statistics (specification: Naming and voice). The
binding canon is `docs-dev/reference/primary_authoritative/specification.md`. This
prompt is render/UI only and adds no domain rule; if it appends a snapshot field,
add a one-line Data-schemas note that the render snapshot now also carries a
per-agent infection cue (append-only) and bump the patch version accordingly,
otherwise no spec change and no version bump. Update
`docs-dev/planning/current_state.md` only if it adds a genuinely useful orientation
point. Background (non-binding):
`docs-dev/planning/science_integration_plan.md` §5, prompt 076.

## Required changes

1. Append an infection cue to the render snapshot (`src/core/snapshot.ts`): a new
   `A_*` per-agent offset (e.g. `A_INFECTED`) after the existing fields, with
   `AGENT_STRIDE` incremented and `serialiseSnapshot` writing it from
   `world.infectionState[s]` (append-only; do not reorder existing offsets). Keep
   the snapshot-offset invariants intact.
2. Draw a "sick" creature in `src/render/creatureSprite.ts`: extend `update(...)`
   to take the infection cue and apply a static, reduced-motion-safe visual
   (desaturated/spotted body or sickly tint), distinct from the starvation fade and
   the hunt flash; wire the new argument from `src/render/renderer.ts`
   (`drawDetailed`) reading the appended snapshot field.
3. Add disease controls to the setup screen (`src/ui/setupScreen.ts`): a chip and/or
   an advanced "Disease" tab exposing the `disease` toggle and the 074/075 rate
   parameters as toggle/slider rows bound to the real params, with an icon from
   `src/ui/icons.ts` (add one if needed). Add a legend entry for the sick visual in
   `src/ui/legend.ts`.
4. Route plague deaths into the event feed / obituaries: surface disease mortality
   through the existing `EventLog` / `storyLog` pipeline so a plague die-off and the
   passing of watched infected creatures read as disease ("succumbed to the pox"),
   reusing the existing event plumbing and `EventKind` colour taxonomy; add or
   branch the `describe` text in `src/ui/storyLog.ts`. Do not change any simulation
   outcome.
5. If a snapshot field was appended, add a one-line Data-schemas note to
   `specification.md` (the render snapshot also carries a per-agent infection cue,
   append-only) and bump the patch version; otherwise make no spec change. Update
   `docs-dev/planning/current_state.md` only if warranted.

## Do not implement

Do not implement:
- any new core simulation rule, parameter semantics, trait, or change to disease
  outcomes (this prompt is render/UI only);
- any post-start disease control (no manual plague trigger; configuration is
  pre-start only — specification: observe-only after start);
- inserting or reordering existing snapshot offsets (the cue is appended only);
- narrator lines that state prevalence figures not present in the snapshot
  aggregates;
- a new core test (none is required for render/UI).

## Acceptance criteria

The task is complete when:
- the snapshot gains an appended per-agent infection cue with existing offsets
  unchanged, and the snapshot-offset invariant test still holds;
- with disease enabled, infected creatures show a distinct, reduced-motion-safe
  "sick" visual, separate from the starvation and flash tells;
- the setup screen exposes the `disease` toggle and its rate parameters, bound to
  the real parameters, and the legend explains the sick visual;
- a plague die-off and the deaths of watched infected creatures appear in the event
  feed / obituaries with disease-flavoured wording, via the existing event
  pipeline;
- the default (disease-off) run is visually and behaviourally unchanged;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. No new core test is required; ensure the
existing snapshot-offset invariant test passes with the appended cue, and verify
the disease-off default run is unchanged.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`076_disease_render_ui.md`) as the commit
message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
