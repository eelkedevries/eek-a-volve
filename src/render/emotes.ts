import { Container, Graphics, Sprite, Text, TextStyle, type Renderer, type Texture } from 'pixi.js';

/** Pool sizes; overlays beyond these are simply not shown (they cap clutter anyway). */
const EMOTE_POOL = 256;
const CROWN_POOL = 192;

/** Emote kinds, by priority (scared first). 0 means "no emote". */
export const EMOTE_NONE = 0;
export const EMOTE_SCARED = 1;
export const EMOTE_AMOROUS = 2;
export const EMOTE_HUNGRY = 3;

const SCARED_COLOUR = 0xff6a6a;
const AMOROUS_COLOUR = 0xff8fc4;
const HUNGRY_COLOUR = 0xe9e2c0;
const CROWN_COLOUR = 0xffd24a;

/**
 * Pooled, constant-size overlays drawn in **screen space** above creatures
 * (specification: render/ — relatability via state). The renderer feeds screen
 * positions and a kind per creature each frame; everything is pooled, so nothing
 * allocates once warm. Kept readable by living outside the camera transform, and
 * shown by the renderer only above a zoom threshold so the swarm stays uncluttered.
 */
export class Emotes {
  readonly view = new Container();
  private readonly emoteLayer = new Container();
  private readonly crownLayer = new Container();
  private readonly emotePool: Sprite[] = [];
  private readonly crownPool: Sprite[] = [];
  private emoteCursor = 0;
  private crownCursor = 0;

  private readonly glyphScared: Texture;
  private readonly glyphAmorous: Texture;
  private readonly glyphHungry: Texture;

  constructor(renderer: Renderer) {
    const style = new TextStyle({
      fontFamily: 'system-ui, "Segoe UI", sans-serif',
      fontSize: 22,
      fontWeight: '700',
      fill: 0xffffff,
      stroke: { color: 0x10151b, width: 4 },
    });
    const glyph = (ch: string): Texture => {
      const t = new Text({ text: ch, style });
      const tex = renderer.generateTexture(t);
      t.destroy();
      return tex;
    };
    this.glyphScared = glyph('!');
    this.glyphAmorous = glyph('♥'); // ♥
    this.glyphHungry = glyph('…'); // …

    const crown = new Graphics()
      .poly([-7, 4, -7, -2, -3, 1, 0, -5, 3, 1, 7, -2, 7, 4])
      .fill(0xffffff);
    const crownTex = renderer.generateTexture(crown);
    crown.destroy();

    for (let i = 0; i < EMOTE_POOL; i++) {
      const s = new Sprite(this.glyphHungry);
      s.anchor.set(0.5);
      s.visible = false;
      this.emotePool.push(s);
      this.emoteLayer.addChild(s);
    }
    for (let i = 0; i < CROWN_POOL; i++) {
      const s = new Sprite(crownTex);
      s.anchor.set(0.5);
      s.tint = CROWN_COLOUR;
      s.visible = false;
      this.crownPool.push(s);
      this.crownLayer.addChild(s);
    }
    // Crowns under emotes, both above the world (added to the stage by the renderer).
    this.view.addChild(this.crownLayer, this.emoteLayer);
  }

  /** Start a frame: rewind the pools. */
  begin(): void {
    this.emoteCursor = 0;
    this.crownCursor = 0;
  }

  /** Show one emote of `kind` at a screen position (no-op for EMOTE_NONE / pool full). */
  showEmote(x: number, y: number, kind: number): void {
    if (kind === EMOTE_NONE || this.emoteCursor >= this.emotePool.length) return;
    const s = this.emotePool[this.emoteCursor++];
    if (kind === EMOTE_SCARED) {
      s.texture = this.glyphScared;
      s.tint = SCARED_COLOUR;
    } else if (kind === EMOTE_AMOROUS) {
      s.texture = this.glyphAmorous;
      s.tint = AMOROUS_COLOUR;
    } else {
      s.texture = this.glyphHungry;
      s.tint = HUNGRY_COLOUR;
    }
    s.x = x;
    s.y = y;
    s.visible = true;
  }

  /** Show a crown at a screen position (for elders). */
  showCrown(x: number, y: number): void {
    if (this.crownCursor >= this.crownPool.length) return;
    const s = this.crownPool[this.crownCursor++];
    s.x = x;
    s.y = y;
    s.visible = true;
  }

  /** End a frame: hide every pooled overlay not used this frame. */
  end(): void {
    for (let i = this.emoteCursor; i < this.emotePool.length; i++) this.emotePool[i].visible = false;
    for (let i = this.crownCursor; i < this.crownPool.length; i++) this.crownPool[i].visible = false;
  }

  /** Hide all overlays (used when zoomed out to the swarm haze). */
  clear(): void {
    this.begin();
    this.end();
  }
}
