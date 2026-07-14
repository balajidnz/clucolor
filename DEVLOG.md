# CluColor — devlog

A running record of what got built, what broke, and why decisions were made.
Newest day at the top. Ship date: **2026-07-22**.

**The plan lives at** `~/.claude/plans/okay-so-here-s-the-mighty-eclipse.md`.
This file is the diff against it — what actually happened.

## Where we are

**⭐ SHIPPED AND LIVE.** All three puzzles are real, the music plays, and the game is
deployed on the real domain. Nothing is a placeholder.

| | |
|---|---|
| **The game** | **`https://sunair.fun/clucolor/`** — live, HTTPS, **unlisted** |
| **The portal** | `https://sunair.fun` — live. Shows "Soon." CluColor is commented out until the 21st. |
| Playable | logo → picker → intro → lion (**riddle**) → house (**sliding photo**) → bench (**morse**) → ending → maker → shareable link |
| Tests | encode 28 · ending 27 · riddle 41 · dialogue 14 · slider 25 · morse 30 = **165** |
| Music | ✅ four layers, phase-locked, 1.2MB. Grows as the world does. |
| Dialogue | ✅ Balaji rewrote it. The words are his. |
| Left | **playtest feedback** · day 10 freeze + `og:image` |

**Publishing on the 21st is deleting two `<!--` markers** in the portal's `index.html`.
The "Soon." line removes itself (`.games:has(.game) ~ .soon`), so there is no second edit
to forget and no way to ship a live game with "Soon." still sitting under it.

**Waiting on Balaji:**
- [x] ~~Rewrite `data/dialogue.js`~~ — done. The words are his.
- [x] ~~The music~~ — done (day 8).
- [ ] **Playtest feedback** — three people tested it. Tuning pending.

## Audio — the ORIGINAL SPEC (kept for the record). ⚠ SUPERSEDED BY DAY 8.

**Read day 8 for what actually shipped.** Two things below turned out wrong in practice:
the loop is **8 seconds, not 60-120** (his files were already 8s loops repeated), and the
"identical length / same session" requirement was satisfied by *cutting one cycle from each*
rather than by re-exporting. The `.ogg` → `.m4a` correction below still stands and matters.
The **ending cue is still outstanding** and would still be worth having.

**Layered, not one track.** Each puzzle solved unlocks an element — his idea, and it is the
standard way adaptive game music works (*vertical remixing*).

**STEMS, not before/after mixes.** All stems start at the SAME instant; locked ones sit at
gain 0. Unlocking ramps a gain up. Because they started together and share a length they are
**phase-locked forever** — a layer can arrive mid-bar, in time. Crossfading two full mixes
instead would double shared instruments against each other, could only switch at a loop
boundary (so the music would change up to 30s AFTER she solves it), and costs ~4x the
download.

**⚠ FORMAT — I GOT THIS WRONG FIRST TIME.** I said `.ogg`. **Safari cannot decode Ogg Vorbis
via `decodeAudioData`** — and that is precisely the API the stems design needs. (Safari 18.4
added Ogg for `<audio>` elements, but NOT for Web Audio.) The music would be silent on every
Mac and iPhone, and the whole point is that the link gets forwarded.

→ **Ship AAC in `.m4a`.** It is the one compressed format `decodeAudioData` handles in Safari,
Chrome, Firefox and Edge alike.

→ **Balaji sends WAV masters. I convert.** Not for convenience:
   - **All four must be encoded with IDENTICAL settings** or they can drift apart, and the
     entire design rests on them being phase-locked.
   - AAC adds ~2000 samples of priming silence. Harmless BETWEEN stems (they all get the same
     padding, so they stay in sync with each other) but it puts a **click at the loop point**.
     Fixed by setting `loopStart`/`loopEnd` from the WAV's **exact sample count** — which
     requires having the WAV.
   - macOS ships `afconvert`; no install needed.
   - **Never SHIP wav**: ~10MB/minute, so four 90s stems ≈ 60MB. She is opening a link.

**Other requirements:** identical length to the sample · same BPM/key · exported from one
session · each loops seamlessly on its own.
Four stems: `bed` (from the start) → `+lion` (0.33) → `+photo` (0.66) → `+morse` (1.0).

