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
    const px: f64 = rngNext() * worldW;
    const py: f64 = rngNext() * worldH;
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
