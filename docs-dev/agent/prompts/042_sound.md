# Task: Sound

## Goal

Add small, synthesised sounds for the key moments — eat, birth, death, catastrophe — that bring the world to life without any audio assets.

## Scope

Implement only the work described in this prompt. Do not implement adjacent systems or future prompts.

## Context

The Bibites' noted weakness was having no audio; tiny blips are a big, cheap fun lever. Synthesize everything with the Web Audio API (no sampled files to ship). Drive sounds from the same real events as the visual cues (033/035), so picture and sound agree. Off by default and unobtrusive.

## Required changes

1. In `src/audio/sound.ts`, a tiny Web Audio kit (oscillator/noise blips) for eat, birth, death, and catastrophe; create the `AudioContext` lazily on first user gesture (autoplay policy), throttle/limit concurrent voices, and mix quietly.
2. Trigger sounds from snapshot state / events (eat from `EATING`, birth/death from header counts, catastrophe from the event stream), de-duplicated and rate-limited so a busy frame does not blast.
3. A mute/unmute toggle in the controls; **off by default**; remember the choice in `localStorage`.

## Do not implement

Do not implement:
- music, sampled audio, or spatial audio;
- new gameplay or visual systems.

## Acceptance criteria

The task is complete when:
- `npm run build` succeeds;
- sounds are synthesised, tied to real events, rate-limited, off by default, and toggleable;
- no audio asset files are added.

## Checks

Run `npm run build` and `npm test`. (Audio is not unit-tested; confirm aurally in a browser.)

## Commit and push

If and only if the scope was followed and checks pass, create one commit on `main` using this file's exact filename (`042_sound.md`) as the commit message, then push.

Do not commit or push partially completed work unless explicitly instructed.

## Final report

End with the required final report specified in `AGENTS.md`.