**ONE LOOP, 60-120 SECONDS. Not a long linear piece.** (Asked 2026-07-13.)
- **Playtime is variable** (~5-9 min). A 15-minute track means she hears a third of it if she
  is quick — and it RUNS OUT and goes silent if she lingers.
- **Size.** Stems must be the same length, so 15 minutes means *four* × 15 = an hour of audio,
  ~30MB+. She is opening a link. A 90s loop × 4 stems is ~3MB and loads behind the title.
- **And it is unnecessary: the stems ARE the composition.** The arc is carried by the
  ARRANGEMENT changing with the story, not by a melody moving through time — and it changes
  *when she solves something*, which a fixed timeline can never do.
- The real constraint: it must survive **five or six repeats without irritating.** Sparse. No
  hook that demands attention. It is the room, not the song.

**Plus a separate ENDING CUE (5th file, NOT looping, 30-60s)** for the final message. The
loop has to be self-effacing; the ending does not. It plays once, while she is reading his
words, so it can be as direct as he likes.

**And a lowpass on the master, driven by `colorLevel`** (~350Hz → ~18kHz). The stems control
*what plays*; the filter controls *how present it feels*. The bed alone through a nearly-shut
lowpass sounds **remembered rather than heard**. ~20 lines, same `colorLevel` that drives
everything else.

**All four stems must be started in the title-screen click** — browsers refuse to start an
`AudioContext` without a user gesture, and if they are not started together they will never
be in sync.

---

## Day 9 — 2026-07-14 — polish, and the deploy

The day the thing became a URL you can send to someone.

### Shipped

