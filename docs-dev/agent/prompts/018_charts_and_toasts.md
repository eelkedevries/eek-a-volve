# Task: Live chart and toast messages

## Goal

Add a live population chart and transient toast messages, both fed from the snapshot header.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

Spec: _Architecture (`ui/`)_ — live charts and toast messages. Draw from the snapshot header stats (population, species count, births/deaths, trait means, tick). Keep it dependency-light (a small canvas chart, not a charting library).

## Required changes

1. In `src/ui/chart.ts`, a small rolling line chart of population over time, updated from each snapshot header on a `<canvas>`.
2. In `src/ui/toasts.ts`, a toast queue that shows brief messages (e.g. near-extinction warnings) and fades them.
3. Wire both into `main.ts`: update the chart per snapshot, and raise a toast when the snapshot header indicates a notable event (such as the near-extinction flag).

## Do not implement

Do not implement:
- the narrator or humour text (later prompts);
- trait-distribution charts beyond population (keep to one chart);
- a third-party charting dependency.

## Acceptance criteria

The task is complete when:
- `npm run build` succeeds;
- the population chart and toasts update from snapshots;
- no charting library was added.

## Checks

Run `npm run build` and `npm test`. (UI is not unit-tested; visual confirmation is manual.)

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`018_charts_and_toasts.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
