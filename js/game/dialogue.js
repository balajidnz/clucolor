// @ts-check
import { safeRender } from '../share/render.js';

/**
 * The dialogue box.
 *
 * DOM, never canvas. Canvas text means reimplementing wrapping, emoji, and font
 * fallback for non-Latin scripts — a two-day hole for zero gain. The canvas
 * draws the world; the DOM draws the words.
 */

const CHARS_PER_SEC = 42;

/**
 * A click ANYWHERE advances — but not the click that opened the box in the first
 * place. The button press that dismisses a puzzle resolves a promise, and the
 * dialogue that follows can open inside the same click's dispatch; without this
 * guard, that one click would open the box and immediately eat its first line.
 */
const CLICK_GUARD_MS = 220;

/**
 * @typedef {{who: string, text: string, shows?: string}} Line
 */

/**
 * @param {HTMLElement} root the #ui layer
 * @param {{boy: string, girl: string}} names
 */
export function createDialogue(root, names) {
  const box = document.createElement('div');
  box.className = 'dialogue';
  box.hidden = true;

  const who = document.createElement('p');
  who.className = 'dialogue-who';

  const text = document.createElement('p');
  text.className = 'dialogue-text';

  /**
   * The "there is more" caret.
   *
   * A bare ▾ is the genre convention and it taught NOBODY — playtesters sat in front
   * of the first line not knowing how to continue. So the first time, it says the
   * words out loud; once they have advanced even once, they know, and it collapses
   * to the ▾ forever.
   */
  const more = document.createElement('span');
  more.className = 'dialogue-more';

  let taught = false;
  const showCaret = () => {
    more.textContent = taught ? '▾' : 'click or press any key  ▾';
    more.classList.toggle('teaching', !taught);
  };
  showCaret();

  box.append(who, text, more);

  /**
   * Skips only THIS run of lines. Not a mute — the next scene still talks. Someone
   * replaying to reach the ending shouldn't have to sit through the intro again,
   * but should still get the lion.
   */
  const skip = document.createElement('button');
  skip.className = 'dialogue-skip';
  skip.textContent = 'SKIP ▸▸';
  skip.hidden = true;

  root.append(box, skip);

  let open = false;
  let skipRun = false;
  let openedAt = 0;

  /** Completes the typewriter, or moves to the next line. Set per line. */
  /** @type {(() => void) | null} */
  let advance = null;

  /** Abandons the current line outright, mid-reveal. Set per line. */
  /** @type {(() => void) | null} */
  let abandon = null;

  /** Speaker label. 'player'/'companion' resolve against who you chose to be. */
  const label = (/** @type {string} */ speaker, /** @type {boolean} */ playerIsBoy) => {
    if (speaker === 'player') return playerIsBoy ? names.boy : names.girl;
    if (speaker === 'companion') return playerIsBoy ? names.girl : names.boy;
    if (speaker === 'lion') return 'THE LION';
    if (speaker === 'system') return '';
    return speaker;
  };

  /**
   * A modifier alone must not advance — someone reaching for Shift or holding Cmd
   * to switch tabs has not asked for the next line.
   */
  const MODIFIERS = new Set([
    'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
    'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight',
    'CapsLock', 'Tab', 'ContextMenu',
  ]);

  /**
   * ANY key advances. It used to be Space/Enter/E only — and the intro line reads
   * "Hold → to walk", so every single playtester pressed the right arrow while the
   * box was still open, and NOTHING HAPPENED. The instruction named a key the game
   * was ignoring at the exact moment it named it.
   *
   * Any-key also means the arrow they pressed advances the dialogue AND is already
   * held down when the box closes — so they start walking the instant they can,
   * which is what they were trying to do all along.
   *
   * @param {KeyboardEvent} e
   */
  const onKey = (e) => {
    if (!open) return;

    /**
     * ⚠ THE ONE THAT NEARLY SHIPPED.
     *
     * Holding a key does not fire ONE keydown — the browser auto-repeats it about
     * thirty times a second. So walking to the lion with → held down meant the
     * dialogue opened and then ate ~30 lines per second: the entire scene gone
     * before the player's thumb left the key. The story silently deleted itself.
     *
     * `e.repeat` is true for every event after the first. A held key must not
     * advance ANYTHING — you are holding it to walk, not to read.
     */
    if (e.repeat) return;

    if (e.metaKey || e.ctrlKey || e.altKey) return;   // browser shortcuts stay the browser's
    if (MODIFIERS.has(e.code)) return;

    // Defensive: a puzzle's text field should never be typing into the dialogue.
    const t = /** @type {HTMLElement | null} */ (e.target);
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

    // Escape is deliberate and explicit — it is never an accident, so it is not
    // subject to the open-guard below. Checked FIRST for exactly that reason.
    if (e.code === 'Escape') {
      e.preventDefault();
      doSkip();
      return;
    }

    // A key pressed in the same breath as the box opening is not a page turn.
    // Same reasoning as the click guard, same window.
    if (performance.now() - openedAt < CLICK_GUARD_MS) return;

    e.preventDefault();
    taught = true;
    advance?.();
  };

  /** @param {MouseEvent} e */
  const onClick = (e) => {
    if (!open) return;
    if (performance.now() - openedAt < CLICK_GUARD_MS) return;
    if (skip.contains(/** @type {Node} */ (e.target))) return; // its own handler
    taught = true;
    advance?.();
  };

  function doSkip() {
    if (!open) return;
    skipRun = true;
    abandon?.();
  }

  skip.addEventListener('click', (e) => {
    e.stopPropagation();
    doSkip();
  });

  document.addEventListener('keydown', onKey);
  document.addEventListener('click', onClick);

  return {
    get open() { return open; },

    /**
     * Play a run of lines. Resolves once the last one is dismissed — or at once,
     * if the player skips.
     *
     * @param {Line[]} lines
     * @param {boolean} playerIsBoy
     * @returns {Promise<void>}
     */
    async play(lines, playerIsBoy) {
      open = true;
      skipRun = false;
      openedAt = performance.now();
      box.hidden = false;
      skip.hidden = false;

      for (const line of lines) {
        if (skipRun) break;

        box.classList.toggle('is-system', line.who === 'system');
        safeRender(who, label(line.who, playerIsBoy));

        // Typewriter. A click mid-reveal COMPLETES the line rather than skipping
        // it — impatience should never cost you words.
        await new Promise((done) => {
          let shown = 0;
          let finished = false;
          let last = performance.now();
          let raf = 0;

          const settle = () => {
            cancelAnimationFrame(raf);
            advance = null;
            abandon = null;
            done(undefined);
          };

          const complete = () => {
            finished = true;
            cancelAnimationFrame(raf);
            safeRender(text, line.text);
            showCaret();
            more.hidden = false;
            advance = settle;
          };

          /** @param {number} now */
          const step = (now) => {
            shown += ((now - last) / 1000) * CHARS_PER_SEC;
            last = now;

            if (shown >= line.text.length) { complete(); return; }
            safeRender(text, line.text.slice(0, Math.floor(shown)));
            raf = requestAnimationFrame(step);
          };

          more.hidden = true;
          advance = () => { if (!finished) complete(); };
          abandon = settle; // skip bails out of the line, wherever it is
          raf = requestAnimationFrame(step);
        });
      }

      open = false;
      skipRun = false;
      advance = null;
      abandon = null;
      box.hidden = true;
      skip.hidden = true;
    },

    destroy() {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
      box.remove();
      skip.remove();
    },
  };
}
