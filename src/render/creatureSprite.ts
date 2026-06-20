import { Container, Graphics } from 'pixi.js';

/** Local radius of the unit creature body; world scaling is applied by the container. */
const BODY_RADIUS = 8;
/** Eye disc colour (kept constant so eyes read as eyes regardless of species tint). */
const EYE_COLOUR = 0x10151b;
/** Maw colour — a dark red that survives the colour-blind palettes (role cue, not species). */
const MAW_COLOUR = 0x3a0e0e;
/** Ornament/crest colour — a bright gold so "showy" reads regardless of species tint. */
const CREST_COLOUR = 0xffc24d;
/** Energy fraction at or above which the body shows full colour; below it starts to fade. */
const STARVE_FROM = 0.35;
/** Mid-grey the body desaturates toward when starving. */
const STARVE_GREY = 0x6a6a6a;

/** Blend `colour` toward `target` by `t` (0…1), per channel. */
function blend(colour: number, target: number, t: number): number {
  const r = (colour >> 16) & 0xff;
  const g = (colour >> 8) & 0xff;
  const b = colour & 0xff;
  const tr = (target >> 16) & 0xff;
  const tg = (target >> 8) & 0xff;
  const tb = target & 0xff;
  const nr = Math.round(r + (tr - r) * t);
  const ng = Math.round(g + (tg - g) * t);
  const nb = Math.round(b + (tb - b) * t);
  return (nr << 16) | (ng << 8) | nb;
}

/**
 * A single detailed creature, built once and re-shaped each frame from snapshot
 * fields (no per-frame geometry rebuild — only transforms, visibility, and tint).
 * Local +x is the facing direction, so rotating the container by `heading` points
 * the eyes and maw the way the creature travels (specification: render/ legibility).
 *
 * Genome → form: body size and roundness from `size`, eye size from `sense`
 * (perception made visible), a forward maw for carnivores (`diet` > ½) — a
 * non-colour role cue — and species tint on the body only.
 */
export class CreatureSprite {
  readonly view = new Container();
  private readonly crest = new Graphics();
  private readonly body = new Graphics();
  private readonly eyeL = new Graphics();
  private readonly eyeR = new Graphics();
  private readonly maw = new Graphics();

  constructor() {
    // Crest/plume: a back-and-up ornament whose prominence scales with `display`
    // (sexual selection made visible). Drawn behind the body so it reads as a fan.
    this.crest
      .poly([
        BODY_RADIUS * 0.1, -BODY_RADIUS * 0.3,
        -BODY_RADIUS * 1.2, -BODY_RADIUS * 0.6,
        -BODY_RADIUS * 0.6, -BODY_RADIUS * 1.5,
        -BODY_RADIUS * 0.2, -BODY_RADIUS * 0.7,
        -BODY_RADIUS * 0.1, -BODY_RADIUS * 1.2,
        BODY_RADIUS * 0.2, -BODY_RADIUS * 0.5,
      ])
      .fill(CREST_COLOUR);
    this.crest.visible = false;

    // Body: a unit disc, tinted per species, squashed into an ellipse per creature.
    this.body.circle(0, 0, BODY_RADIUS).fill(0xffffff);

    // Eyes: two dark discs near the front, scaled about their own centres by sense.
    for (const eye of [this.eyeL, this.eyeR]) eye.circle(0, 0, BODY_RADIUS * 0.3).fill(EYE_COLOUR);
    this.eyeL.position.set(BODY_RADIUS * 0.5, -BODY_RADIUS * 0.4);
    this.eyeR.position.set(BODY_RADIUS * 0.5, BODY_RADIUS * 0.4);

    // Maw: a forward-pointing toothy wedge, shown only for carnivores.
    this.maw
      .poly([
        BODY_RADIUS * 1.15, 0,
        BODY_RADIUS * 0.2, -BODY_RADIUS * 0.55,
        BODY_RADIUS * 0.5, 0,
        BODY_RADIUS * 0.2, BODY_RADIUS * 0.55,
      ])
      .fill(MAW_COLOUR);
    this.maw.visible = false;

    // Crest behind, then body, maw, and eyes on top.
    this.view.addChild(this.crest, this.body, this.maw, this.eyeL, this.eyeR);
  }

  /**
   * Position, orient, and shape the creature for one frame.
   * `size` is the raw size trait; `diet` and `sense` are normalised to [0, 1];
   * `energy` is the energy fraction [0, 1] (drives the starvation tell);
   * `stage` is 0 (juvenile) / 1 (adult) / 2 (elder); `pxPerUnit` maps world to screen.
   */
  update(
    screenX: number,
    screenY: number,
    heading: number,
    size: number,
    diet: number,
    sense: number,
    energy: number,
    stage: number,
    tint: number,
    pxPerUnit: number,
    pop: number,
    flash: number,
    display: number,
  ): void {
    const v = this.view;
    v.visible = true;
    v.x = screenX;
    v.y = screenY;
    v.rotation = heading;

    // Overall scale: genome size, mapped to pixels, shrunk for juveniles.
    const juvenile = stage === 0 ? 0.6 : 1;
    v.scale.set(size * juvenile * pxPerUnit * 0.4);

    // Roundness: larger creatures read fatter, carnivores a touch leaner. A `pop`
    // (eating/birth) briefly squashes wider-and-flatter then settles — game feel.
    const fat = 0.82 + size * 0.22 - diet * 0.16;
    const wobble = pop > 0 ? Math.sin(pop * Math.PI) : 0;
    this.body.scale.set(1 + 0.28 * wobble, fat * (1 - 0.16 * wobble));

    // Starvation tell: desaturate and fade the body as energy falls toward zero.
    // Static (no motion), so it is safe under reduced-motion settings.
    const starve = energy < STARVE_FROM ? (STARVE_FROM - Math.max(energy, 0)) / STARVE_FROM : 0;
    let bodyTint = starve > 0 ? blend(tint, STARVE_GREY, 0.7 * starve) : tint;
    if (flash > 0) bodyTint = blend(bodyTint, 0xffffff, Math.min(flash, 1) * 0.85); // hunt/damage flash
    this.body.tint = bodyTint;
    this.body.alpha = 1 - 0.6 * starve;

    // Eyes grow with sense radius (perception made visible).
    const eyeScale = 0.55 + sense * 1.0;
    this.eyeL.scale.set(eyeScale);
    this.eyeR.scale.set(eyeScale);

    // Maw/teeth for carnivores, growing with how carnivorous they are.
    if (diet > 0.5) {
      this.maw.visible = true;
      this.maw.scale.set(0.7 + (diet - 0.5) * 1.2);
    } else {
      this.maw.visible = false;
    }

    // Ornament crest, prominent for showy creatures, absent for plain ones.
    if (display > 0.05) {
      this.crest.visible = true;
      this.crest.scale.set(0.4 + 0.8 * display);
      this.crest.alpha = 0.5 + 0.5 * display;
    } else {
      this.crest.visible = false;
    }
  }

  hide(): void {
    this.view.visible = false;
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
