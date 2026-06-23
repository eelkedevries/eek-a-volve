// AssemblyScript source for the optional WebAssembly metabolism kernel
// (spec v0.4.3). Compiled to metabolism.wasm by `npm run asbuild`; it is NOT part
// of the TypeScript build (tsconfig excludes *.as.ts) and is imported only as a
// compiled .wasm.
//
// It mirrors core/energy.ts (`metabolicCost` + the per-agent metabolise/reap
// arithmetic) bit-for-bit: f64 maths with f32 storage, identical operation order,
// so a run with the WASM core matches the TypeScript core exactly. It operates in
// place on the world's shared columns (see core/worldLayout.ts): the 4-byte columns
// (energy f32, age u32, traits f32) are addressed at `off + (s << 2)`, and the
// 1-byte columns (alive, and the death-scratch it writes) at `off + s`.

// The host's seeded RNG: imported so a WASM pass advances the same stream as the
// TypeScript passes around it (see metabolismCore.ts), keeping runs bit-identical.
@external("env", "rngNext")
declare function rngNext(): f64;
@external("env", "rngInt")
declare function rngInt(n: i32): i32;
@external("env", "rngGaussian")
declare function rngGaussian(): f64;
@external("env", "jsCos")
declare function jsCos(x: f64): f64;
@external("env", "jsSin")
declare function jsSin(x: f64): f64;
@external("env", "jsFertility")
declare function jsFertility(x: f64, y: f64): f64;

export function run(
  n: i32,
  energyOff: i32,
  ageOff: i32,
  aliveOff: i32,
  sizeOff: i32,
  speedOff: i32,
  effOff: i32,
  displayOff: i32,
  deathOff: i32,
  base: f64,
  displayCost: f64,
  sexual: i32,
  maxAge: u32,
): i32 {
  let deaths: i32 = 0;
  for (let s: i32 = 0; s < n; s++) {
    if (load<u8>(aliveOff + s) == 0) {
      store<u8>(deathOff + s, 0);
      continue;
    }
    const o: i32 = s << 2;
    const size: f64 = <f64>load<f32>(sizeOff + o);
    const speed: f64 = <f64>load<f32>(speedOff + o);
    const eff: f64 = <f64>load<f32>(effOff + o);
    let cost: f64 = (base * (size + speed)) / eff;
    if (sexual != 0) {
      const display: f64 = <f64>load<f32>(displayOff + o);
      cost = cost * (1.0 + displayCost * display);
    }
    const e: f64 = <f64>load<f32>(energyOff + o) - cost;
    const ef: f32 = <f32>e;
    store<f32>(energyOff + o, ef);
    const age: u32 = load<u32>(ageOff + o) + 1;
    store<u32>(ageOff + o, age);
    const dead: bool = <f64>ef <= 0.0 || age > maxAge;
    store<u8>(deathOff + s, dead ? 1 : 0);
    if (dead) deaths++;
  }
  return deaths;
}

/**
 * Carrion decay, bit-identical to core/food.ts `decayCarrion`: for each live
 * carrion (type 1), decrement its `foodDecay` (u16); when it reaches 1 or less,
 * mark it in the death-scratch (the host reaps it via `killFood`, in slot order).
 * Plants and dead/empty slots are skipped (death-scratch cleared).
 */
export function decay(
  n: i32,
  aliveOff: i32,
  typeOff: i32,
  decayOff: i32,
  deathOff: i32,
): void {
  for (let f: i32 = 0; f < n; f++) {
    if (load<u8>(aliveOff + f) == 0 || load<u8>(typeOff + f) != 1) {
      store<u8>(deathOff + f, 0);
      continue;
    }
    const d: u16 = load<u16>(decayOff + (f << 1));
    if (d <= 1) {
      store<u8>(deathOff + f, 1);
    } else {
      store<u16>(decayOff + (f << 1), d - 1);
      store<u8>(deathOff + f, 0);
    }
  }
}

/**
 * Plant regeneration (non-biome, non-season), bit-identical to core/food.ts
 * `regenerateFood`/`placePlant`: place `floor(rate)` plants (plus one with
 * probability `frac`), each at a uniform-random position, allocating from the
 * shared food free-list — same RNG draw order as the TypeScript pass (the host
 * handles the seasonal/biome cases). The `counts` region holds [freeFood, food,
 * plant] at indices 1, 2, 3 (see worldLayout COUNT_*).
 */
