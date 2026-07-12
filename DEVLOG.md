# CluColor — devlog

A running record of what got built, what broke, and why decisions were made.
Newest day at the top. Ship date: **2026-07-22**.

**The plan lives at** `~/.claude/plans/okay-so-here-s-the-mighty-eclipse.md`.
This file is the diff against it — what actually happened.

---

## Day 4 — 2026-07-13

**Goal:** close the product loop — the ending reads a custom message, and anyone who
finishes can write their own and send it on.
**Status:** done. ⭐⭐ **The entire product exists.** Everything from here is upgrade,
not construction.

### Shipped

- **Ending** (`js/game/screens.js`): decodes the message from the URL hash, falls back to
  `DEFAULT_MESSAGE`. The message ARRIVES (a slow rise) and gets the screen to itself —
  the "send this to someone" button is held back ~3s, because putting a call-to-action
  under someone's love letter the instant it lands would cheapen it.
- **Maker** (`js/game/maker.js`): textarea + live counter + optional "from", generates the
  link, copy button, and `navigator.share` on devices that have it (hidden elsewhere, so
  there's never a button that does nothing).
- **`tests/ending.test.html` — 20 tests, all passing.**
- Clouds (previous session): blocky, drift on a wall-clock so the sky moves even when the
  player stands still. That's what stops a dead world reading as a *frozen* one.

### The tests that matter

The ending renders a string that came out of the URL — **fully attacker-controlled**.
Someone can craft `sunair.fun/#m=<payload>` and send it to a target. So:

- **5 XSS payloads** (`<img onerror>`, `<script>`, `<svg onload>`, `javascript:` href,
  iframe injection) all render as **inert literal text**. The assertion is not just "the
  text matches" — it's that **no element was ever created** from the payload.
- Malformed hash → default message. Never blank, never throws.
- **Emoji round-trips.** Kept even though the game is English-only: `btoa` rejects ANY
  character outside Latin-1, and an emoji is the strictest case (4 UTF-8 bytes AND a
  surrogate pair). Someone typing 💖 into the maker would otherwise crash the encoder.
  (Tamil tests dropped at Balaji's request — emoji covers the same code path, harder.)
- **The maker is driven for real**: type → click → read the link back → decode it. This is
  the only test that proves the WHOLE loop end to end.

### Problems hit, and the fixes

**1. The test page ran nothing, silently.** I gave it the same CSP the game ships
(`default-src 'self'`) — which **forbids inline scripts**. The other test page only works
because it has no CSP.
→ *Fix:* moved the spec into `tests/ending.test.js`, an external module. Better outcome
than weakening the CSP: **the ending is now tested under the exact policy it ships with.**
(index.html was always fine — `main.js` is external.)

**2. A test asserted the wrong string.** "The link contains no `=`" failed — because the
hash is `#m=<payload>` and **`m=` legitimately contains an equals sign**. The code was
right; the test was wrong. Now asserts against the payload, not the whole hash.

### Next

- **Day 5:** `hints.js` + the real riddle.
- Days 6-7: sliding-tile puzzle (+ BFS hint/autosolve), morse, and the 3 custom sprites.
- `DEFAULT_MESSAGE` is Balaji's line. **Do not invent copy** — the words are his.

---

## Day 3 — Sun 2026-07-12 (still day 1 by the calendar; we're ahead)

**Goal:** the game gets a beginning, middle and end.
**Status:** done. Full arc playable: title → intro → lion → house (interior) → bench → ending.

### Shipped

- **Scene/story system** (`js/game/story.js`): three GATES across one walk. Each act is a
  trigger at a position plus a gate that won't let you past until the clue is solved —
  the lion's "you may not pass what you cannot answer", as code.
- **DOM dialogue box** with typewriter (`js/game/dialogue.js`). A keypress mid-reveal
  COMPLETES the line rather than skipping it — impatience should never cost you words.
- **Title screen + character picker** (`js/game/screens.js`). Doubles as the user gesture
  that will unlock audio: browsers refuse to start an `AudioContext` without one.
- **House interior + fade-to-black cutscene** (`js/game/interior.js`, `js/engine/fade.js`).
  The second puzzle now happens INSIDE the house.
- **Real art in**: lion idol, house exterior, house interior room. All generated, keyed and
  downsampled by `tools/import.html`.
- Puzzles are still PLACEHOLDERS ("press E"). Deliberate — see the plan's risk #1.

### ⚠ The rendering change everything hinged on

**The bench drew IN FRONT of the characters** and had to, given the old design: it lived on
a canvas stacked ABOVE the world canvas, because that was the only way to exempt it from
the CSS filter that greys everything. But they have to SIT on it in act 3.

→ *Fix:* stop filtering the **canvas** and start filtering each **layer** as it is
composited, via `ctx.filter`:

```
  filtered    world buffer   (offscreen)
  UNFILTERED  bench          <- stays red in a grey world
  filtered    actors
```

One fullscreen filtered `drawImage` plus two small ones per frame — trivial at 480x270.
This gives correct z-order AND colour exemption **at the same time**, which the canvas-
stacking approach fundamentally could not. Verified both ways round in
`.shots/6-at-bench.png` (behind them) and `.shots/7-bench-in-dead-world.png` (still red).

### Problems hit, and the fixes

**1. The house dialogue was written from INSIDE but played on the doorstep.**
"Photographs. The walls are covered in them." — said while standing in a field.
→ Split into `approach` / `entering` / `inside` / `leaving`. The cutscene plays
`entering` OVER the black, which is what makes it read as a cut rather than a stutter.

**2. "The bench is visible from far away" was never true.** The sighting line fired at
`BENCH.x - 900`, but the level is 3200px wide and the view is only 480px — the bench was
nowhere near the screen. They were reacting to something invisible.
→ Threshold now DERIVED: the camera centres the player, so the bench enters view at
`playerX ≈ BENCH.x - 240`. Also **the level was too long** — 1000px of empty ground between
house and bench, ~16 seconds of nothing. Pulled in: `LEVEL_W` 3200 → 2450.

**3. A zero-length tween never resolved.** `update()` short-circuits on `duration <= 0`, so
the promise never settled and any `await` on it would hang the story forever. Guarded.

**4. `const` referenced before its declaration killed the whole module.** `TREES` reads
`CROWN_SHAPES` at module-evaluation time; I'd declared `CROWN_SHAPES` below it. The module
threw on load and rendered **nothing**, silently. Moved it up, with a note.

**5. The interior made the characters look like dolls in a warehouse.** The generated room
is drawn with a very high ceiling relative to a person.
→ *Fix:* draw the characters at **2x indoors** (`CHAR_SCALE`). Not a fudge — the room's
floorboards recede hard, so the front of the room is CLOSE to the camera and the wall is
far. At 2x they read as two people standing near you. **Must be an integer scale**: 1.5x
resamples pixel art into mush; 2x is exact nearest-neighbour.

### Art pipeline — now reusable

`tools/keyout.js` + `tools/import.html`. Every generated image so far has had **FAKE
transparency** — the tool paints the checkerboard in as real grey squares. The keying needs
all three steps or it fails:
  - **by connectivity, not colour** (the subject has its own light pixels — a stone lion is
    grey all over);
  - **handle ENCLOSED regions** a border flood-fill can't reach (between a bench's slats,
    between a lion's legs) — erase a region only if it contains BOTH checker shades, since
    a real highlight is one flat colour;
  - **erode the anti-aliased fringe**, or a pale halo survives.

Sizes are DERIVED from character scale (boy = 38px content ≈ 170cm → 1px ≈ 4.5cm):
bench 45x30, lion 52x78 (2x a person), house 175x130 (3x a person), room 480x270.

### Asset cleanup

Deleted: `assets/vendor/` (Kenney drop — packed sheets already copied to
`assets/img/tiles/`, re-download URLs are in day 1), `assets/chars/`, `assets/chars2/`, all
4 character zips, stray `.DS_Store`. Deleted `tools/chars.html` and `tools/bench.html`
(superseded by `import.html`).
Kept `assets/_raw/` — the generated originals (bench, lion, house-exterior, house-room).
They are irreplaceable and every sprite is re-derived from them.

### Known issues / next

- **House exterior sprite is in; the room's scale is still generous.** Playable, but if it
  ever bothers us, regenerate the room with an explicit scale anchor ("a standing adult's
  head should reach two-thirds up the wall").
- Photo frames in the room are drawn, not sprites — fine, they're the puzzle target.
- **Day 4:** ending message from the URL hash + the "make your own link" maker flow.

---

## Day 2 — Sun 2026-07-12 (same day; day 1 finished early)

**Goal:** real art in, lock the look.
**Status:** look is locked pending Balaji's sign-off. Walk cycles are in.

### Shipped

- Kenney packs downloaded + **CC0 verified** ("personal, educational and commercial").
  `assets/vendor/`, flattened into `assets/img/`.
- Atlas + sprite system (`js/engine/sprites.js`, `js/engine/assets.js`).
- Real world: parallax backdrop, tiled ground, dead trees, bloom (`js/game/world.js`).
- Characters with **6-frame walk cycles**, east + west (`js/game/characters.js`).
- Tooling: `tools/atlas.html` (indexed atlas), `tools/zoom.html` (tile regions),
  `tools/measure.html` (sprite content bounds), `tools/chars.html` (style check).

### ⚠ The big one: Kenney has NO boy and NO girl

The plan assumed Kenney Pixel Platformer covered characters. **It does not.** Its 27
"characters" are astronauts in space helmets, block monsters, bats, rocket ships and
treasure chests. Day 2 is exactly when this should surface — day 7 would have been a
crisis.

→ **Resolved:** Balaji supplied AI-generated boy/girl sprites, then re-exported them with
Walk animations for east + west (6 frames each). They're a matched pair, unmistakably a
boy and a girl. In-scene they read as *"detailed characters in a simple world"* — a mild
style step-up from Kenney's flat tiles, but not a pasted-in mismatch.

**Everything else in Kenney is great** and the bloom kit was already in the box:
bare trunks AND leafy canopies; bare dirt AND grass-topped ground; sunflowers, sprouts,
mushrooms. Plus — the background pack ships **a barren desert panel and a lush green
panel at identical dimensions**, so "the world comes back to life" is a cross-fade between
two panels by the same artist.

### Problems hit, and the fixes

**1. Backing store raised 320×180 → 480×270.**
A 48px character at 320×180 is >25% of screen height — Celeste-chunky, not GRIS-lonely.
At 480×270 they're ~18%, which buys the vast-empty-world feeling. Still only 130k pixels,
and it integer-scales to exactly 1920×1080 at 4×. **Day 2 was the last cheap moment** to
change this.

**2. Characters floated above the ground.** Two causes, both found by *measuring* rather
than eyeballing (`tools/measure.html`):
  - the sprites carry **transparent padding beneath the feet** (boy 8px, girl 6px), and
  - **the two exports are different sizes** — boy 56×56, girl 48×48.
→ *Fix:* anchor on the **measured feet**, not the image box:
`dy = groundY - (size - padBelow)`. Both now plant correctly regardless of frame size.
→ *Rejected:* rescaling the boy 56→48. That's a 0.857× resample of pixel art — it
destroys the crisp edges (we saw exactly that in the 24px test) and would squash him to
the girl's height. He is genuinely drawn taller (38px of content vs 33px). **If uniform
boxes are ever wanted, CROP the margin — never scale.**

**3. Ghost trees at colorLevel 0.33 / 0.66.** Fading everything by the global bloom value
made the whole world translucent at the midpoints — you could see through the trees. It
read as a rendering bug, not a season.
→ *Fix:* **the world must GROW back, not FADE back.** Every blob and plant now has its own
threshold and crosses to SOLID over a narrow window (`growth()`).
→ *And the subtle half of that fix:* `colorLevel` **rests** at 0 / 0.33 / 0.66 / 1.0, so
thresholds must sit strictly BETWEEN rest points (waves at 0.15 / 0.42 / 0.72, window
0.10). A threshold straddling a rest point leaves an object frozen half-transparent
forever. Objects now transition only *during* the tween.

**4. Ground seams / gaps / floating canopies — all from guessing tile indices.**
- Kenney's ground tiles are a **capped strip** [left-cap, mid, mid, right-cap]; tiling all
  four repeats the caps and draws a seam every 4 tiles. Use middles only.
- Shortened the tile arrays to 2 but left the index as `col & 3` → half the tiles resolved
  to `undefined` and drew **nothing**. Gaping holes in the ground.
- The foliage is a self-contained **3×3 block** (17/18/19, 37/38/39, 57/58/59). Tile 16 is
  a standalone bush and 36/56/76 a 1-wide hedge — I'd been mixing pieces of three
  different shapes, which produced a floating green box.
- A tree is a **tall trunk with 2–3 OVERLAPPING crown blobs** (confirmed from Kenney's own
  `SampleA.png`). One blob on a short trunk is a lollipop.
→ *Lesson:* `tools/zoom.html` — **look at the tiles at 12× before using them.** Every one
of these came from reading a thumbnail.

**5. Underground dirt showed a grid.** Every tile draws its own border, so a screen-wide
mass of dirt turns those borders into a lattice.
→ *Fix:* underground is **flat colour**, not tiles (`DIRT`, matched to the dirt inside
Kenney's surface tile — mismatch shows as a band at the join). Only the surface row is
tiled, because that's where the dead→alive change actually reads.

**6. Texture bleed in the tools, not the game.** Scaling the canvas context while drawing
atlas sub-rects samples neighbouring tiles' edge pixels → seams. The game draws tiles 1:1
into the fixed backing store and lets CSS upscale the whole canvas, so it cannot happen
there. Day 1's fixed-backing-store decision quietly earning its keep.

### The bench — two lessons worth keeping

**1. There is NO permissively-licensed side-view pixel bench. Anywhere.**
Kenney has none (nearest is a signpost — tile 106, a plank on two posts, is the only
bench-shaped thing in the pack). OpenGameArt has none. The side-scroller packs that come
closest (GandalfHardcore Modern City, Anokolisa Sidescroller) contain no bench *and* would
fail on licence anyway. Confirms the day-1 research.

**⚠ THE LICENCE RULE WE ALMOST MISSED: the repo is PUBLIC, so committing an asset PNG *is*
redistribution.** Most itch.io "free" packs explicitly forbid redistribution — which
silently disqualifies them no matter how good they look. Kenney's CC0 does not. **Any
future asset must permit redistribution, not merely "free to use".**

→ *Resolved:* Balaji generated a red bench. **Front-facing is CORRECT, not a mistake** — a
bench in true side profile is edge-on, and the morse carving (the entire act-3 puzzle)
would be invisible. It also matches the characters, which are three-quarter rather than
flat profile.

**2. The generated PNG's transparency was FAKE.** 0.0% transparent pixels — the tool had
*painted the transparency checkerboard into the image* as actual grey squares. Dropped in
as-is, the bench would have sat on a checkerboard tile.
→ *Fix (`tools/bench.html`), and none of the three steps is optional:*
  - **Key by CONNECTIVITY, not colour.** The bench has its own white highlight pixels;
    "erase everything white" punches holes straight through it.
  - **Border flood-fill alone is not enough.** The gap between the backrest and the seat is
    fully ENCLOSED by the slats and posts, so the fill can't reach it — a band of
    checkerboard survives inside the bench. Solved by labelling every connected
    neutral-light region and erasing any that contains BOTH checker shades (a real
    highlight is one flat colour; the checkerboard is two shades touching).
  - **Erode the fringe.** Where checkerboard met bench, the renderer anti-aliased grey into
    red, leaving pale pixels too impure to classify. Three erosion passes, removing only
    washed-out pixels already adjacent to transparency, so interior highlights survive.
→ Then cropped to content and downsampled **nearest-neighbour** (never smoothing — that
blurs pixel art) to **45×30**, derived from character scale: the boy is 38px of content ≈
170cm, so 1px ≈ 4.5cm, and a bench is ~90cm to the top of the backrest.

Committed at `assets/img/props/bench.png`. The keying is done ONCE, offline — the game
never does it at runtime.

### Known issues (deferred)

- **The bench draws in front of the characters.** It lives on the unfiltered `#fx` canvas,
  which sits above the world canvas. Fine for a waist-height bench on a flat plane — but
  they must SIT on it in act 3. Fix on day 3.
- Kenney's foliage is deliberately blocky/square. It's the artist's intent (see
  `SampleA.png`), but if Balaji dislikes it we can source a different tileset — the world
  code doesn't care.

### Open / needs Balaji

- [ ] **Sign off on the look** — `.shots/0-dead.png` → `.shots/4-alive.png`.
- [ ] Rewrite `data/dialogue.js` in your own voice. (Default ending already changed to
      *"Spring is always around the corner - Even in a grey world."*)
- [ ] Confirm the riddle answer: **memory**.

---

## Day 1 — Sun 2026-07-12

**Goal:** domain + HTTPS live, engine skeleton, prove the URL codec, draft the script.
**Status:** done, and ahead — the 24-hour HTTPS risk closed the same day.

### Shipped

| What | Where |
|---|---|
| Coming-soon page, `CNAME`, `.nojekyll` | `main` branch — live at https://sunair.fun |
| URL message codec + 23 passing tests | `js/share/encode.js`, `tools/encode.spec.js` |
| XSS mitigation (single choke point) | `js/share/render.js` |
| The colour grade | `js/game/colorGrade.js` |
| 320×180 engine: loop, input, parallax, camera | `js/engine/*`, `js/game/world.js`, `js/main.js` |
| Dev server + browser test/screenshot pipeline | `tools/serve.py`, `tests/`, `tools/shots.html` |
| Draft script | `data/dialogue.js` — **Balaji to rewrite the words** |

### Problems hit, and the fixes

**1. `git push` failed with "Can't push refs to remote / try Pull first."**
VS Code's message was misleading. The real error was `src refspec main does not match any`
— the repo had **zero commits**, so `main` didn't exist locally. The remote was also
completely empty (0 refs), so pulling would have done nothing either.
→ *Fix:* the first commit created `main`. This was also the prerequisite for GitHub
Pages, which publishes *from a branch* — so one commit unblocked both.

**2. Buying the domain on Hostinger set nothing up.**
`sunair.fun` was pointed at a Hostinger parking page. Registration ≠ hosting.
→ *Fix:* deleted Hostinger's default `A`/`CNAME`, added GitHub's four `A` records, four
`AAAA` records, and `www → balajidnz.github.io`. Verified with `dig` before writing code.
Enabled Pages via `gh api`, which **auto-detected the domain from the committed `CNAME`
file** — the payoff for committing `CNAME` rather than setting it in the UI.

**3. The 24-hour TLS cert wait didn't happen.** GitHub issued it in ~20 minutes.
`https_enforced` is now `true`. This was the plan's #4 risk (without HTTPS,
`navigator.share`, clipboard, and `AudioContext` all refuse to run) — closed on day 1.

**4. The Write tool kept converting `\uXXXX` escapes into literal characters.**
Twice. The second time it baked a literal NUL byte into `encode.spec.js`, which made
`grep` treat the file as binary and silently return nothing — a confusing five minutes.
→ *Fix:* **no escape sequences in source.** `sanitize()` filters by code point, and the
test builds control chars with `String.fromCharCode()`. This turned out better anyway:
iterating code points means the 280 cap **can't split an emoji's surrogate pair in half**,
which a naive `.slice(280)` absolutely would have.

**5. No JS runtime on the machine** (no node/deno/bun) and **no Chrome**.
→ *Fix:* didn't install one. Tests run **in a real browser** (Opera/Blink — the actual
target now) and POST results back to `tools/serve.py`, which prints pass/fail to the
terminal. Better than Node anyway: `btoa`/`TextEncoder` are *host* APIs, so the only
meaningful place to test them is an engine someone will really play in.

**6. Couldn't screenshot — macOS screen-recording permission is off.**
→ *Fix:* `tools/shots.html` renders the scene at every story beat, bakes the grade into
pixels via `ctx.filter`, and POSTs the PNGs to the dev server. Reusable all week.
Note: a **CSS filter on an element never appears in `canvas.toDataURL()`** — hence
`gradeFilter()` is exported as a *string* so tooling can re-apply it via `ctx.filter`.

### Decisions & findings

- **Target changed mid-day: she plays on a LAPTOP, and her phone is ANDROID** (not iPhone).
  This kills most of plan risk #3. The iOS trap list (audio-unlock fragility, the `100vh`
  lie, `ctx.filter` needing Safari 16.4, blend-mode bugs) leaves the critical path, and —
  crucially — **the mobile-keyboard-covering-the-input problem is gone**, which was a real
  threat to *both* typed puzzles (riddle, morse). Keyboard is now the primary input.
  Touch stays supported: she may open the link on her phone first, and every other
  recipient is a coin flip.