| | |
|---|---|
| Repo hygiene | deleted `tools/watermark.html`, `measure.html`, `audio.html` — one-off instruments whose findings are now baked into the code. Kept the ones that *regenerate* assets. |
| `README.md` | Kenney credited (CC0). Music credited to Balaji **as his own composition, not AI-generated**. The redistribution rule written down. |
| UI | maker collapsed to one box · **loading screen** · logo → press-to-start → picker · "again" at the ending |
| Art | `assets/img/logo.png` (Balaji's, keyed) · `favicon.png` built from the bench sprite |
| **Deploy** | **two repos, real domain, HTTPS enforced** |
| Portal | flat-poster design: sand, a hard sun, a two-tone wave |

### ⚠ The loading screen was not polish. It was a bug.

The page was **blank black** while ~1.5MB of images and audio loaded. Not "briefly" —
long enough that a stranger opening the link would conclude it was broken and close the tab.

The cause was boot order: nothing was mounted until after `await Promise.all([...])` had
resolved. The fix is one line moved — `showLoading()` now mounts **before** a single asset
is fetched, and `loading.done()` fires after.

**This is the single most valuable thing found this week**, and it was found by opening the
game on a cold cache instead of a warm one. Every test we had passed. It would have shipped.

### The favicon is the bench

Not a logo, not a letter — the **red bench**, composited on a grey field. It's the one object
exempt from the desaturation grade, so the tab icon is literally the thesis of the game in
16 pixels: one spot of colour in a dead world.

### ⚠ Three bugs in `tools/keyout.js`, all from assuming instead of measuring

The keyer worked on the bench and then silently failed on the logo — Balaji: *"i dont think
it was keyed out."* Three separate causes, and the shape of all three is the same:

| bug | what I'd assumed | what was true |
|---|---|---|
| checker shades **hardcoded** (205 / 254, floor `r > 180`) | the generator uses one checkerboard | the logo's were **125 / 193** — the dark square was *below the floor*, so nothing matched and nothing was erased |
| **two separate tolerance windows** | AA pixels land inside one of them | the renderer anti-aliases the two squares *into each other*, so edge pixels land in the **gap between** the windows, are classified as neither, and survive as a pale halo |
| `GREY_TOL = 14` | the checkerboard is neutral | the generator's output has a **warm cast** — AA pixels come out `rgb(160,160,144)`, differ by 16–32, and fail the neutrality test |

Fixes: **learn** the two shades from the border ring (which is checkerboard *by definition*),
make the tolerance band **continuous** from the floor upward, and loosen `GREY_TOL` to **30**
— safe, because the subjects are blue/orange/red with channels 150+ apart. Nothing genuinely
coloured comes close.

There is also **no upper bound** any more: the generator stamps a near-white sparkle
watermark (~240) that sits above any ceiling derived from the checker shades, so a ceiling
leaves it behind as a ghost in the corner.

### ⚠ The logo is NOT pixel art

Balaji's background-removed version has **anti-aliased edges** — run lengths of 2,3,4,5…
instead of clean multiples. The pixel grid is gone.

So it must **only ever be scaled DOWN**. It's capped below its native 584×130
(`width: min(560px, 74vw)`) with **no `image-rendering: pixelated`** — that property on
anti-aliased artwork shows ragged alpha, not clean blocks. Upscaling it would look broken.

### The deploy: two repos

Balaji wants `sunair.fun` to be a neal.fun-style portal, so the game moved to a subpath.

| repo | serves | holds CNAME |
|---|---|---|
| `balajidnz.github.io` | `sunair.fun` | **yes — only this one may** |
| `clucolor` (was `SunAir`) | `sunair.fun/clucolor/` | no |

This works because a GitHub **user site** with a custom domain lends that domain to every
project repo on the account, at a path matching the repo name. **The repo name IS the URL
and URLs are case-sensitive** — hence lowercase `clucolor`, not `CluColor`.

Verified before deploying: **no absolute paths anywhere**, so every asset resolves at the
subpath, and `buildLink()` uses `location.origin + location.pathname` — so shared links
correctly carry `/clucolor/`.

### ⚠ Three things broke during the deploy. None were in the game.

**1. `~/Desktop` is a git repository.** It has a `.git`, no remote, and had zero commits.
`sunair-portal` had no `.git` of its own — so my check "is the portal a repo?" walked **up**
and answered *yes, about the Desktop*. The deploy script's `git add -A` then staged the
entire Desktop and committed it, including a gitlink to `Project X`.

Nothing was pushed (no remote). Undone with `update-ref -d HEAD`. **The lesson is in the
fix**: the script now *asserts* `git rev-parse --show-toplevel` equals the directory it
means to be in, and refuses to run otherwise. `git add -A` in a non-repo folder is not an
error — it silently targets the parent.

**2. GitHub commits to your repo behind your back.** Releasing the custom domain via the
API made **GitHub itself push a `Delete CNAME` commit to `origin/main`**. Local `main` had
deleted the same file. Two histories, same change, diverged → push rejected. VS Code renders
this as the unhelpful *"can't sync"* — which is the exact same misleading message this whole
project opened with on day 1, and again the message was pointing at the wrong thing.

**3. Pages is auto-enabled on a `*.github.io` repo.** `POST /pages` returned **409** the
instant the repo existed, and `set -e` killed the script mid-deploy.

**The real lesson: a deploy script must be idempotent, not a one-shot.** Rewritten so every
step checks whether it's already done and skips. Re-running it is now always safe — which is
what you want at 2am on the 21st, not a script that only works if nothing has ever gone wrong.

### The domain move has a TLS tail — which is why it was done on day 9, not day 21

Moving a custom domain between repos makes GitHub **re-verify DNS and re-issue the
certificate**. Until that lands, the site is HTTP-only — and `AudioContext`,
`clipboard.writeText` and `navigator.share` **all refuse to run without a secure context**.
On plain HTTP the music is silent and the share button is dead, and the game looks broken
rather than insecure.

It resolved in minutes. It is documented to take **up to 24 hours**. Doing this on the
morning of the 21st would have been a genuine way to lose the gift.

### Unlisted, and actually verified

The game is live but not linked. Two independent mechanisms:

- the game's `index.html` carries `noindex, nofollow` → search engines won't index it
- the portal doesn't link it → **crawlers have no path to it at all**

Checked by *parsing* the deployed portal's HTML rather than grepping it — `grep` matched the
commented-out block and reported a false alarm. An actual HTML parser confirms the live page
exposes **zero `<a>` elements**. A comment is not a link.

### The portal design

Balaji: *"more fun and minimalist, a sunny beach morning."* Three variants built and served
side by side; he picked the **poster**.

Flat sand, one hard yellow circle, chunky rounded type, hard-offset shadows. On hover a card
**presses into** its shadow — it travels exactly as far as the shadow shrinks, so it reads as
a physical button rather than a rectangle sliding around.

- **The blue is the ink, not a thing.** `--ink: #1b3a4b` — a deep sea-blue instead of black,
  so every border and letter carries a blue undertone without anything being *the blue bit*.
- **The wave is an inline SVG data-URI.** A wave built from `border-radius` always ends up
  looking like what it is: a stack of ellipses. `preserveAspectRatio: none` +
  `background-size: 100% 100%` stretches one 1440-wide path edge-to-edge at any viewport
  width — no tiling, no seam, no gap on an ultrawide.
- **No web fonts.** The portal's CSP is `default-src 'self'`, which blocks Google Fonts
  outright. `ui-rounded` resolves to SF Rounded on Apple and degrades to a friendly system
  sans elsewhere. Zero network requests.

Footer: `made by Rico 🧸`.

### Next

**The playtest is the only thing left that can still change the game.** Three people have
played it. What matters is not their suggestions but *where they stalled* — the hint clock
auto-solves at 120s, and the plan has flagged that as too generous since day 1.

## Day 8 — 2026-07-14

**Goal:** the music.
**Status:** done. Four layers, played TOGETHER, phase-locked. 1.2MB shipped.

### What it does

Every stem is the same **8.000-second loop**, so all four sources start at the same instant
and loop the same window — **phase-locked forever**. Solving a clue does not swap the music;
it **adds** to it. By the ending all four are playing at once.

On top, a **lowpass driven by `colorLevel`** (620Hz → 20kHz, exponential — the ear hears
brightness that way). In the dead world the filter is nearly shut and the music sounds
*remembered rather than heard*. Every clue opens it. Same number that drives the picture.

Plus: a limiter (four layers summing can clip at the exact moment the world blooms), and a
mute button that is always on screen.

### ⚠ I misread Balaji's files TWICE. He corrected me both times.

**First:** the four files were 66.009 / 65.881 / 64.769 / 66.988s — different lengths. I said
they could never be layered.
**Then:** the loudness profile (RMS 0.072 / 0.065 / 0.036 / **0.224**) didn't stack
monotonically, so I said they were four complete tracks, not stems. **Bad inference** — real
stems are individual instruments and would look exactly like that.

**What they actually are:** each file is the **same 8.000s loop repeated**, sample-for-sample.
Autocorrelation **1.0000 at exactly 8.000s** — not "similar", *identical samples*. The 66s
lengths were just different numbers of repeats and never mattered at all.

→ Cut one cycle from each → four files of identical length → true layering works.

**Lesson: when the person who MADE the thing tells you what it is, believe them and go and
measure it.** He said "each is a 2-4 second loop recorded for 60+ seconds". He was right (8s,
not 2-4) and I had twice concluded the opposite from summary statistics.

### The trap that measurement caught

**AAC decoding adds ~2,751 frames (57ms) of priming silence.** Loop the whole buffer and that
silence lands in the music **every 8 seconds** — a stutter you would blame on the composition.

→ Each file now holds the loop **twice**, and we loop a window inside it. Any 8-second window
of a periodic signal is itself a seamless loop; the padding is never inside it; and taking the
same window from all four keeps their phase.

Verified empirically before trusting it (`tools/audio.html`): all four decode to *exactly*
386,751 frames, identical, so they can never drift.

### The alignment: MEASURED, not tuned by ear

Balaji: *"the photo one is off and doesn't match the music."* He was right, and I could not
find it by ear or by guessing.

He supplied a **reference mix** of all four layered correctly. Each stem is ADDITIVELY present
in it, so an **FFT cross-correlation** of stem-against-reference spikes at the exact alignment:

| stem | offset | corr | predicted if it's a straight sum |
|---|---|---|---|
| 0-dead | 4.7514s | 0.284 | 0.293 |
| 1-lion | 4.7107s | 0.270 | 0.264 |
| 2-photo | 5.7919s | 0.145 | 0.147 |
| 3-alive | 1.8010s | 0.911 | 0.907 |

Every correlation lands within a hair of what you'd predict **if the reference were these four
summed at equal gain** — which proves both the offsets AND that **the correct gains are all
1.0**. The photo layer sounded "too loud" because I had *boosted* it to 1.35; it and the lion
sounded "off" because they were rotated wrong, and **a phase clash reads as harshness, which
is easy to mistake for volume.**

**Then reconstructed the mix from the stems to be sure:**

```
all aligned at their own file start   ->  0.014   (not his mix at all)
measured offsets                      ->  0.999   (IS his mix)
```

Balaji's instinct was that they should all "start together". He was right *musically* — but
each file has a **different lead-in before the loop actually begins**, so starting them at the
same timestamp aligns the FILES, not the MUSIC. The offsets are what "starting together"
actually means.

**And a method lesson:** my first search scanned rotations at **20ms steps**. Useless — at
audio frequencies, being 10ms out destroys correlation, so it stepped straight over every
peak and returned confident nonsense (0.068 / 0.097 / 0.124). **Correlating raw audio needs
sample resolution: FFT, not a for-loop over coarse lags.**

### Files

`assets/audio/*.m4a` — 1.2MB total. **AAC, not Ogg**: Safari cannot `decodeAudioData` Ogg
Vorbis, which is the API the layering needs, so Ogg would have been silent on every Mac and
iPhone. WAV masters are gitignored (49MB); the derived 8s loops are in `assets/_raw/loops/`.

---

## Day 7 — 2026-07-13

**Goal:** the morse carving. The last placeholder.
**Status:** done. 30 tests. **⭐ The game has no placeholders left.**

### Shipped

- `data/morse.js` — the alphabet, the answer, and the carving.
- `js/game/puzzles/morse.js` — act 3, for real.
- `tests/morse.test.html` — 30 tests.

### The bug this puzzle was one careless edit away from

**The bench saying one thing while the game expects another.**

If the carving (`.. / .-.. --- ...- . / -.-- --- ..-`) and the answer (`I LOVE YOU`) were two
separate strings, someone edits one, forgets the other, and **the puzzle becomes literally
impossible** — no error, no warning, and no way for her to know she is right. It would be
discovered by the one person it must not be discovered by.

→ **The carving is DERIVED from the answer.** One source of truth; they cannot drift.
The tests assert it: the marks spell exactly what the game expects, every mark is the correct
morse for its letter, and no letter of the answer is missing from the alphabet.

### Two things that make it a moment rather than a text box

**1. The letters light up ON THE CARVING as she types.** Wired to `input`, not to a submit
button. She types "I", and two scratches on a bench light up. Ten lines of code. There is no
submit button at all — when the last letter lands, it is simply done.

**2. The companion produces the A-Z chart.** Non-negotiable, and tested. Nobody should have to
leave the game and search the web to finish a birthday present. It arrives at hint level 1,
and it can be asked for immediately.

### Morse follows the SLIDER's rule, not the riddle's

`clockCeiling: 3` — the clock gives her the chart and every word of help, **but will not
decode it for her.**

Once she has the chart, morse is **mechanical**: she is actively working through it, exactly
like the sliding puzzle, and finishing it mid-decode takes the thing out of her hands. The
riddle is the odd one out — without the word, no amount of effort gets you there, so a timed
rescue is a genuine rescue.

| puzzle | the clock may… | because |
|---|---|---|
| riddle | **solve it** | stuck is stuck; effort does not help |
| slider | only **talk** | she is progressing; being shown the piece IS being given it |
| morse | talk + **give the chart** | mechanical once she has the chart |

All three still hand over completely **if she asks**.

---

## Day 6 — 2026-07-13

**Goal:** the sliding-tile puzzle. Plus two corrections from Balaji, both right.
**Status:** done. Two of three puzzles are real.
**All suites:** encode 28 · ending 27 · riddle 41 · dialogue 14 · slider 25.

### Shipped

- `js/game/puzzles/eight.js` — the 8-puzzle model + the search.
- `js/game/puzzles/slider.js` — DOM board, 3x3, over Balaji's ice-cream photo.
- `tests/slider.test.html` — 19 tests.
- The frame on the wall now shows the **real photograph, in pieces, with one missing** —
  and stays **mended** once you have mended it, so you walk back out past a whole photo.

### Two things that look like over-engineering and are not

**1. Shuffle by random LEGAL MOVES, never a random permutation.**
Exactly **half of all 9! arrangements of an 8-puzzle are UNSOLVABLE.** Shuffle the array and
there is a coin-flip chance you hand the player a board that cannot be finished — and no
hint saves her, because the auto-solve would loop too. She would slide tiles forever.
*The test doesn't just assert we avoid it — it DEMONSTRATES the danger*: a naive shuffle
came back unsolvable ~half the time, exactly as the maths says.

**2. BFS the ENTIRE state space, once.**
Only **181,440** states are reachable, so we walk backwards from the solved picture and
record every state's exact distance from the goal. That one table gives a **perfect hint**
("move this piece, now") and a **perfect auto-solve** (walk downhill) — both optimal, both
free. Best value-per-line in the project. Built during asset load, never during a click.

**The test that proves the search is correct:** the hardest board is exactly **31 moves**
from solved. That is the 8-puzzle's known diameter. If the search were wrong, that number
would be wrong.

### ⚠ The day-5 guard caught a bug that had been there since day 1

```
bad walk frame: i=-1  t=-0.0073  frames=6
```

**`dt` was going NEGATIVE.** A `requestAnimationFrame` timestamp is the time the frame
*began*, which can be EARLIER than the `performance.now()` captured just before calling
`requestAnimationFrame`. So the first `dt` of the game is often slightly negative.

Harmless until something integrated time. Then: the animation clock reaches `-0.007`,
`Math.floor(-0.007 * 11) % 6` is **-1**, `walk[-1]` is `undefined`, and it explodes far
away inside `drawImage` with an inscrutable "value is not of type HTMLImageElement".

→ *Fix:* clamp `dt` at **both** ends in `loop.js`. The upper clamp (alt-tab) was always
there; the lower one was not.
→ *And the lesson:* the guard in `frameFor()` — added on day 5 purely because a NaN index
would be hard to diagnose — is the only reason this took two minutes instead of an hour.
**Guard the index where it is computed, not where it explodes.**

### The watermark

Gemini stamps a sparkle into every image and **no prompt suppresses it**. On the
transparent-background sprites the keyer happened to eat it; on an opaque photograph it
survives. It had to go: the bottom-right tile is the one removed as the slider's blank, and
it **fills back in on solve** — so the watermark would have reappeared at the exact moment
of the reveal.

- **Clone-patching FAILED.** The bench is a narrow diagonal strip in that corner, so there
  is no clean patch of bench to copy from — copying from above pasted *grass* into the
  middle of the bench.
- **Inpainting worked** (`inpaintSparkle` in `tools/keyout.js`): mask the sparkle's own
  pixels (pale and desaturated, against a saturated red bench — the gap is the detector),
  then grow the surrounding pixels inward one ring at a time. **Copy colours, never average
  them** — averaging invents colours outside the palette and pixel art stops being pixel
  art. 17 passes, nothing left over, stripes intact.

### ⚠ The clock must not solve a puzzle you are ACTIVELY SOLVING (Balaji's call)

Day 5 built one rule for all three puzzles: the clock escalates to an auto-solve at 120s.
**That is wrong for the sliding puzzle, and Balaji caught it.**

The two puzzles are different in kind:
- **The riddle is know-it-or-you-don't.** Stuck at two minutes means genuinely stuck, and
  solving it for her is a **rescue**.
- **The sliding puzzle is a task she is actively progressing on.** Having the game finish it
  while she is mid-move is not a rescue — **it takes the thing out of her hands.**

And then a sharper version of the same point, also his: **being SHOWN the answer is being
GIVEN the answer.** A highlighted piece ends the puzzle just as surely as sliding it would.

→ *Fix:* `clockCeiling` on the hint controller — the highest level the CLOCK may reach on
its own. **Asking always goes further.**
- riddle: default (the clock may go all the way, including the auto-solve)
- slider: **`clockCeiling: 1`** — the clock may only ever TALK. Pointing at a piece (level 2-3)
  and doing it for her (level 4) are **ASK-ONLY**.

Tested: ten minutes of sitting on the sliding puzzle produces words and nothing else; asking
once starts the pointing; asking on gets it solved.

The hint ladder had to be re-ordered to match — the clock's last line used to be *"Here —
let me. I think I've done this before."*, i.e. she'd offer to take over and then not.

### The link was too long (Balaji) — and "encryption" was the wrong tool

**Encryption does not shorten anything.** Ciphertext is at least as long as plaintext,
usually longer. And it is not needed: **the fragment after `#` is never sent to the server**,
so the message already never touches anyone's logs (day-1 decision).

What actually shortens a link:

**1. Drop JSON.** `{"v":1,"msg":"..."}` spends ~15 bytes on pure punctuation, and base64
taxes every byte by 4/3 — so **~20 characters of every link were syntax**. The format is now
one version byte + the fields, separated by `0x1f`.

**2. Compress — but ONLY when it wins.** Below ~100 characters, deflate's own overhead makes
the result LONGER. So: compress, compare, keep whichever is shorter. The version byte says
which. (The plan had this on the cut list. It earns its place on long messages.)

| message | before | after |
|---|---|---|
| 17 chars | 66 | **46** |
| 54 chars | 116 | **96** |
| ~290 chars | ~420 | **~260** |

**The floor is information-theoretic.** A 54-char message is 54 bytes; base64 makes it 72,
plus 22 for `https://sunair.fun/#m=`. Nothing gets under that. The only way shorter is a
shorter message.

**Security note:** the field separator is a CONTROL CHARACTER, and `sanitize()` strips
control characters. That is precisely what makes it safe as a separator — otherwise a message
containing one could **forge extra fields** on the far side. There is a test for that.

**Cost:** `encode`/`decode` are now **async** (`CompressionStream` is a streaming API), which
rippled into `showEnding`, the maker's click handler, and boot. All awaited, all tested.

*A measurement lesson:* my first benchmark said deflate saved 95% on every message — because
I tested with `"x" * 280`, which compresses to nothing and is nothing like real writing. And
my second was worse: I built two separate compressor objects and took `.compress()` from one
and `.flush()` from the other, so it measured an **empty stream** and printed the same number
for every input. **A benchmark that reports the same figure for wildly different inputs is
broken, not impressive.**

---

## Day 5 — 2026-07-13

**Goal:** the escalating-hint system, and the first real puzzle.
**Status:** done. The lion's riddle is real. 41 tests, all passing.

### Shipped

- **`js/game/hints.js`** — one controller, will drive all three puzzles.
- **`js/game/puzzles/answers.js`** — normalisation + fuzzy matching.
- **`js/game/puzzles/riddle.js`** — act 1, for real.
- **`tests/riddle.test.html`** — 41 tests.
- Balaji's riddle replaces mine (his is better — it is about memory without ever
  naming it, and "lost without ever being stolen" *is* the story). Answer: **memory**.