export function regenFood(
  rate: f64,
  plantCap: i32,
  worldW: f64,
  worldH: f64,
  plantEnergy: f64,
  foodXOff: i32,
  foodYOff: i32,
  foodTypeOff: i32,
  foodEnergyOff: i32,
  foodDecayOff: i32,
  foodAliveOff: i32,
  freeFoodOff: i32,
  countsOff: i32,
  biome: f64,
): void {
  let freeFoodCount: i32 = load<i32>(countsOff + (1 << 2));
  let foodCount: i32 = load<i32>(countsOff + (2 << 2));
  let plantCount: i32 = load<i32>(countsOff + (3 << 2));
  let count: i32 = <i32>Math.floor(rate);
  const frac: f64 = rate - <f64>count;
  if (frac > 0.0 && rngNext() < frac) count++;
  while (count > 0 && plantCount < plantCap) {
    if (freeFoodCount == 0) break;
    const slot: i32 = load<i32>(freeFoodOff + ((freeFoodCount - 1) << 2));
    freeFoodCount--;
    store<u8>(foodAliveOff + slot, 1);
    foodCount++;
    let px: f64 = rngNext() * worldW;
    let py: f64 = rngNext() * worldH;
    // With biomes on, reject barren candidates (imported fertilityAt, host-computed).
    if (biome > 0.0) {
      for (let tries: i32 = 0; tries < 8; tries++) {
        const f: f64 = jsFertility(px, py);
        if (rngNext() < 1.0 - biome + biome * f) break;
        px = rngNext() * worldW;
        py = rngNext() * worldH;
      }
    }
    store<f32>(foodXOff + (slot << 2), <f32>px);
    store<f32>(foodYOff + (slot << 2), <f32>py);
    store<u8>(foodTypeOff + slot, 0);
    store<f32>(foodEnergyOff + (slot << 2), <f32>plantEnergy);
    store<u16>(foodDecayOff + (slot << 1), 0);
    plantCount++;
    count--;
  }
  store<i32>(countsOff + (1 << 2), freeFoodCount);
  store<i32>(countsOff + (2 << 2), foodCount);
  store<i32>(countsOff + (3 << 2), plantCount);
}

/**
 * Inherit a child genome from one parent (`sexual` = 0) or two (`sexual` = 1, uniform
 * crossover), bit-identical to core/mutation.ts `breed`/`breedSexual`: per-trait
 * Gaussian mutation (probability `mutationRate`, magnitude × range width), clamp to
 * range, then a rare freak re-sample. Trait columns are contiguous at `traitsOff`
 * with stride `cap`; `rangesOff` holds f64 [min, max] pairs. Brain weights are not
 * inherited here, so the WASM core requires `neuralBrains` off. Returns 1 on a freak.
 */
