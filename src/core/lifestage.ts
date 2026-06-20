/**
 * Life stages (specification: Domain rules → Reproduction). A creature is a
 * juvenile until it matures, then an adult, then an elder in old age. Only
 * mature creatures (adult or elder) reproduce; juveniles render smaller. Stages
 * are derived from `age` — no extra state — and carried in the snapshot's packed
 * state byte. Provisional thresholds, tuned for stability (012).
 */
export const JUVENILE = 0;
export const ADULT = 1;
export const ELDER = 2;

/** Age (ticks) below which a creature is a juvenile and cannot yet reproduce. */
export const JUVENILE_MAX_AGE = 250;
/** Age (ticks) at or above which a creature is an elder. */
export const ELDER_MIN_AGE = 2200;

export function stageOf(age: number): number {
  if (age < JUVENILE_MAX_AGE) return JUVENILE;
  if (age >= ELDER_MIN_AGE) return ELDER;
  return ADULT;
}

/** True once a creature is old enough to reproduce. */
export function isMature(age: number): boolean {
  return age >= JUVENILE_MAX_AGE;
}

/** Render-scale multiplier per stage (juveniles are smaller). */
export function stageScale(stage: number): number {
  return stage === JUVENILE ? 0.55 : 1;
}
