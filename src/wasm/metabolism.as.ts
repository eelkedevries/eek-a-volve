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