- **Dialogue: click ANYWHERE to advance**, plus a retro **SKIP ▸▸** (and Escape).
- **Custom names in the link.** Defaults stay `boy`/`girl`.
- Fixed two lines of dialogue that described a colorLevel that wasn't on screen.

### The hint system IS the pacing system

Not a safety net bolted on the side. A riddle + a sliding puzzle + a morse decode, played
honestly, is 12-18 minutes. **The clock is the only thing that makes this a 7-minute game.**
It escalates on whichever comes first:

1. time on the puzzle (20s / 45s / 70s / 95s / 120s),
2. two wrong answers at a level,
3. **the player asking** — same code path, but it was *her choice*. That turns a
   condescending system into an act of agency: you turn to the person beside you and ask.

**The clock PAUSES while dialogue is open.** Never hint-nag someone for reading.

**Deliberately cumulative, not idle-reset.** An idle timer that resets on every keystroke
means someone typing slowly forever never reaches the ceiling — and the ceiling is the
whole point.

> **⚠ TWO CLAIMS HERE WERE LATER PROVED WRONG. See day 6.**
>
> 1. *"120s = auto-solve, on every puzzle."* **No.** The clock may only auto-solve the
>    RIDDLE. On the sliding puzzle the clock may only **talk** (`clockCeiling`).
> 2. *"There is no skip button."* There is now — but only for **dialogue**, and it skips
>    only the current run. No puzzle has one.