export function breed(
  child: i32,
  parentA: i32,
  parentB: i32,
  sexual: i32,
  mutationRate: f64,
  mutationMagnitude: f64,
  traitsOff: i32,
  cap: i32,
  traitCount: i32,
  rangesOff: i32,
): i32 {
  for (let t: i32 = 0; t < traitCount; t++) {
    const colOff: i32 = traitsOff + t * cap * 4;
    let value: f64;
    if (sexual != 0) {
      value =
        rngNext() < 0.5
          ? <f64>load<f32>(colOff + (parentA << 2))
          : <f64>load<f32>(colOff + (parentB << 2));
    } else {
      value = <f64>load<f32>(colOff + (parentA << 2));
    }
    if (rngNext() < mutationRate) {
      const min: f64 = load<f64>(rangesOff + ((t << 1) << 3));
      const max: f64 = load<f64>(rangesOff + (((t << 1) + 1) << 3));
      value += rngGaussian() * mutationMagnitude * (max - min);
      value = value < min ? min : value > max ? max : value;
    }
    store<f32>(colOff + (child << 2), <f32>value);
  }
  if (rngNext() < 0.001) {
    const t: i32 = rngInt(traitCount);
    const min: f64 = load<f64>(rangesOff + ((t << 1) << 3));
    const max: f64 = load<f64>(rangesOff + (((t << 1) + 1) << 3));
    const colOff: i32 = traitsOff + t * cap * 4;
    store<f32>(colOff + (child << 2), <f32>(min + rngNext() * (max - min)));
    return 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Behaviour pass (066): a bit-identical port of core/behaviour.ts `Behaviour.step`
// for the non-brain, non-pheromone case (the WASM core requires those off). Trait
// indices, action codes, and tuning constants below mirror the TypeScript sources
// exactly. Column/grid offsets are read from a config table (filled by
// metabolismCore) into module globals so the per-agent helpers can address memory.
// ---------------------------------------------------------------------------

// Trait indices (genome.ts).
const T_SIZE: i32 = 0;
const T_SPEED: i32 = 1;
const T_SENSE: i32 = 2;
const T_DIET: i32 = 4;
const T_DISPLAY: i32 = 6;
const T_MATEPREF: i32 = 7;
const SPECIES_TRAITS: i32 = 6;
// Total genome trait count (genome.ts TRAIT_COUNT). Breeding must iterate all of
// them (and draw RNG for each) to stay bit-identical to the TS `breed`/`breedSexual`,
// even for the non-ecological trailing traits (resistance, v0.6.0).
const TRAIT_COUNT_K: i32 = 9;
// Action codes (state.ts).
const A_IDLE: i32 = 0;
const A_SEEKING: i32 = 1;
const A_EATING: i32 = 2;
const A_FLEEING: i32 = 3;
const A_COURTING: i32 = 5;
// Tuning constants (behaviour.ts / lifestage.ts / speciation.ts / food.ts).
const JUVENILE_MAX_AGE: u32 = 250;
const SPECIES_DIST2: f64 = 0.3 * 0.3;
const EAT_R2: f64 = 4.0 * 4.0;
const MATE_R2: f64 = 24.0 * 24.0;
const REPRO_COST: f64 = 0.5;
const SEXUAL_COST: f64 = 0.3;
const FOOD_TYPE_PENALTY: f64 = 4.0;
const MATE_PREF_WEIGHT: f64 = 8.0;

// Offsets, set per call from the config table.
let G_X: i32 = 0;
let G_Y: i32 = 0;
let G_VX: i32 = 0;
let G_VY: i32 = 0;
let G_ENERGY: i32 = 0;
let G_AGE: i32 = 0;
let G_ALIVE: i32 = 0;
let G_ACTION: i32 = 0;
let G_ID: i32 = 0;
let G_PARENTID: i32 = 0;
let G_GENERATION: i32 = 0;
let G_OFFSPRING: i32 = 0;
let G_SPECIESID: i32 = 0;
let G_TRAITS0: i32 = 0;
let G_FOODX: i32 = 0;
let G_FOODY: i32 = 0;
let G_FOODALIVE: i32 = 0;
let G_FOODTYPE: i32 = 0;
let G_FOODENERGY: i32 = 0;
let G_AHEAD: i32 = 0;
let G_ANEXT: i32 = 0;
let G_AITEMX: i32 = 0;
let G_AITEMY: i32 = 0;
let G_FHEAD: i32 = 0;
let G_FNEXT: i32 = 0;
let G_FITEMX: i32 = 0;
let G_FITEMY: i32 = 0;
let G_FREEAGENTS: i32 = 0;
let G_COUNTS: i32 = 0;
let G_RANGES: i32 = 0;
let G_LIVE: i32 = 0;
let G_MATED: i32 = 0;
let G_NEWBORNS: i32 = 0;
let G_FREAK: i32 = 0;
let G_OUTPUTS: i32 = 0;
let G_SELFNORM: i32 = 0;
let G_FREEFOOD: i32 = 0;
let G_CAP: i32 = 0;
let G_COLS: i32 = 0;
let G_ROWS: i32 = 0;
let G_CELL: f64 = 0;
// Pheromone state (set per behaviourStep call when pheromones are on).
let G_PHFIELD: i32 = 0;
let G_PHCOLS: i32 = 0;
let G_PHROWS: i32 = 0;
let G_USEPHEROMONES: i32 = 0;
let G_PHCELL: f64 = 0;
let G_PHDEPOSIT: f64 = 0;
let G_phGradX: f64 = 0;
let G_phGradY: f64 = 0;

/** Pheromone cell index for a world position (clamped to the field bounds). */
@inline function phCellOf(x: f64, y: f64): i32 {
  let cx = <i32>Math.floor(x / G_PHCELL);
  let cy = <i32>Math.floor(y / G_PHCELL);
  cx = cx < 0 ? 0 : cx > G_PHCOLS - 1 ? G_PHCOLS - 1 : cx;
  cy = cy < 0 ? 0 : cy > G_PHROWS - 1 ? G_PHROWS - 1 : cy;
  return cy * G_PHCOLS + cx;
}

/** Central-difference gradient of the pheromone field at (x, y), into G_phGradX/Y;
 *  returns |gradX| + |gradY|, mirroring PheromoneField.sampleGradient. */
function phGradient(x: f64, y: f64): f64 {
  let cx = <i32>Math.floor(x / G_PHCELL);
  let cy = <i32>Math.floor(y / G_PHCELL);
  cx = cx < 0 ? 0 : cx > G_PHCOLS - 1 ? G_PHCOLS - 1 : cx;
  cy = cy < 0 ? 0 : cy > G_PHROWS - 1 ? G_PHROWS - 1 : cy;
  const i = cy * G_PHCOLS + cx;
  const here = <f64>load<f32>(G_PHFIELD + (i << 2));
  const left = cx > 0 ? <f64>load<f32>(G_PHFIELD + ((i - 1) << 2)) : here;
  const right = cx < G_PHCOLS - 1 ? <f64>load<f32>(G_PHFIELD + ((i + 1) << 2)) : here;
  const up = cy > 0 ? <f64>load<f32>(G_PHFIELD + ((i - G_PHCOLS) << 2)) : here;
  const down = cy < G_PHROWS - 1 ? <f64>load<f32>(G_PHFIELD + ((i + G_PHCOLS) << 2)) : here;
  G_phGradX = right - left;
  G_phGradY = down - up;
  return abs(G_phGradX) + abs(G_phGradY);
}

/** Pheromone-field decay + diffusion, bit-identical to PheromoneField.step. */
export function pheromoneStep(
  fieldOff: i32,
  scratchOff: i32,
  cols: i32,
  rows: i32,
  decay: f64,
  diffusion: f64,
): void {
  for (let cy = 0; cy < rows; cy++) {
    const row = cy * cols;
    for (let cx = 0; cx < cols; cx++) {
      const i = row + cx;
      const self = <f64>load<f32>(fieldOff + (i << 2));
      const left = cx > 0 ? <f64>load<f32>(fieldOff + ((i - 1) << 2)) : self;
      const right = cx < cols - 1 ? <f64>load<f32>(fieldOff + ((i + 1) << 2)) : self;
      const up = cy > 0 ? <f64>load<f32>(fieldOff + ((i - cols) << 2)) : self;
      const down = cy < rows - 1 ? <f64>load<f32>(fieldOff + ((i + cols) << 2)) : self;
      const mean = (left + right + up + down) * 0.25;
      store<f32>(scratchOff + (i << 2), <f32>((self + (mean - self) * diffusion) * decay));
    }
  }
  const n = cols * rows;
  for (let i = 0; i < n; i++) store<f32>(fieldOff + (i << 2), load<f32>(scratchOff + (i << 2)));
}

@inline function tcol(t: i32): i32 {
  return G_TRAITS0 + t * G_CAP * 4;
}
@inline function ftrait(t: i32, s: i32): f64 {
  return <f64>load<f32>(tcol(t) + (s << 2));
}
@inline function clampPos(v: f64, max: f64): f64 {
  return v < 0.0 ? 0.0 : v > max ? max : v;
}
/** Allocate an agent slot from the shared free-list, mirroring World.spawnAgent. */
function wasmSpawnAgent(): i32 {
  let freeCount = load<i32>(G_COUNTS + (0 << 2)); // COUNT_FREE_AGENT
  if (freeCount == 0) return -1;
  freeCount--;
  const slot = load<i32>(G_FREEAGENTS + (freeCount << 2));
  store<i32>(G_COUNTS + (0 << 2), freeCount);
  store<u8>(G_ALIVE + slot, 1);
  store<u32>(G_AGE + (slot << 2), 0);
  const nextId = load<i32>(G_COUNTS + (6 << 2)); // COUNT_NEXT_ID
  store<u32>(G_ID + (slot << 2), <u32>nextId);
  store<i32>(G_COUNTS + (6 << 2), nextId + 1);
  store<u32>(G_PARENTID + (slot << 2), 0);
  store<u32>(G_GENERATION + (slot << 2), 0);
  store<u32>(G_OFFSPRING + (slot << 2), 0);
  store<u8>(G_ACTION + slot, 0);
  store<i32>(G_COUNTS + (5 << 2), load<i32>(G_COUNTS + (5 << 2)) + 1); // population++
  return slot;
}

/** Remove a food item, mirroring World.killFood (no-op if already gone). */
function wasmKillFood(slot: i32): void {
  if (load<u8>(G_FOODALIVE + slot) == 0) return;
  store<u8>(G_FOODALIVE + slot, 0);
  if (load<u8>(G_FOODTYPE + slot) == 0) {
    store<i32>(G_COUNTS + (3 << 2), load<i32>(G_COUNTS + (3 << 2)) - 1); // plantCount--
  } else {
    store<i32>(G_COUNTS + (4 << 2), load<i32>(G_COUNTS + (4 << 2)) - 1); // carrionCount--
  }
  const freeFood = load<i32>(G_COUNTS + (1 << 2)); // COUNT_FREE_FOOD
  store<i32>(G_FREEFOOD + (freeFood << 2), slot);
  store<i32>(G_COUNTS + (1 << 2), freeFood + 1);
  store<i32>(G_COUNTS + (2 << 2), load<i32>(G_COUNTS + (2 << 2)) - 1); // foodCount--
}

/** Load all column/grid offsets from the config table into the module globals. */
function loadConfig(configOff: i32, cap: i32, cols: i32, rows: i32, cellSize: f64): void {
  G_X = load<i32>(configOff + (0 << 2));
  G_Y = load<i32>(configOff + (1 << 2));
  G_VX = load<i32>(configOff + (2 << 2));
  G_VY = load<i32>(configOff + (3 << 2));
  G_ENERGY = load<i32>(configOff + (4 << 2));
  G_AGE = load<i32>(configOff + (5 << 2));
  G_ALIVE = load<i32>(configOff + (6 << 2));
  G_ACTION = load<i32>(configOff + (7 << 2));
  G_ID = load<i32>(configOff + (8 << 2));
  G_PARENTID = load<i32>(configOff + (9 << 2));
  G_GENERATION = load<i32>(configOff + (10 << 2));
  G_OFFSPRING = load<i32>(configOff + (11 << 2));
  G_SPECIESID = load<i32>(configOff + (12 << 2));
  G_TRAITS0 = load<i32>(configOff + (13 << 2));
  G_FOODX = load<i32>(configOff + (14 << 2));
  G_FOODY = load<i32>(configOff + (15 << 2));
  G_FOODALIVE = load<i32>(configOff + (16 << 2));
  G_FOODTYPE = load<i32>(configOff + (17 << 2));
  G_FOODENERGY = load<i32>(configOff + (18 << 2));
  G_AHEAD = load<i32>(configOff + (19 << 2));
  G_ANEXT = load<i32>(configOff + (20 << 2));
  G_AITEMX = load<i32>(configOff + (21 << 2));
  G_AITEMY = load<i32>(configOff + (22 << 2));
  G_FHEAD = load<i32>(configOff + (23 << 2));
  G_FNEXT = load<i32>(configOff + (24 << 2));
  G_FITEMX = load<i32>(configOff + (25 << 2));
  G_FITEMY = load<i32>(configOff + (26 << 2));
  G_FREEAGENTS = load<i32>(configOff + (27 << 2));
  G_COUNTS = load<i32>(configOff + (28 << 2));
  G_RANGES = load<i32>(configOff + (29 << 2));
  G_LIVE = load<i32>(configOff + (30 << 2));
  G_MATED = load<i32>(configOff + (31 << 2));
  G_NEWBORNS = load<i32>(configOff + (32 << 2));
  G_FREAK = load<i32>(configOff + (33 << 2));
  G_OUTPUTS = load<i32>(configOff + (34 << 2));
  G_SELFNORM = load<i32>(configOff + (35 << 2));
  G_FREEFOOD = load<i32>(configOff + (36 << 2));
  G_PHFIELD = load<i32>(configOff + (37 << 2));
  G_CAP = cap;
  G_COLS = cols;
  G_ROWS = rows;
  G_CELL = cellSize;
}

export function behaviourStep(
  configOff: i32,
  cap: i32,
  cols: i32,
  rows: i32,
  cellSize: f64,
  worldWidth: f64,
  worldHeight: f64,
  reproductionThreshold: f64,
  sexual: i32,
  mutationRate: f64,
  mutationMagnitude: f64,
  twoPi: f64,
  usePheromones: i32,
  phCols: i32,
  phRows: i32,
  phCell: f64,
  phDeposit: f64,
): void {
  loadConfig(configOff, cap, cols, rows, cellSize);
  G_USEPHEROMONES = usePheromones;
  G_PHCOLS = phCols;
  G_PHROWS = phRows;
  G_PHCELL = phCell;
  G_PHDEPOSIT = phDeposit;

  // Snapshot the agents alive at the start of the tick so newborns wait.
  let n = 0;
  for (let s = 0; s < cap; s++) {
    if (load<u8>(G_ALIVE + s) == 1) {
      store<i32>(G_LIVE + (n << 2), s);
      n++;
    }
  }
  if (sexual != 0) {
    for (let s = 0; s < cap; s++) store<u8>(G_MATED + s, 0);
  }
  let freakCount = 0;
  let newbornCount = 0;
  let births = 0;

  for (let i = 0; i < n; i++) {
    const s = load<i32>(G_LIVE + (i << 2));
    const px = <f64>load<f32>(G_X + (s << 2));
    const py = <f64>load<f32>(G_Y + (s << 2));
    const selfSize = ftrait(T_SIZE, s);
    const selfDiet = ftrait(T_DIET, s);
    let bestFood = -1;
    let bestFoodWeighted = Infinity;
    let hasThreat = false;
    let threatX: f64 = 0;
    let threatY: f64 = 0;
    let threatDist2 = Infinity;
    let bestMate = -1;
    let bestMateDist2 = Infinity;
    let bestMateWeighted = Infinity;

    const energyS = <f64>load<f32>(G_ENERGY + (s << 2));
    const selfReady =
      sexual != 0 && load<u32>(G_AGE + (s << 2)) >= JUVENILE_MAX_AGE && energyS > reproductionThreshold;
    let selfPref: f64 = 0;
    if (selfReady) {
      for (let t = 0; t < SPECIES_TRAITS; t++) {
        const min = load<f64>(G_RANGES + ((t << 1) << 3));
        const max = load<f64>(G_RANGES + (((t << 1) + 1) << 3));
        store<f64>(G_SELFNORM + (t << 3), (ftrait(t, s) - min) / (max - min));
      }
      selfPref = ftrait(T_MATEPREF, s);
    }

    const sense = ftrait(T_SENSE, s);

    // --- agent grid query (threat + mate), inlined ---
    {
      const r2 = sense * sense;
      const minCx = clampCell(px - sense, G_COLS);
      const maxCx = clampCell(px + sense, G_COLS);
      const minCy = clampCell(py - sense, G_ROWS);
      const maxCy = clampCell(py + sense, G_ROWS);
      for (let cy = minCy; cy <= maxCy; cy++) {
        const rowBase = cy * G_COLS;
        for (let cx = minCx; cx <= maxCx; cx++) {
          let id = load<i32>(G_AHEAD + ((rowBase + cx) << 2));
          while (id != -1) {
            const dx = px - <f64>load<f32>(G_AITEMX + (id << 2));
            const dy = py - <f64>load<f32>(G_AITEMY + (id << 2));
            const d2 = dx * dx + dy * dy;
            if (d2 <= r2 && id != s) {
              // Threat: a larger, more carnivorous neighbour.
              if (ftrait(T_SIZE, id) > selfSize && ftrait(T_DIET, id) > selfDiet && d2 < threatDist2) {
                threatDist2 = d2;
                threatX = <f64>load<f32>(G_X + (id << 2));
                threatY = <f64>load<f32>(G_Y + (id << 2));
                hasThreat = true;
              }
              // Mate.
              if (
                selfReady &&
                load<u32>(G_AGE + (id << 2)) >= JUVENILE_MAX_AGE &&
                <f64>load<f32>(G_ENERGY + (id << 2)) > reproductionThreshold
              ) {
                let gd2: f64 = 0;
                for (let t = 0; t < SPECIES_TRAITS; t++) {
                  const min = load<f64>(G_RANGES + ((t << 1) << 3));
                  const max = load<f64>(G_RANGES + (((t << 1) + 1) << 3));
                  const norm = (ftrait(t, id) - min) / (max - min);
                  const diff = norm - load<f64>(G_SELFNORM + (t << 3));
                  gd2 += diff * diff;
                }
                if (gd2 < SPECIES_DIST2) {
                  const mismatch = abs(ftrait(T_DISPLAY, id) - selfPref);
                  const weighted = d2 * (1.0 + MATE_PREF_WEIGHT * mismatch);
                  if (weighted < bestMateWeighted) {
                    bestMateWeighted = weighted;
                    bestMateDist2 = d2;
                    bestMate = id;
                  }
                }
              }
            }
            id = load<i32>(G_ANEXT + (id << 2));
          }
        }
      }
    }

    // --- food grid query (best food), inlined ---
    {
      const r2 = sense * sense;
      const preferred: i32 = selfDiet > 0.5 ? 1 : 0; // CARRION : PLANT
      const minCx = clampCell(px - sense, G_COLS);
      const maxCx = clampCell(px + sense, G_COLS);
      const minCy = clampCell(py - sense, G_ROWS);
      const maxCy = clampCell(py + sense, G_ROWS);
      for (let cy = minCy; cy <= maxCy; cy++) {
        const rowBase = cy * G_COLS;
        for (let cx = minCx; cx <= maxCx; cx++) {
          let id = load<i32>(G_FHEAD + ((rowBase + cx) << 2));
          while (id != -1) {
            const dx = px - <f64>load<f32>(G_FITEMX + (id << 2));
            const dy = py - <f64>load<f32>(G_FITEMY + (id << 2));
            const d2 = dx * dx + dy * dy;
            if (d2 <= r2) {
              const weighted = <i32>load<u8>(G_FOODTYPE + id) == preferred ? d2 : d2 * FOOD_TYPE_PENALTY;
              if (weighted < bestFoodWeighted) {
                bestFoodWeighted = weighted;
                bestFood = id;
              }
            }
            id = load<i32>(G_FNEXT + (id << 2));
          }
        }
      }
    }

    // --- heading: flee / court / seek / wander ---
    let dx: f64;
    let dy: f64;
    if (hasThreat) {
      dx = px - threatX;
      dy = py - threatY;
      store<u8>(G_ACTION + s, A_FLEEING);
    } else if (selfReady && bestMate != -1) {
      dx = <f64>load<f32>(G_X + (bestMate << 2)) - px;
      dy = <f64>load<f32>(G_Y + (bestMate << 2)) - py;
      store<u8>(G_ACTION + s, A_COURTING);
    } else if (bestFood != -1) {
      dx = <f64>load<f32>(G_FOODX + (bestFood << 2)) - px;
      dy = <f64>load<f32>(G_FOODY + (bestFood << 2)) - py;
      store<u8>(G_ACTION + s, A_SEEKING);
    } else if (G_USEPHEROMONES != 0 && phGradient(px, py) > 1e-6) {
      // No food sensed: climb the local pheromone trail.
      dx = G_phGradX;
      dy = G_phGradY;
      store<u8>(G_ACTION + s, A_IDLE);
    } else {
      const angle = rngNext() * twoPi;
      dx = jsCos(angle);
      dy = jsSin(angle);
      store<u8>(G_ACTION + s, A_IDLE);
    }

    // --- move at the agent's speed ---
    const speed = ftrait(T_SPEED, s);
    const len = Math.sqrt(dx * dx + dy * dy);
    let vxs: f64;
    let vys: f64;
    if (len > 1e-9) {
      vxs = (dx / len) * speed;
      vys = (dy / len) * speed;
    } else {
      vxs = 0;
      vys = 0;
    }
    store<f32>(G_VX + (s << 2), <f32>vxs);
    store<f32>(G_VY + (s << 2), <f32>vys);
    const nx = clampPos(px + <f64>load<f32>(G_VX + (s << 2)), worldWidth);
    const ny = clampPos(py + <f64>load<f32>(G_VY + (s << 2)), worldHeight);
    store<f32>(G_X + (s << 2), <f32>nx);
    store<f32>(G_Y + (s << 2), <f32>ny);

    // --- eat the targeted food if reached and still available ---
    if (bestFood != -1 && load<u8>(G_FOODALIVE + bestFood) == 1) {
      const fdx = <f64>load<f32>(G_FOODX + (bestFood << 2)) - nx;
      const fdy = <f64>load<f32>(G_FOODY + (bestFood << 2)) - ny;
      if (fdx * fdx + fdy * fdy <= EAT_R2) {
        // feed(): energy capped at 100*size.
        const cap2 = 100.0 * selfSize;
        const gained = <f64>load<f32>(G_ENERGY + (s << 2)) + <f64>load<f32>(G_FOODENERGY + (bestFood << 2));
        store<f32>(G_ENERGY + (s << 2), <f32>(gained > cap2 ? cap2 : gained));
        wasmKillFood(bestFood);
        store<u8>(G_ACTION + s, A_EATING);
        if (G_USEPHEROMONES != 0) {
          const ci = phCellOf(nx, ny);
          store<f32>(G_PHFIELD + (ci << 2), <f32>(<f64>load<f32>(G_PHFIELD + (ci << 2)) + G_PHDEPOSIT));
        }
      }
    }

    // --- reproduce ---
    if (sexual != 0) {
      const mate = bestMate;
      if (
        selfReady &&
        mate != -1 &&
        load<u8>(G_MATED + s) == 0 &&
        load<u8>(G_MATED + mate) == 0 &&
        bestMateDist2 <= MATE_R2 &&
        load<u8>(G_ALIVE + mate) == 1 &&
        <f64>load<f32>(G_ENERGY + (mate << 2)) > reproductionThreshold &&
        load<u32>(G_AGE + (mate << 2)) >= JUVENILE_MAX_AGE
      ) {
        const child = wasmSpawnAgent();
        if (child != -1) {
          if (breed(child, s, mate, 1, mutationRate, mutationMagnitude, G_TRAITS0, G_CAP, TRAIT_COUNT_K, G_RANGES) == 1) {
            store<i32>(G_FREAK + (freakCount << 2), child);
            freakCount++;
          }
          const giveA = <f64>load<f32>(G_ENERGY + (s << 2)) * SEXUAL_COST;
          const giveB = <f64>load<f32>(G_ENERGY + (mate << 2)) * SEXUAL_COST;
          store<f32>(G_ENERGY + (s << 2), <f32>(<f64>load<f32>(G_ENERGY + (s << 2)) - giveA));
          store<f32>(G_ENERGY + (mate << 2), <f32>(<f64>load<f32>(G_ENERGY + (mate << 2)) - giveB));
          store<f32>(G_ENERGY + (child << 2), <f32>(giveA + giveB));
          store<f32>(G_X + (child << 2), <f32>nx);
          store<f32>(G_Y + (child << 2), <f32>ny);
          store<f32>(G_VX + (child << 2), 0);
          store<f32>(G_VY + (child << 2), 0);
          store<i32>(G_SPECIESID + (child << 2), load<i32>(G_SPECIESID + (s << 2)));
          store<u32>(G_PARENTID + (child << 2), load<u32>(G_ID + (s << 2)));
          const gs = load<u32>(G_GENERATION + (s << 2));
          const gm = load<u32>(G_GENERATION + (mate << 2));
          store<u32>(G_GENERATION + (child << 2), (gs > gm ? gs : gm) + 1);
          store<u32>(G_OFFSPRING + (s << 2), load<u32>(G_OFFSPRING + (s << 2)) + 1);
          store<u32>(G_OFFSPRING + (mate << 2), load<u32>(G_OFFSPRING + (mate << 2)) + 1);
          store<i32>(G_NEWBORNS + (newbornCount << 2), child);
          newbornCount++;
          store<u8>(G_MATED + s, 1);
          store<u8>(G_MATED + mate, 1);
          store<u8>(G_ACTION + s, A_COURTING);
          store<u8>(G_ACTION + mate, A_COURTING);
          births++;
        }
      }
    } else if (
      <f64>load<f32>(G_ENERGY + (s << 2)) > reproductionThreshold &&
      load<u32>(G_AGE + (s << 2)) >= JUVENILE_MAX_AGE
    ) {
      const child = wasmSpawnAgent();
      if (child != -1) {
        if (breed(child, s, s, 0, mutationRate, mutationMagnitude, G_TRAITS0, G_CAP, TRAIT_COUNT_K, G_RANGES) == 1) {
          store<i32>(G_FREAK + (freakCount << 2), child);
          freakCount++;
        }
        const give = <f64>load<f32>(G_ENERGY + (s << 2)) * REPRO_COST;
        store<f32>(G_ENERGY + (s << 2), <f32>(<f64>load<f32>(G_ENERGY + (s << 2)) - give));
        store<f32>(G_ENERGY + (child << 2), <f32>give);
        store<f32>(G_X + (child << 2), <f32>nx);
        store<f32>(G_Y + (child << 2), <f32>ny);
        store<f32>(G_VX + (child << 2), 0);
        store<f32>(G_VY + (child << 2), 0);
        store<i32>(G_SPECIESID + (child << 2), load<i32>(G_SPECIESID + (s << 2)));
        store<u32>(G_PARENTID + (child << 2), load<u32>(G_ID + (s << 2)));
        store<u32>(G_GENERATION + (child << 2), load<u32>(G_GENERATION + (s << 2)) + 1);
        store<u32>(G_OFFSPRING + (s << 2), load<u32>(G_OFFSPRING + (s << 2)) + 1);
        store<i32>(G_NEWBORNS + (newbornCount << 2), child);
        newbornCount++;
        births++;
      }
    }
  }

  store<i32>(G_OUTPUTS + (0 << 2), births);
  store<i32>(G_OUTPUTS + (1 << 2), newbornCount);
  store<i32>(G_OUTPUTS + (2 << 2), freakCount);
}

@inline function clampCell(coord: f64, n: i32): i32 {
  let c = <i32>Math.floor(coord / G_CELL);
  return c < 0 ? 0 : c > n - 1 ? n - 1 : c;
}

// Predation (067): bit-identical port of core/predation.ts `Predation.step`.
// Deterministic (no RNG): a carnivore eats the nearest smaller neighbour for energy.
const A_HUNTING: i32 = 4;
const CARNIVORY_THRESHOLD: f64 = 0.6;
const PREY_SIZE_RATIO: f64 = 0.8;
const ATTACK_RADIUS: f64 = 5.0;
const PREY_ENERGY_FACTOR: f64 = 30.0;

export function predationStep(configOff: i32, cap: i32, cols: i32, rows: i32, cellSize: f64): i32 {
  loadConfig(configOff, cap, cols, rows, cellSize);
  let deaths = 0;
  for (let s = 0; s < cap; s++) {
    if (load<u8>(G_ALIVE + s) == 0 || ftrait(T_DIET, s) <= CARNIVORY_THRESHOLD) continue;
    const selfSize = ftrait(T_SIZE, s);
    const px = <f64>load<f32>(G_X + (s << 2));
    const py = <f64>load<f32>(G_Y + (s << 2));
    let bestPrey = -1;
    let bestPreyDist2 = Infinity;
    const r2 = ATTACK_RADIUS * ATTACK_RADIUS;
    const minCx = clampCell(px - ATTACK_RADIUS, G_COLS);
    const maxCx = clampCell(px + ATTACK_RADIUS, G_COLS);
    const minCy = clampCell(py - ATTACK_RADIUS, G_ROWS);
    const maxCy = clampCell(py + ATTACK_RADIUS, G_ROWS);
    for (let cy = minCy; cy <= maxCy; cy++) {
      const rowBase = cy * G_COLS;
      for (let cx = minCx; cx <= maxCx; cx++) {
        let id = load<i32>(G_AHEAD + ((rowBase + cx) << 2));
        while (id != -1) {
          const dx = px - <f64>load<f32>(G_AITEMX + (id << 2));
          const dy = py - <f64>load<f32>(G_AITEMY + (id << 2));
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2 && id != s) {
            if (ftrait(T_SIZE, id) < selfSize * PREY_SIZE_RATIO && d2 < bestPreyDist2) {
              bestPreyDist2 = d2;
              bestPrey = id;
            }
          }
          id = load<i32>(G_ANEXT + (id << 2));
        }
      }
    }
    if (bestPrey != -1 && load<u8>(G_ALIVE + bestPrey) == 1) {
      const cap2 = 100.0 * selfSize;
      const gained = <f64>load<f32>(G_ENERGY + (s << 2)) + ftrait(T_SIZE, bestPrey) * PREY_ENERGY_FACTOR;
      store<f32>(G_ENERGY + (s << 2), <f32>(gained > cap2 ? cap2 : gained));
      store<u8>(G_ALIVE + bestPrey, 0);
      const freeCount = load<i32>(G_COUNTS + (0 << 2));
      store<i32>(G_FREEAGENTS + (freeCount << 2), bestPrey);
      store<i32>(G_COUNTS + (0 << 2), freeCount + 1);
      store<i32>(G_COUNTS + (5 << 2), load<i32>(G_COUNTS + (5 << 2)) - 1);
      store<u8>(G_ACTION + s, A_HUNTING);
      deaths++;
    }
  }
  return deaths;
}
