# Overview

A plain-language orientation for eek-a-volve. This is non-binding background; the
binding design canon is `../primary_authoritative/specification.md`, which wins
on any conflict.

## What it is

eek-a-volve is a not-too-serious, agent-based evolution simulator that runs
entirely in the browser. A population of creatures carries an evolvable set of
real-valued traits — size, speed, sense radius, metabolic efficiency, diet, and
colour — and undergoes continuous, energy-driven natural selection. There is no
explicit fitness function and no generation boundaries: creatures simply spend
energy to live and move, gain it by eating (or, when predation is enabled, by
eating each other), reproduce when they have enough to spare, and die when they
run out or grow too old. Adaptation emerges from those rules alone.

The tone is playful over an honest simulation. Creatures and lineages get
procedurally generated mock-Latin names drawn from their dominant traits, rare
"freak" mutations occasionally throw out an out-of-distribution trait, optional
catastrophes (a meteor strike, a plague, an ice age, a drought) disturb the
ecosystem, and an optional AI narrator describes events in the voice of an
over-excited wildlife presenter.

## How it works at a high level

- The user sets the parameters before starting — population, world size, seed,
  food abundance and regeneration, metabolism, reproduction threshold, mutation
  rate and magnitude, predation, catastrophes, and so on. After starting, the
  only controls are the speed multiplier and pause; the run is meant to be left
  going for a long time so adaptation can be watched.
- The simulation runs on a fixed timestep inside a Web Worker, so it keeps a
  steady, reproducible pace and is not throttled when the tab is in the
  background. The main thread renders the world and handles input.
- Rendering uses PixiJS, batching large populations through a particle
  container so many creatures stay tractable to draw. The worker hands the
  renderer compact snapshots; the two never block each other.
- A seeded random-number generator drives every random decision, so the same
  seed and parameters reproduce a run exactly.

## Who it is for

Anyone who enjoys watching an ecosystem find its own balance: the curious
tinkerer adjusting sliders to see what evolves, and the onlooker who just wants
to name the creatures and cheer for the survivors.

## Scope and platforms

The first version targets current desktop browsers on Windows, Linux, and macOS
(Chrome and Firefox on all three; Safari on macOS). Mobile and iOS/iPadOS are
out of scope. It is a single static site hosted on GitHub Pages, with no server
component; the optional narrator talks to OpenRouter using a key the user
supplies and stores in their own browser. Learned/neural-network brains,
WebAssembly or GPU-compute cores, and cross-reload persistence are explicitly
deferred to possible later enhancements.