### Dialogue: click anywhere, and a skip

Two asks from Balaji, both right:

- **Click anywhere advances.** Having to hit the box exactly is a small, constant tax.
- **A retro SKIP, top-right.** It skips **only the current run of lines** — the next scene
  still talks. Someone replaying to reach the ending shouldn't sit through the intro again,
  but should still get the lion.

**The hazard in "click anywhere":** the button that dismisses a puzzle resolves a promise,
and the dialogue that follows can open **inside that same click's dispatch** — so one click
would open the box AND instantly eat its first line. A 220ms guard, and a test that proves
it. (`tests/dialogue.test.html`, 14 tests.)

*A test-writing lesson from that suite:* the first version asserted on a 3-letter line,
which finishes typing in 70ms — long before the guard expires — so the click advanced PAST
it and tested nothing. Then a longer line was still flaky, because **a background tab
throttles setTimeout** and the typewriter raced the test's own clock. **A test that depends
on wall-clock timing fails at random.** Fixed with a line long enough that no throttling can
finish it.

### Custom names, carried in the link

Defaults are `boy` / `girl`. The maker has two optional fields whose **placeholders ARE the
defaults**, so leaving them blank is a choice rather than an omission.

Three things this needed, because names come out of the URL and are therefore just as
attacker-controlled as the message:
- **Blank names are DROPPED, not carried as empty strings** — an empty name would blank out
  a speaker tag on the far side, and a nameless speaker reads as a bug.
