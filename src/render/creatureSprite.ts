import { Container, Graphics } from 'pixi.js';

/** Local radius of the unit creature body; world scaling is applied by the container. */
const BODY_RADIUS = 8;
/** Eye disc colour (kept constant so eyes read as eyes regardless of species tint). */
const EYE_COLOUR = 0x10151b;
/** Maw colour — a dark red that survives the colour-blind palettes (role cue, not species). */
const MAW_COLOUR = 0x3a0e0e;

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
  private readonly body = new Graphics();
  private readonly eyeL = new Graphics();
  private readonly eyeR = new Graphics();
  private readonly maw = new Graphics();

  constructor() {
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

    // Body first (behind), then maw, then eyes on top.
    this.view.addChild(this.body, this.maw, this.eyeL, this.eyeR);
  }

  /**
   * Position, orient, and shape the creature for one frame.
   * `size` is the raw size trait; `diet` and `sense` are normalised to [0, 1];
   * `stage` is 0 (juvenile) / 1 (adult) / 2 (elder); `pxPerUnit` maps world to screen.
   */
  update(
    screenX: number,
    screenY: number,
    heading: number,
    size: number,
    diet: number,
    sense: number,
    stage: number,
    tint: number,
    pxPerUnit: number,
  ): void {
    const v = this.view;
    v.visible = true;
    v.x = screenX;
    v.y = screenY;
    v.rotation = heading;

    // Overall scale: genome size, mapped to pixels, shrunk for juveniles.
    const juvenile = stage === 0 ? 0.6 : 1;
    v.scale.set(size * juvenile * pxPerUnit * 0.4);

    // Roundness: larger creatures read fatter, carnivores a touch leaner.
    this.body.scale.set(1, 0.82 + size * 0.22 - diet * 0.16);
    this.body.tint = tint;

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
  }

  hide(): void {
    this.view.visible = false;
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
