# Next bot through walls

A pre-aim aid next to **Kill order**, **Crosshair guide line** and **Bots on minimap** in a
drill's pre-aim aids. The next bot in the kill order glows through walls in your enemy highlight
colour: bright edges and a faint see-through fill, like a wallhack glow. You can see where it
stands while you line up the angle you are about to clear.

- Wherever the bot is actually in view it looks normal. Only the parts a wall hides glow, so the
  aid shows you the angle but never helps the shot itself.
- It follows the kill order: after each kill the next bot glows.
- It is drawn in the 3D scene in the same frame as the bot, so it never trails behind when you
  flick.
- It is off by default in every drill, Easy drills too. **All on** turns it on with the rest.
- Like the other aids, a run with it on is unranked, except in Easy drills.

## How it works

`tools/patch-next-bot-xray.cjs` (marker `next-bot-xray-v1`) patches two game scripts:

- **`OkAdunfX.js`** adds the aid (key `nextBotXray`), records the next bot's id as
  `botOrder.nextId` when the kill order is written, and once per frame hands that id to the
  actor renderer (`$.__aimXray`).
- **`CnrSARj_.js`**, in the actor renderer (`Uf`), gives that bot's body parts an x-ray twin: a
  child mesh that shares the part's geometry and skeleton, so it follows the exact pose.
  - The twin has no depth test and draws in the opaque pass at `renderOrder` 1. It blends with
    custom blending, so it stays out of the transparent pass.
  - The real parts move to `renderOrder` 2. The map draws first (0), then the twin over it, then
    the real bot wherever its own depth test passes. Visible parts cover the glow; hidden parts
    keep it.
  - The x-rayed bot skips the behind-a-wall culling (`aim-ui/bot-visibility.mjs`), which would
    otherwise not draw it at all.
  - The twin material runs the same enemy highlight shader patch (`XO`) for `alHlColor`, then
    sets the colour and an edge-weighted alpha.

The twin costs one extra draw for one bot, and only while the aid is on.

Run `node tools/patch-next-bot-xray.cjs` to patch both copies of both files (safe to run twice),
and `node --test scripts/test-next-bot-xray.cjs` to test it.