- **Capped at 24 chars, no newlines.** A name is one line.
- **Same `safeRender` path as everything else.** A name containing `<img onerror=…>` renders
  as literal text. Tested.

Defaults are lowercase (`boy`, not `BOY`) — CSS uppercases the speaker tag anyway, and it
makes the hint button read *"ask girl again"* rather than *"ask GIRL again"*.

### ⚠ Dialogue that described a colorLevel which wasn't on screen

Both bugs were the same bug: the lines were written before we knew what each colour level
would actually LOOK like. Balaji caught both by playing it.

- **After the lion, `colorLevel` is 0.33 — the sky is still 33% saturated, i.e. still GREY.**
  The line was *"The sky. Look at the sky."* It pointed at the one thing that had **not**
  changed. What HAS changed at 0.33 is growth wave 0: **the first leaves on every tree.**
  Now it points at that.
- **When the bench comes into view, the house is solved and `colorLevel` is 0.66 — colour is
  MOSTLY back.** So *"the only thing in this world that isn't grey"* is a statement the
  player can SEE is false. The beat is now **recognition, not contrast**: *"It never stopped
  being red, did it." / "...I know it." / "So do I."*

**Lesson:** check what is actually rendered at a given state before writing a line that
points at it. `python3` + the growth-wave table took ten seconds and settled both.

