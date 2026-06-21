# UI vocabulary (shared naming)

Agreed names for the in-sim interface, so the maintainer and the agents mean the
same thing. Use these terms in prompts, commits, code comments, and class names.

## Regions

- **Toolbar** — the whole UI pinned to the **bottom** of the screen, as one
  attached unit. It contains, top to bottom:
  1. the **tab strip** (Log · Windows · Settings),
  2. the active **subsection** body, and
  3. the **bottom row**: play/pause, the speed adjuster, and the live **stats**
     (Gen · Pop · Species · Ticks). The bottom row is physically attached to the
     subsection part above it — they are not separate floating pieces.

- **World** — the area **above the toolbar** showing the live simulation, where
  events happen continually. Floating windows open over the world.

## Toolbar subsections (the three tabs)

- **Log** — by default shows the **latest 2** story messages; "maximise" opens
  the full **Story-log** window in the world.
- **Windows** — a **single row of 7 buttons**: Legend, Records, Charts, Family,
  Map, Close all, Hide UI.
- **Settings** (a.k.a. **Options**) — a **single row of 6 buttons**: Director,
  Sound, Calm, Palette, Quality, Reset.

## Floating windows (in the world)

Legend, Records, Charts, Family, Map, Inspector, Story-log, Event-detail. Sized
by the top-right header buttons:

- **Small (25%)** — a quarter: **half the width and half the height** of the
  world. Two small windows sit **side by side**.
- **Medium (50%)** — **full width, half height**.
- **Large (100%)** — the **whole world**.
- **Close (0%)** — dismiss.
