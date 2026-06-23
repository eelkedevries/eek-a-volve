# Science integration plan — coupled mechanisms from the literature synthesis

Non-binding planning. This document **sequences and describes** the work needed
to fold the maintainer's literature synthesis into the simulator; it does not
author the prompts and it does not change any code. The binding design canon
remains [`../reference/primary_authoritative/specification.md`](../reference/primary_authoritative/specification.md);
where this plan and the specification disagree, the specification wins and the
gap is work still to be done. [`current_state.md`](current_state.md) tracks
where we actually are; [`roadmap.md`](roadmap.md) sequences earlier phases.

Source material: [`../reference/secondary_background/science_synthesis.md`](../reference/secondary_background/science_synthesis.md)
(non-binding background). Coupling numbers below (e.g. "#8–9") refer to that
document's §3 coupling matrix; evidence labels ([established] / [debated] /
[design-abstraction] / [speculative-extrapolation]) are carried over from it.

> **How to use this file.** Each block under §5 is a self-contained brief for one
> future prompt — goal, new parameters, core changes, spec impact, tests, and
> guardrails. When a stage is approved, turn each block into a numbered prompt
> file under `docs-dev/agent/prompts/` using `prompt_authoring_guide.md`
> (one block = one prompt = one commit), then run it per
> `prompt_execution_guide.md`. **No prompt files have been authored yet.**

---

## 1. Framing — the one idea that governs everything

The synthesis's central, well-supported finding is that **greater cognition,
technology and complexity are NOT universally favoured**: each is bounded by
energetic, demographic and ecological conditions, and each is **reversible**. The
systems form a *densely coupled feedback network dominated by negative,
stabilising, non-monotonic relationships*, not a stack of positively reinforcing
upgrades.

This lands almost exactly on the project's existing **optional-capability
principle** (spec v0.4.0): large features ship only as **default-off toggles**
that leave the default run **byte-for-byte unchanged**, preserve **determinism**,
and keep the **population-stability** guarantee on the default path. So this is
not a re-architecture — it is a set of new *couplings*, each an optional,
bounded, reversible toggle, slotted into the existing prompt workflow.

### The honesty benchmark (the acceptance theme for the whole programme)

Borrowed from the synthesis's overarching benchmark, every stage is judged
honest by this test:

> Across runs (seeds), **intelligence, disease-resistance, culture and any
> "civilisation" state must each sometimes fail to appear and sometimes
> regress.** If any of them rises monotonically and irreversibly on the default
> path, a modelling assumption — not a biological law — is driving it, and the
> coupling is wrong.

The four failure modes to design *against* (synthesis §6): treating intelligence
as a monotonic good; treating technology/civilisation as inevitable once
prerequisites exist; treating complexity as irreversible; and labelling
"emergent" any capacity that in fact fires at a modeller-designed threshold
(call those **[design-abstraction]**, never "emergent").

---

## 2. What already exists (do not rebuild)

The simulator already implements a large share of the synthesis's couplings.
These need no new work (a few could be *strengthened*, noted in §5):

- **Darwinian, energy-driven, implicit selection** — no global fitness term, no
  generation boundaries. (Framework table, all rows.)
- **Quantitative-genetics mutation** — clamped Gaussian step + genetic-distance
  gate (`genome.ts`, `mutation.ts`, `speciation.ts`).
