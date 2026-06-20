/**
 * A small fixed-topology neural network for the optional learned-brains capability
 * (specification: Locked decisions — optional-capability principle, v0.4.0). A
 * single hidden layer maps sensory inputs to a 2-D movement output. Pure and
 * deterministic (only `tanh`; no RNG, no platform randomness) and allocation-free:
 * the hidden-layer scratch is reused. Weights live per creature in the genome and
 * evolve; this module only evaluates them.
 */

export const BRAIN_INPUTS = 6;
export const BRAIN_HIDDEN = 8;
export const BRAIN_OUTPUTS = 2;

/** Total weights+biases per creature: (in→hidden + hidden bias) + (hidden→out + out bias). */
export const BRAIN_WEIGHT_COUNT =
  BRAIN_INPUTS * BRAIN_HIDDEN + BRAIN_HIDDEN + BRAIN_HIDDEN * BRAIN_OUTPUTS + BRAIN_OUTPUTS;

/** Reused hidden-layer scratch (single-threaded worker; safe and allocation-free). */
const hidden = new Float64Array(BRAIN_HIDDEN);

/**
 * Evaluate the network for one creature whose weights start at `base` in
 * `weights`, reading `inputs` (length {@link BRAIN_INPUTS}) and writing `out`
 * (length {@link BRAIN_OUTPUTS}), each output in [-1, 1]. Deterministic and
 * allocation-free.
 */
export function evaluate(
  weights: Float32Array,
  base: number,
  inputs: Float32Array,
  out: Float32Array,
): void {
  let w = base;
  for (let h = 0; h < BRAIN_HIDDEN; h++) {
    let sum = 0;
    for (let i = 0; i < BRAIN_INPUTS; i++) sum += inputs[i] * weights[w++];
    sum += weights[w++]; // hidden bias
    hidden[h] = Math.tanh(sum);
  }
  for (let o = 0; o < BRAIN_OUTPUTS; o++) {
    let sum = 0;
    for (let h = 0; h < BRAIN_HIDDEN; h++) sum += hidden[h] * weights[w++];
    sum += weights[w++]; // output bias
    out[o] = Math.tanh(sum);
  }
}