- **⚠ Biggest finding: saturation alone does not sell "alive."**
  At `colorLevel 1.0` the world just looks *less grey*. You cannot restore vividness that
  was never authored. Two consequences:
  1. **The bloom is not polish.** It was budgeted for day 8 and sat first on the cut list.
     Wrong. The world coming back must **add content** — grass on the cracked ground,
     leaves on the dead trees, a warm sky, flowers. That is *half the ending*. Moved up.
  2. **Kenney's bright/cheerful palette flips from liability to asset.** Plan risk #2 said
     "Kenney is cheerful, GRIS is melancholic." Inverted: the grade *manufactures* the
     melancholy for free, so we want the most vivid source art we can get.

- **The red bench works, and it's the best image in the game so far.** A second,
  unfiltered canvas (`#fx`) holds objects exempt from the grade. The bench is the one spot
  of colour in a dead world, visible from far away. ~15 lines. See `.shots/1-bench.png`.
  It was first on the cut list; it should not be.

- **Branching:** `main` = coming-soon page (published by Pages). `dev` = the game.
  Merge on the 21st. The repo is public and the Pages URL is guessable, so this is what
  stops her finding it early.

### Open / needs Balaji

- [ ] **Rewrite `data/dialogue.js`.** The structure is right; the words must be yours.
      Read it aloud with a stopwatch — if dialogue alone exceeds ~4 min, we are too long.
- [ ] **Confirm the riddle.** Draft: *"I am the weight you carry when you carry nothing.
      You set me down, and the whole world went grey. What did you lose?"* → **memory**.
- [ ] Set real names in `NAMES` (`data/dialogue.js`).

### Runbook

```bash
python3 tools/serve.py            # laptop: localhost:8000 · android: 192.168.29.237:8000
open -a Opera http://localhost:8000/                          # the game
open -a Opera http://localhost:8000/tests/encode.test.html    # codec tests
open -a Opera http://localhost:8000/tools/shots.html          # writes .shots/*.png
```

Controls: **← →** or **A/D** walk · **Space/E** interact · **H** hint.
Dev slider bottom-left drives `colorLevel` — drag it to see the whole arc.