- **Sexual selection** — costly `display` ornament + `matePreference`, honest via
  metabolic cost (#20 base; v0.3.6). *Not yet parasite-mediated.*
- **Predator–prey dynamics** — Lotka–Volterra-like lagged oscillation (#22;
  `predation.ts`).
- **Catastrophe → population shock** (#23; `events.ts`) and **near-extinction +
  optional immigration** (#23–24, #26; `bounds.ts`).
- **Seasonality → carrying capacity** (#25; `seasons`, v0.3.8).
- **Niche construction, partial** — biomes bias where food regenerates (#15–16;
  v0.3.5) and stigmergy lays/follows trails (#27; v0.3.2). *Not yet fed back as
  selection / ecological inheritance beyond foraging.*
- **Neuroevolution method** — an evolvable fixed-topology movement controller
  (#36-method; `brain.ts`, `neuralBrains`, v0.4.1). *Carries no metabolic cost —
  see 072.*

---

## 3. The gap — genuinely new couplings, by evidence strength

| Coupling (synthesis refs) | Status today | Target prompt(s) | Evidence |
|---|---|---|---|
| Metabolism↔cognition / expensive tissue | **Missing** — brains & `senseRadius` are energetically free | **072** | [established] |
| Predation→grouping (dilution, selfish-herd, vigilance) | **Missing** | **073** | [established] |
| Density→disease transmission (SIR/SIS) | **Missing** | **074** | [established] |
| Virulence↔transmission trade-off (intermediate optimum) | **Missing** | **075**, **076** (UI) | [established sign; debated curvature] |
| Metabolic exponent M^¾ tunable | Partial — cost scales with size, exponent fixed | **077** | [debated] |
| Parasite-mediated mate choice (Hamilton–Zuk) | Partial — sexual selection exists, not parasite-linked | **078** | [debated] |
| Social-brain pathway | Missing | **079** | [debated] |
| Transmission-fidelity→cumulative culture | **Missing** | **080**, **081** | [established (humans)] |
| Cultural loss below critical N (Tasmania) | Missing | **082** | [debated] |
| Gene–culture coevolution (lactase analogue) | Missing | **083** | [established] |
| Reversibility / evolutionary-rescue U-shape made measurable | Partial — mechanisms exist, not surfaced | **084** | [established] |
| Major transitions / civilisation as reversible threshold state | Missing — **most speculative** | **085**, **086** | [design-abstraction] / [speculative] |
| Artificial-agents↔civilisation (#36) | Missing — *no biological basis* | **not recommended** (see §7) | [speculative] |

---

## 4. Cross-cutting rules every prompt inherits

These are fixed constraints; each prompt brief in §5 assumes them rather than
restating them.

1. **Optional-capability principle.** Each new coupling is a **default-off**
   toggle or a coefficient that **defaults to the value reproducing today's
   behaviour** (usually `0`). With the toggle off / coefficient at default, the
   default run is **byte-for-byte identical** (no extra RNG draws, same code
   path).
2. **Determinism.** Only the seeded `mulberry32` stream drives stochastic
   decisions; no platform randomness on the sim path. Every prompt carries a
   determinism test (same seed + params ⇒ identical run).
3. **Population stability preserved** on the default path (the 012 long-run test
   stays green).
4. **Allocation-free per-tick path.** New fields are pre-allocated columns in the
   structure-of-arrays world (`world.ts` / `worldLayout.ts`); nothing on the hot
   loop allocates.
5. **Snapshot is append-only** (`snapshot.ts`). Any new visualised quantity
   (infection state, knowledge level, …) is **appended**, never inserted, so
   existing render/UI consumers keep working.
6. **New non-ecological traits sit *after* the six species-defining traits and are
   excluded from the genetic-distance gate** — exactly as `display` /
   `matePreference` were added in v0.3.6. This protects emergent speciation from
   being distorted by behavioural/cognitive/immune traits.
7. **WASM core fallback.** New per-tick couplings land in **TypeScript first**;
   when `wasmCore` is on, those passes fall back to TS (as the brain path already
   does). Porting a coupling into the WASM kernel is a separate, later
   optimisation prompt, out of scope here.
8. **Spec is canon.** Every prompt that adds a domain rule or a schema field
   updates `specification.md` (Domain rules and/or Data schemas) and **bumps the
   version**, and updates `current_state.md` when it adds a system. Suggested
   version arc in §6 (non-binding).
9. **Voice & repo hygiene.** British English in prose, comments and UI; standard
   identifier casing in code. No secrets; `docs-dev/` never reaches `dist/`.
10. **No god tools / observe-only after start** (handoff §6). Every coupling here
    is an *automatic* process configured **before** start; none adds a post-start
    control beyond time-multiplier and pause.

---

## 5. Staged programme — one block per future prompt

### Stage 1 — well-supported couplings (072–076)

The energy/behaviour/hazard/reproduction-expressible couplings the synthesis says
to "bake in". Highest evidence, cleanest fit.

---

#### 072 — `cognition_cost` · [established] · implements #1–3, #17 (expensive tissue/brain)

- **Goal.** Give cognition a metabolic price so intelligence is *bounded*, not
  free — the synthesis's single most-supported coupling and the heart of its
  thesis.
- **New params.** `cognitionCost` (default **0** ⇒ default run unchanged). When
  `> 0`, baseline metabolic drain gains a term proportional to the creature's
  cognitive investment.
- **Cognitive investment proxy.** `senseRadius` (the existing perceptual trait)
  and, when `neuralBrains` is on, the network's effective weight magnitude /
  count. Design choice to settle when authoring: cost on **both** behind one
  coefficient (recommended) vs brain-only.
- **Core changes.** `energy.ts` adds the cognition term to per-tick drain;
  `params.ts` adds the coefficient; constant lives in `core/`.
- **Spec.** Domain rules → Energy budget (drain may include a cognition term);
  Data schemas (new param). Bump (≈0.5.2).
- **Tests.** `cognitionCost = 0` byte-identical; with cost `> 0`, lineages with
  large `senseRadius`/brains pay measurably more and do **not** dominate without
  an ecological energy return; stability green.
- **Honesty check.** With cost on, mean `senseRadius` must not climb monotonically
  across seeds absent foraging payoff.
- **Do not implement.** Default-on behaviour; any coupling to disease/culture;
  changing the brain's function (cost only, not capability).

---

#### 073 — `grouping_safety` · [established] · implements #4–5, #19 (dilution / selfish-herd / vigilance)

- **Goal.** Make living near conspecifics reduce *per-capita* predation risk
  (dilution, many-eyes), traded off against a vigilance–foraging cost, so grouping
  is favoured only under predation and only up to a point (non-monotonic).
- **New params.** `groupingSafety` (default **0** ⇒ unchanged). Optional evolvable
  `sociality` trait (grouping tendency) — *if added*, it sits after the six
  ecological traits and is excluded from the species gate (rule §4.6).
- **Core changes.** `predation.ts`: a target's capture probability scales **down**
  with its local neighbour count (queried via the existing `grid.ts`), saturating
  so very large groups give diminishing returns; periphery-vs-centre asymmetry
  optional. `behaviour.ts`: under threat, bias movement toward conspecifics
  ("huddle"); optionally a small foraging/vigilance trade-off in groups.
- **Spec.** Domain rules → Predation (per-capita risk falls with local group
  size) and Behaviour (huddle-under-threat). Bump (≈0.5.3).
- **Tests.** Default-off byte-identical; with it on, individual predation
  mortality falls with local density and the predator–prey signature persists;
  stability green.
- **Honesty check.** Grouping benefit must saturate/turn costly — no runaway
  single super-herd; disease (074) should later make dense grouping a *liability*,
  closing the loop.
- **Do not implement.** Explicit flocking/boids forces; a second pheromone
  channel; cooperative defence/attack (separate, later).

---

#### 074 — `disease_core` · [established] · implements #6 (+ #10 Red Queen seed)

- **Goal.** A minimal compartmental (SIR/SIS) infection where transmission is
  **density/contact-dependent**, so dense populations and large groups pay a
  disease tax — the negative feedback that bounds grouping (073).
- **New params.** `disease` (toggle, default **off**); `transmissionRate`,
  `recoveryRate`, `diseaseMortality`, `immunityMode` (SIR vs SIS). Optional
  evolvable host `resistance` trait (after the ecological six, excluded from the
  gate; costly → Red Queen).
- **Core changes.** New per-agent columns: `infectionState` (S/I/R),
  `infectionTimer`. New pass (`core/disease.ts`): for each infected agent, infect
  susceptible **grid neighbours** with `transmissionRate` (seeded RNG draw, so the
  stream advances identically to other passes), then advance timers →
  recovery/immunity or disease death (routed through the normal death path so
  obituaries/records work). Density-dependent (βSI) by default; switch to
  frequency-dependent (βSI/N) noted as the runtime-cost escape hatch.
- **Spec.** New domain rule "Disease" (Data schemas: infection columns +
  pathogen/strain fields; Domain rules: transmission, recovery, mortality).
  Minor-version bump (≈0.6.0 — a substantial subsystem).
- **Tests.** Default-off byte-identical; determinism with disease on; prevalence
  **rises with density/group size** and an epidemic burns out (SIR) or persists
  (SIS); stability green (disease must not be able to force guaranteed
  extinction on the default-off path).
- **Honesty check.** Disease + grouping (073) together must produce an
  *intermediate* optimal group size, not monotone "bigger is safer".
- **Do not implement.** Virulence evolution (→075); parasite-mediated mate choice
  (→078); multi-pathogen; any render yet.

---

#### 075 — `disease_virulence` · [established sign; debated curvature] · implements #8–9 (virulence↔transmission trade-off)

- **Goal.** Let pathogen **virulence** evolve, coupling higher within-host
  replication to **both** higher transmission and higher host harm, so an
  **intermediate** virulence maximises pathogen spread (de Roode monarch).
- **New params.** `virulenceEvolves` (toggle); trade-off shape constants
  (transmission–virulence slope, host-harm slope, optional saturation).
- **Core changes.** Per-strain `virulence` carried on the infecting host (a column
  or a small strain field); transmission probability and host energy-drain /
  mortality both increase with it; on transmission, virulence mutates by a seeded
  Gaussian step (clamped). Builds on 074.
- **Spec.** Extend "Disease" (virulence as an evolving pathogen trait; the
  trade-off). Bump (≈0.6.1).
- **Tests.** Default path unchanged; with it on, mean virulence converges toward
  an **intermediate** value (not max, not min) and the result is reproducible per
  seed; stability green.
- **Honesty check.** Virulence must settle at an intermediate optimum, and shift
  with host density/grouping (Red Queen-ish), not ratchet to maximum.
- **Do not implement.** Curvature claims beyond "intermediate optimum exists"
  (synthesis flags curvature as uncertain); host-resistance coevolution can be a
  small follow-up if not folded into 074.

---

#### 076 — `disease_render_ui` · render/UI only · no core test required

- **Goal.** Make disease *legible* and configurable.
- **Changes.** Append an infection cue to the snapshot (rule §4.5); render a "sick"
  visual (e.g. a desaturated/spotted body or an emote); add disease controls to
  the setup screen and the legend; route plague deaths into the event feed /
  obituaries ("succumbed to the pox"); optionally enable a gentle disease in one
  preset. Narrator may *describe* prevalence only if it is in the snapshot
  aggregates (never invent stats).
- **Spec.** None required (render/UI), or a minor note if a snapshot field is
  added (append-only). No version bump unless schema touched.
- **Do not implement.** Any post-start disease control; new core rules here.

---

### Stage 2 — contested couplings, as bracketed default-off toggles (077–079)

The synthesis says to ship these "with competing positions available, defaulting
to the conservative setting", because the evidence is genuinely mixed. Treat any
of them as "core" only if a within-sim ablation shows the target behaviour
depends on it.

---

#### 077 — `metabolic_exponent` · [debated] · implements #21 (Kleiber M^¾)

- **Goal.** Make the size→metabolic-cost relationship scale as `size^exponent`
  with a tunable exponent, since the literature contests 2/3 vs 3/4 vs ~1.
- **New params.** `metabolicExponent` (default = **the value reproducing today's
  linear-in-size cost**, so default run unchanged; expose 0.67/0.75/1.0).
- **Core changes.** `energy.ts` raises the size term to the exponent.
- **Spec.** Domain rules → Energy budget (exponent is a modelling choice). Bump
  (≈0.6.3).
- **Tests.** Default value byte-identical; sublinear vs isometric exponents change
  the size distribution as expected; stability green.
- **Do not implement.** A WBE-derived network model; per-trait exponents.

---

#### 078 — `parasite_mediated_choice` · [debated] · implements #20 (Hamilton–Zuk)

- **Goal.** In sexual mode **with disease on**, let mate choice favour mates of
  low parasite load / undimmed ornament, so choosers gain resistance or avoid
  contagion — the contested parasite-mediated arm of sexual selection.
- **Depends on.** 047 sexual selection (shipped) **and** 074 disease.
- **New params.** `parasiteMatingBias` (default **0**; both signs available per
  the synthesis's "model competing positions").
- **Core changes.** In the mate-choice path, infected/high-virulence-bearing
  neighbours (or those whose `display` is dimmed by infection) are weighted down;
  optionally an infected creature's `display` is expressed lower while ill (honest
  signal).
- **Spec.** Sexual selection rule gains an optional parasite term. Bump (≈0.6.4).
- **Tests.** Default-off byte-identical; with it on + disease, choosier lineages
  show lower infection prevalence; determinism + stability green.
- **Do not implement.** Making it default-on; treating Hamilton–Zuk as settled.

---

#### 079 — `social_brain` · [debated] · implements #18 (social-brain hypothesis)

- **Goal.** Offer the contested pathway where **social/group complexity** favours
  larger cognitive investment — explicitly offset by 072's cognition cost, so it
  is a genuine trade-off, not free.
- **Depends on.** 072 (cost) and 073 (grouping).
- **New params.** `socialBrain` (toggle, default **off**, conservative strength).
- **Core changes.** Where a creature lives in larger/denser groups, a small
  foraging/efficiency return scales with `senseRadius`/brain (so cognition repays
  *only* socially) — paid for by 072's drain.
- **Spec.** Domain rules note (optional social return to cognition). Bump (≈0.6.5).
- **Tests.** Default-off byte-identical; with it on, brains enlarge **only** when
  grouping pays and cognition cost is affordable — and shrink when domestication-
  like easy conditions remove the payoff (synthesis: brains *decrease* in many
  lineages); stability green.
- **Honesty check.** This is the cleanest place to demonstrate non-monotonic,
  reversible intelligence across seeds.
- **Do not implement.** Dunbar's-number hard caps; treating the hypothesis as
  established.

---

### Stage 3 — culture & transitions as detection-at-threshold (080–083)

The synthesis is emphatic: open-ended emergence is unsolved and these transitions
are **typically scaffolded** in silico. So we *provide the scaffolding* and label
every threshold-triggered capacity **[design-abstraction]**, never "emergent".
A capacity earns the "emergent" label only if it reproducibly appears across
seeds from lower-level traits **with the detector disabled** — the upgrade
threshold to record if/when it is met.

---

#### 080 — `social_learning_core` · [design-abstraction] · implements #11–12 (transmission fidelity)

- **Goal.** A scaffolded second inheritance channel: creatures acquire a
  **`knowledge`** scalar by copying neighbours, gated by a **transmission
  fidelity** parameter; knowledge improves foraging (a real energy return) but
  never bypasses the energy budget.
- **New params.** `culture` (toggle, default **off**); `transmissionFidelity`
  (0..1); `knowledgeForagingGain`; optional `knowledgeDecay`. Optional evolvable
  social-learning propensity trait (after the ecological six; excluded from gate).
- **Core changes.** Per-agent `knowledge` column. New pass (`core/culture.ts`):
  with probability `transmissionFidelity`, adopt (a fraction of) the best
  neighbour's knowledge (seeded RNG); knowledge raises effective foraging
  efficiency (e.g. energy-per-food or effective sense). Knowledge is **not**
  inherited genetically and is **lost on death** → it must be re-acquired, which
  is what makes 082's loss-below-critical-N possible.
- **Spec.** New domain rule "Culture (social learning) — [design-abstraction]",
  Data schemas (knowledge column). Minor bump (≈0.7.0).
- **Tests.** Default-off byte-identical; determinism; with it on, mean knowledge
  tracks fidelity; stability green.
- **Honesty check.** Knowledge must be able to *fall* (it is not genetic and is
  lost on death); label it [design-abstraction] in code comments and spec.
- **Do not implement.** A genetic "culture genome"; language; technology effects
  on carrying capacity (→085); the ratchet/threshold (→081).

---

#### 081 — `cumulative_ratchet` · [design-abstraction] · implements #11, #30 (fidelity threshold)

- **Goal.** Make culture *cumulative* only above a fidelity threshold: with high
  fidelity, improvements persist and **ratchet** upward; below it, they decay —
  trait longevity rising ~exponentially with fidelity (Lewis & Laland).
- **Core changes.** Add a small innovation increment on copy and a longevity/decay
  that depends on fidelity, so accumulation is non-linear in `transmissionFidelity`.
- **Spec.** Extend the Culture rule (fidelity threshold gates accumulation). Bump
  (≈0.7.1).
- **Tests.** Below threshold knowledge does not accumulate; above it, it ratchets;
  reproducible per seed; stability green.
- **Honesty check.** Sub-threshold runs must show **no** cumulative gain — the
  ratchet is conditional, not automatic.
- **Do not implement.** Open-ended/unbounded knowledge; "emergent" labelling.

---

#### 082 — `cultural_loss` · [debated] · implements #30 (Tasmania; reversibility)

- **Goal.** Below a **critical effective population size**, expected knowledge
  *declines* (maladaptive loss), and recovers when N recovers — the U-shaped,
  reversible signature.
- **New params.** `criticalCultureN` (the effective-size threshold).
- **Core changes.** Tie knowledge maintenance to local/effective population:
  beneath `criticalCultureN`, copy opportunities are too sparse to offset
  loss-on-death, so mean knowledge falls; surface a "knowledge lost" event in the
  feed.
- **Spec.** Extend Culture rule (loss below critical N; reversible). Bump (≈0.7.2).
- **Tests.** A scripted bottleneck drives documented knowledge loss, then recovery
  on rebound (U-shape) — reproducible; stability green.
- **Honesty check.** This is a core reversibility demonstration; loss must be a
  *default* possible outcome, not an edge case.
- **Do not implement.** Permanent/irreversible loss; a hard "dark age" lock.

---

#### 083 — `gene_culture_coevolution` · [established] · implements #13–14 (lactase analogue)

- **Goal.** Let a cultural practice **change the selective environment** on an
  ecological trait, and the genetic capacity in turn favour the practice — the
  lactase-persistence feedback, the synthesis's strongest culture→biology case
  (selection coefficient s ≈ 0.09–0.19).
- **Depends on.** 080 (+ ideally 081).
- **New params.** `geneCultureCoupling` (default **0**).
- **Core changes.** When mean `knowledge` passes a level, a resource/biome becomes
  exploitable **only** by creatures above some ecological-trait value (e.g. a
  `diet` or `size` band), raising selection on that trait where the practice is
  present; the resulting genetic shift further entrenches the practice.
- **Spec.** Culture rule gains the gene–culture feedback. Bump (≈0.7.3).
- **Tests.** With coupling on, the targeted trait's mean shifts where culture is
  present and not where it is absent; reproducible; stability green.
- **Honesty check.** The feedback must be able to *reverse* if the practice is
  lost (082).
- **Do not implement.** Hard-coded "lactase gene"; civilisation effects (→085).

---

### Stage 4 — reversibility, the honesty benchmark, and the speculative tier (084–086)

---

#### 084 — `reversibility_benchmark` · [established] · implements #24, #32–34 (rescue / non-absorbing states)

- **Goal.** Make the **collapse-and-recovery U-shape** measurable and assert the
  programme-wide honesty benchmark in tests. Mostly surfacing and testing existing
  mechanisms (near-extinction, immigration, standing variation), not new rules.
- **Core changes.** Log/expose a rescue metric (trough depth, recovery time,
  whether standing variation enabled recovery); add a `core/` honesty-benchmark
  test that runs many seeds and asserts cognition / disease-resistance / knowledge
  each **sometimes fail to appear and sometimes regress** (none monotone by
  default).
- **Spec.** A short "Reversibility by construction" note (states are non-absorbing;
  if any becomes a de-facto attractor, add an explicit decay hazard). Bump
  (≈0.7.4).
- **Tests.** The multi-seed benchmark above; an evolutionary-rescue test showing a
  U-shaped trajectory under a survivable shock.
- **Do not implement.** New subsystems; tuning that hard-guarantees recovery
  (recovery must remain conditional on variation + size).

---

#### 085 — `transitions_threshold` · [design-abstraction] / [speculative] · implements #29, #31–33, #35

- **Status.** Most speculative tier the maintainer asked to include. Implement
  **only** as a clearly-labelled design abstraction, never "emergent", and
  **reversible by construction**.
- **Goal.** Detect a "complexity / proto-civilisation" state at a **designed
  threshold** (e.g. sustained high local population density *and* mean knowledge
  above a cutoff), which raises local resource throughput / carrying capacity
  (technology→K, #31) but increases environmental degradation that lowers local
  fertility (#32–34) — producing overshoot, decline and recovery.
- **New params.** `transitions` (toggle, default **off**); threshold + degradation
  constants.
- **Core changes.** A detector over the existing population/biome/knowledge fields
  flips a per-region state; the state modifies food regeneration up (tech) then
  down (degradation); an explicit decay/degradation hazard keeps the state
  **non-absorbing** (collapse and re-emergence both possible).
- **Spec.** New "Transitions / complexity ([design-abstraction])" rule, stressing
  it is detection-at-threshold and reversible. Minor bump (≈0.8.0).
- **Tests.** Default-off byte-identical; with it on, the complexity state both
  arises and **collapses** across seeds (Butzer & Endfield: 7/12 transformed,
  5/12 recovered — neither uniform nor terminal); reproducible; stability green.
- **Honesty check.** If the state never exits across long runs, it has become an
  attractor → add/raise the degradation hazard until exits are observed.
- **Do not implement.** Any claim of emergence; a tech tree; named institutions;
  irreversible "win" states; the agent↔civilisation coupling (#36, see §7).

---

#### 086 — `emergence_audit` · documentation + ablation · (optional, may fold into 085)

- **Goal.** Enforce the synthesis's label discipline. Document, for every Stage 3–4
  capacity, whether it is **[design-abstraction]** (fires at a detector) or has
  earned **"emergent"** (reproducible across seeds with the detector disabled).
  Provide the ablation that tests the latter.
- **Changes.** A `docs-dev/reference/` note mapping each capacity to its label +
  the ablation result; an optional `core/` ablation harness. No new sim rules.
- **Spec.** None (documentation), or a one-line pointer.
- **Do not implement.** Relabelling anything "emergent" without the
  detector-disabled, cross-seed evidence.

---

## 6. Dependencies and suggested order

```
072 cognition_cost ─┬─────────────► 079 social_brain
073 grouping_safety ┘        ▲
        │                    │
        └──► 074 disease_core ─► 075 virulence ─► 076 disease UI
                     │              │
                     └──────────────┴──► 078 parasite_mediated_choice (needs sexual selection, shipped)
077 metabolic_exponent  (independent)
080 social_learning ─► 081 ratchet ─► 082 cultural_loss ─► 083 gene_culture
                                    └──────────────► 085 transitions ─► 086 audit
084 reversibility_benchmark  (after the capabilities it audits exist)
```

Recommended run order: **072 → 073 → 074 → 075 → 076** (Stage 1), then
**077 → 078 → 079** (Stage 2), then **080 → 081 → 082 → 083** (Stage 3), then
**084**, and only if still wanted **085 → 086**. Suggested spec-version arc
(non-binding, decided at run time): 0.5.2, 0.5.3, 0.6.0, 0.6.1, (076 render/UI),
0.6.3, 0.6.4, 0.6.5, 0.7.0, 0.7.1, 0.7.2, 0.7.3, 0.7.4, 0.8.0, 0.8.1.

---

## 7. Explicitly out of scope / not recommended

- **#36 artificial-agents ↔ civilisation/ecosystems.** The synthesis itself rates
  this "[speculative-extrapolation]" with "essentially no biological evidential
  base" (confidence *Very Low*). Recommend **not** implementing; if ever wanted,
  only as a clearly-labelled toy, never on the default path.
- **"Emergent" labels for any threshold-triggered capacity** — forbidden by the
  label discipline (call them [design-abstraction]).
- **Anything that breaks observe-only-after-start** — no manual plague/famine
  trigger, no genome editor, no painting food, no dragging creatures (handoff §6).
  All couplings here are automatic and pre-start-configured.
- **Monotone, irreversible "upgrades."** If intelligence, disease-resistance,
  culture or civilisation rises and never falls by default, the coupling is wrong
  (the honesty benchmark, §1).
- **WASM kernel ports of the new couplings** — deliberately deferred; new code is
  TS-first with WASM fallback (rule §4.7).

---

## 8. Turning this into prompts

When a stage is approved: for each §5 block, create one numbered prompt file
(`072_cognition_cost.md`, …) following `prompt_authoring_guide.md` — Goal, Scope,
Context, Required changes, Do not implement, Acceptance criteria, Checks, Commit
and push, Final report — drafting it for review **before** running, then running
one commit per prompt per `prompt_execution_guide.md`. Bump the specification and
update `current_state.md` as each domain-rule prompt lands. Numbering continues
from the last run prompt (071); these briefs reserve **072–086**.
