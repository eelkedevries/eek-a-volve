import { SimulationClient } from './worker/client.ts';
import { DEFAULT_PARAMETERS } from './core/params.ts';
import { H_TICK, H_POPULATION, H_SPECIES_COUNT } from './core/snapshot.ts';

// Temporary Phase 2 wiring: start a run and log header stats from snapshots.
// Replaced by the PixiJS renderer in Phase 3.
const client = new SimulationClient();
let frames = 0;
client.start(DEFAULT_PARAMETERS, (view) => {
  if (frames++ % 60 === 0) {
    console.log(
      `tick ${view[H_TICK]} | pop ${view[H_POPULATION]} | species ${view[H_SPECIES_COUNT]}`,
    );
  }
});
