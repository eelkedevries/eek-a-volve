# Task: gene–culture coevolution (lactase-persistence analogue)

## Goal

Let a cultural practice change the selective environment on an ecological trait, and
the resulting genetic capacity in turn favour the practice — the lactase-persistence
feedback — so that where mean knowledge is high a resource becomes exploitable only by
creatures above an ecological-trait value, raising selection on that trait, which
further entrenches the practice; leaving the default run byte-for-byte unchanged.

## Goal label

This coupling is **[established]** (gene–culture coevolution of lactase persistence
has a strong empirical basis, with selection coefficient s ≈ 0.09–0.19), so the
mechanism is grounded — but the feedback must be able to **reverse** if the practice
is lost (via 082), so it is not a one-way ratchet. The knowledge channel it builds on
remains a [design-abstraction].

## Scope

Implement only: a `geneCultureCoupling` coefficient (default 0) and the two-way
feedback whereby high mean knowledge makes a chosen resource/biome exploitable only by
creatures above an ecological-trait band (raising selection on that trait where the
practice is present), and the trait's spread reinforces the practice; plus the
accompanying tests and specification update. This builds directly on prompt 080
(ideally with 081). Do not implement a hard-coded "lactase gene", civilisation /
technology effects (085), or any render/UI.

## Scope guard

This prompt assumes prompt 080 (`social_learning_core`) has landed: the `culture`
toggle, `transmissionFidelity`, the `knowledge` column, the `src/core/culture.ts`
pass, and the snapshot mean-knowledge aggregate exist. It composes best with prompt
081 (the ratchet) so the practice can persist, but 081 is not strictly required. If
080 has not landed, stop and flag it.

## Context

The lactase analogue is a feedback between an existing **ecological** genome trait and
the 080 `knowledge` channel. Pick one of the six species-defining traits as the target
— `diet` (0 herbivore … 1 carnivore) or `size` (0.5..2.0) (`src/core/genome.ts`,
`DIET` / `SIZE`, `TRAIT_RANGES`). Foraging energy enters in `src/core/behaviour.ts`
via `feed(world, s, world.foodEnergy[food])` when a creature eats; food types are
plant/carrion (`src/core/food.ts`, `PLANT`/`CARRION`), and where food regenerates can
already be biased by biomes (`fertilityAt`, `src/core/biome.ts`). The cultural
practice (proxied by high local/mean `knowledge`, the "dairying" know-how) unlocks a
resource that is otherwise unusable: when mean (or local) knowledge is above a level
**and** `geneCultureCoupling > 0`, a designated resource/biome yields its energy
*only* to creatures whose target ecological trait is above a band (the "persistence"
genotype) — for everyone else that resource gives little or nothing. This raises the
realised selection on the trait exactly where the practice is present (more energy →
more reproduction for above-band creatures), and the resulting genetic shift makes the
practice more rewarding to hold (more creatures can exploit it), closing the loop.

Crucially the feedback must be **reversible**: if the practice is lost — knowledge
falls below the level (e.g. via 082's loss below critical N) — the resource stops being
specially exploitable and the selection differential on the trait relaxes, so the trait
can drift back. Design against a one-way ratchet; this is the honesty requirement for
this prompt.

Per the determinism rule, the coupling must add **no** new RNG draw (it re-weights
deterministic foraging yield by trait and knowledge), and must be completely inert when
`geneCultureCoupling === 0` or `culture` is off, so the RNG stream and the default run
are unchanged. The 080 WASM-fallback wiring already forces the TS hot loop whenever
`culture` is on, so this inherits that fallback; do not add it to the WASM kernel
(WASM-fallback rule, plan §4.7).

Parameters live in `src/core/params.ts`. The binding canon is
`docs-dev/reference/primary_authoritative/specification.md`; this extends the Culture
domain rule and adds a parameter, so it must be accompanied by a specification update
and a version bump. Background and rationale (non-binding):
`docs-dev/planning/science_integration_plan.md` §4 (cross-cutting rules) and §5,
prompt 083.

## Required changes

1. Add `geneCultureCoupling: number` to `SimulationParameters` in `src/core/params.ts`,
   documented as how strongly a high-knowledge cultural practice unlocks a resource for
   creatures above a target ecological-trait band, coupling culture to selection on that
   trait (0 = off, the byte-for-byte default). Set it to `0` in `DEFAULT_PARAMETERS`;
   do not add it to `COMMUNITY_PRESET` or `SWARM_PRESET`.
2. In the foraging path (`src/core/behaviour.ts`, where `feed(...)` is called, working
   with `src/core/culture.ts`/`src/core/food.ts` as needed), when
   `params.culture && params.geneCultureCoupling > 0` and knowledge (mean or local) is
   above a level, make a designated resource/biome yield its energy *only* to creatures
   whose target ecological trait (`diet` or `size`) is above a band, and little/nothing
   to others — so realised selection on that trait rises where the practice is present.
   Make the unlock relax when knowledge falls below the level, so the feedback is
   reversible. Add **no** RNG draw; keep the path allocation-free; change nothing when
   `geneCultureCoupling === 0` or `culture` is off.
3. Update `specification.md`: extend the Domain rule "Culture (social learning) —
   [design-abstraction]" with the gene–culture feedback ([established] for the lactase
   case: a high-knowledge practice unlocks a resource for an above-band ecological
   genotype, raising selection on that trait, which entrenches the practice; reversible
   if the practice is lost; off by default) and Data schemas (the `geneCultureCoupling`
   parameter). Bump the version (≈0.7.3, after 080–082 — choose the next free version at
   run time). Update `docs-dev/planning/current_state.md` to note the extension.

## Do not implement

Do not implement:
- a hard-coded, named "lactase gene" or a new genome trait (re-use an existing
  ecological trait, `diet` or `size`);
- civilisation / technology effects on carrying capacity (prompt 085);
- an irreversible one-way feedback (the unlock must relax when the practice is lost);
- any "emergent" labelling;
- a render cue or setup-screen control;
- porting the coupling into the WASM kernel;
- any default-on behaviour or any post-start control.

## Acceptance criteria

The task is complete when:
- with `geneCultureCoupling = 0` (or `culture = false`), a fixed seed and parameters
  reproduce a run exactly, identical to the post-080 core (the determinism test passes),
  the foraging path draws no extra RNG, and the population-stability test (prompt 012)
  stays green — the coupling is inert by default;
- with `culture = true` and `geneCultureCoupling > 0` and a fixed seed and parameters,
  the run is exactly reproducible (a determinism test passes);
- a focused core test shows the feedback: where culture (knowledge) is present and the
  coupling is on, the targeted ecological trait's population mean shifts toward the
  unlock band, and not where culture is absent (or the coupling is 0) — reproducible per
  seed;
- a focused core test shows reversibility: if the practice is lost (knowledge driven
  below the level), the trait's mean relaxes back rather than staying locked;
- the per-tick path performs no new allocation;
- `npm run build` and `npm test` pass.

## Checks

Run `npm run build` and `npm test`. Add core tests for determinism with the coupling,
for the trait shift where culture is present versus absent, for reversibility when the
practice is lost, and confirm the prompt-012 stability test still passes unchanged on
the default path.

## Commit and push

If and only if the scope was followed and checks pass, create one commit on
`main` using this file's exact filename (`083_gene_culture_coevolution.md`) as the
commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
