// @ts-check

/**
 * "You can walk now."
 *
 * The game is almost always waiting for the player to walk right — that is how
 * every beat is triggered (`story.update(playerX)` fires when they cross a gate).
 * It never said so, and playtesters got stranded twice over:
 *
 *   - after solving a puzzle, they had no idea the world was waiting for them
 *   - the intro line "Hold → to walk" appears DURING dialogue, when → does nothing
 *
 * So: whenever the player is free to move and simply isn't, say so. It appears
 * after a couple of seconds of stillness, and it leaves the instant they move.
 *
 * The rule that makes it feel like help instead of nagging: it is driven by
 * "can walk AND is not walking", never by a timer since the last event. If they
 * are moving, they do not need it, and it is gone.
 */

/** Long enough not to flash between two beats; short enough to catch a stall. */
const IDLE_SECONDS = 2.2;

/**
 * Touch walks by HOLDING the right half of the screen (see engine/input.js), which
 * is not something anybody guesses. Keyboard gets the key; touch gets the gesture.
 */
const TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches;
const TEXT = TOUCH ? 'hold the right side to walk' : 'hold  →  to walk';

/**
 * @param {HTMLElement} root
 */
export function createNudge(root) {
  const el = document.createElement('div');
  el.className = 'nudge';
  el.hidden = true;

  const arrow = document.createElement('span');
  arrow.className = 'nudge-arrow';
  arrow.textContent = '→';

  const label = document.createElement('span');
  label.textContent = TEXT;

  el.append(label, arrow);
  root.append(el);

  let idle = 0;
  let shown = false;

  const show = (/** @type {boolean} */ next) => {
    if (next === shown) return;
    shown = next;
    el.hidden = !next;
    el.classList.toggle('is-in', next);
  };

  return {
    /**
     * @param {number} dt
     * @param {boolean} canWalk  false while dialogue, a puzzle, a cutscene or the
     *                           ending owns the screen — nudging then would be a lie
     * @param {boolean} moving
     */
    update(dt, canWalk, moving) {
      if (!canWalk || moving) {
        idle = 0;
        show(false);
        return;
      }
      idle += dt;
      show(idle >= IDLE_SECONDS);
    },

    destroy() {
      el.remove();
    },
  };
}
