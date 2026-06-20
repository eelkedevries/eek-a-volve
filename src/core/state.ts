/**
 * What an agent is doing on a given tick, recorded by the behaviour and
 * predation passes and carried in the render snapshot so the renderer and UI can
 * show recognisable behaviour. Plain integers (no `enum`, per the project's
 * `erasableSyntaxOnly` TypeScript config).
 */
export const IDLE = 0;
export const SEEKING = 1;
export const EATING = 2;
export const FLEEING = 3;
export const HUNTING = 4;
export const COURTING = 5;
export const ACTION_COUNT = 6;