### ⚠ The bug that would have broken the gift

The answer matcher rejected **"meomry"**.

Plain Levenshtein scores a **transposition as TWO edits**, so a swap of two adjacent
letters failed the `<= 1` tolerance — and transposing two letters is the single most common
typing mistake there is. She types the right answer, the game says no, and she has no way
to tell whether she is wrong or merely mistyped.

→ *Fix:* **Damerau-Levenshtein** (optimal string alignment), which counts an adjacent swap
as one edit. Needs three rows rather than two, because a transposition looks back two cells
diagonally. `"money"` is still correctly rejected.

The test caught it. That is exactly the class of bug that silently ruins the whole gift.

### The matcher, generally

The difficulty of a text riddle is never "is the answer right" — she knows the answer in
seconds. It is **"does the game ACCEPT what she typed"**. So: lowercase, strip accents,
strip punctuation, collapse whitespace, drop a leading article (`the memory` → `memory`),
then exact-match **plus one edit**. Typo tolerance only applies to words of 5+ letters,
where a one-character slip is unambiguous.

Accepted in tests: `Memory`, `MEMORY`, `memory.`, `"memory"`, `memories`, `my memory`,
`our memories`, `meomry`, `memry`, `memmory`, `memorie`, `mémory`.
Rejected: `love`, `time`, `hope`, `money`, `nothing`, empty.

**The lion never says "wrong."** It says something in character. A red X tells her she
failed; a line of the lion's contempt tells her to keep going. At 1am on a birthday those
are not the same thing.

### Next

- **Day 6:** sliding-tile puzzle. 3x3 (NOT 4x4 — a 15-puzzle is a 5-minute slog that would
  wreck the pacing). Shuffle by applying random LEGAL MOVES, never a random permutation —
  half of all 8-puzzle permutations are unsolvable. BFS the whole 181,440-state space once
  at load for a perfect hint and a perfect auto-solve.
- Day 7: morse + the photo-frame sprites.

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
  > **⚠ SUPERSEDED ON DAY 9.** `main` is now the game and it deploys on every push. What
  > keeps it hidden is no longer a branch — it's that the portal doesn't link it and the
  > game carries `noindex`. Publishing on the 21st is a portal edit, not a merge.

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
