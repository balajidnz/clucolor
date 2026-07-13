// @ts-check
import { W } from './world.js';

/**
 * Inside the house.
 *
 * A second, tiny "scene": no scrolling, no camera. Just the room, a wall of
 * photographs whose pictures never resolve, and the one frame that has come
 * apart.
 *
 * The room is a single generated background image (480x270, exactly the backing
 * store) rather than a tileset — there is no CC0 side-view domestic interior in
 * existence. Kenney's only indoor pack is top-down; LimeZu's has what we want
 * but forbids redistribution, which a public repo cannot honour.
 */

/** Where they stand: on the floorboards, near the front — but with a little
 *  board left in front of them, so they aren't pressed against the frame edge. */
export const FLOOR_Y = 244;

/**
 * The characters are drawn at DOUBLE size indoors.
 *
 * Not a fudge — it is what the room's own perspective demands. Those floorboards
 * recede hard, so the front of the room is close to the camera and the wall is
 * far away. Drawn at their outdoor size the pair look like dolls in a warehouse;
 * at 2x they read as two people standing near you, with the room behind them.
 *
 * It must be an INTEGER scale. 1.5x resamples pixel art and turns it to mush;
 * 2x is exact nearest-neighbour and stays crisp.
 */
export const CHAR_SCALE = 2;

/**
 * The broken frame, in the bare stretch of wall the room image leaves empty.
 * This is the only part of the room the game DRAWS, because it is the only part
 * that is interactive.
 *
 * 72 = 3 x 24, and the photo is 144 = 3 x 48 — so it draws at exactly half size,
 * an integer downscale that keeps the pixels square.
 */
export const BROKEN_FRAME = { x: W / 2, y: 60, w: 72, h: 72 };

/** How the pieces sit in the wall before anyone touches them. Fixed, so the
 *  frame on the wall looks the same every time you walk in. */
const WALL_SCRAMBLE = [4, 0, 6, 2, 7, 1, 5, 3, 8];

/**
 * @param {CanvasRenderingContext2D} c
 * @param {HTMLImageElement} room
 * @param {HTMLImageElement} photo
 * @param {boolean} solved
 */
export function drawInterior(c, room, photo, solved) {
  c.drawImage(room, 0, 0);
  drawFrame(c, photo, solved);
}

/**
 * The photograph, in pieces — or whole.
 *
 * The frame on the wall shows the REAL photo, scrambled, with the bottom-right
 * piece missing. Once the puzzle is solved it shows the picture complete, so
 * walking back out of the house you pass a mended photograph on the wall.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {HTMLImageElement} photo  144x144
 * @param {boolean} solved
 */
function drawFrame(c, photo, solved) {
  const f = BROKEN_FRAME;
  const x = Math.round(f.x - f.w / 2);
  const y = Math.round(f.y);

  // Gilt moulding, so it reads as the one frame that matters.
  c.fillStyle = '#8f7119';
  c.fillRect(x - 4, y - 4, f.w + 8, f.h + 8);
  c.fillStyle = '#c9a227';
  c.fillRect(x - 3, y - 3, f.w + 6, f.h + 6);
  c.fillStyle = '#7a5f14';
  c.fillRect(x - 3, y + f.h + 1, f.w + 6, 2);

  if (solved) {
    c.drawImage(photo, x, y, f.w, f.h);
    return;
  }

  const SRC = 48; // one piece, in the photo
  const DST = 24; // one piece, on the wall

  c.fillStyle = '#241d1a';
  c.fillRect(x, y, f.w, f.h);

  WALL_SCRAMBLE.forEach((tile, slot) => {
    if (tile === 8) return; // the hole

    c.drawImage(
      photo,
      (tile % 3) * SRC, Math.floor(tile / 3) * SRC, SRC, SRC,
      x + (slot % 3) * DST, y + Math.floor(slot / 3) * DST, DST, DST,
    );
  });
}
