# CluColor

Two people wake in a world with no colour, and no memory of each other.
Three clues bring it back.

**[sunair.fun](https://sunair.fun)**

At the end there's a message. Anyone who finishes can write their own and send it on —
the whole thing rides in the URL, so there's no server, no account, and no database with
your words in it.

---

## Credits

### Music

**Written by Balaji.** Four layers — not generated.

They don't play one at a time. Every layer is the same 8-second loop, so all four start
together and stay phase-locked; solving a clue doesn't *swap* the music, it *adds* to it.
By the ending all four are playing at once, and a lowpass filter — driven by the same number
that drives the colour — has opened all the way, so the music stops sounding remembered and
starts sounding present.

### Art — Kenney (CC0)

The ground, trees, foliage, plants and background panels come from
**[Kenney](https://kenney.nl)**, released into the public domain under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). No attribution is required.
It's here anyway, because Kenney has given away an enormous amount of good work and deserves
the mention.

| pack | used for |
|---|---|
| [Pixel Platformer](https://kenney.nl/assets/pixel-platformer) | ground, trees, foliage, shrubs |
| [Pixel Platformer: Farm Expansion](https://kenney.nl/assets/pixel-platformer-farm-expansion) | sunflowers, sprouts |
| [Pixel Platformer: Backgrounds](https://kenney.nl/assets/pixel-platformer) | the parallax horizon — a barren panel and a lush one, cross-faded |

Licence: [`assets/img/tiles/KENNEY-LICENSE.txt`](assets/img/tiles/KENNEY-LICENSE.txt)

**If you add art, it must permit REDISTRIBUTION, not merely "free to use".** This repo is
public and GitHub Pages serves it, so committing an asset *is* redistributing it. A lot of
"free" pixel-art packs forbid exactly that — it's a licence trap that has nothing to do with
price, and it disqualified several otherwise-perfect packs during this build.

### Everything else

The two characters, the lion, the house inside and out, the bench and the photograph were
generated, then processed offline (see below). No credit needed.

---

## Running it

```sh
python3 tools/serve.py        # http://localhost:8000
```

No build step, no npm, no bundler. Plain ES modules — what you see in the file is what runs
in the browser. That was a deliberate choice: with a hard deadline, a build that breaks at
2am is a failure mode worth simply not having.

### Tests

Open each in a browser; results also print in the `serve.py` terminal.

| suite | what it protects |
|---|---|
| `tests/encode.test.html` | the shareable link — emoji, hostile input, length |
| `tests/ending.test.html` | the ending + maker, incl. **5 XSS payloads** rendered inert |
| `tests/riddle.test.html` | answer matching and the hint ladder |
| `tests/slider.test.html` | the 8-puzzle: solvability and optimal hints |
| `tests/morse.test.html` | the carving says what the game expects |
| `tests/dialogue.test.html` | click-to-advance, skip |

---

## Layout

```
index.html            the whole game, one page
js/engine/            loop, input, sprites, audio, tween, fade
js/game/              world, story, dialogue, screens, puzzles
js/share/             the URL codec, and the one place text is rendered
data/                 the script, and the morse alphabet
assets/img/           sprites, tiles, rooms
assets/audio/         four layers, AAC (~1.2MB)
assets/_raw/          the originals. Sprites are RE-DERIVED from these.
tools/                dev server, asset pipeline, atlas viewers
```

### The asset pipeline

`tools/import.html` turns the raw generated images into game sprites: strips the fake
transparency, removes the watermark, crops, and downsamples with nearest-neighbour (never
smoothing — averaging blurs pixel art). It runs **once, offline**; the game never does this
work.

Anything derived can be rebuilt from `assets/_raw/`. Don't hand-edit the sprites in
`assets/img/` — change the raw and re-run the import.

---

## Two things worth knowing before changing anything

**The message never touches a server.** It's base64url'd into the URL *fragment* — the part
after `#`, which browsers never send. GitHub's access logs cannot see it, by construction.

**And it's therefore attacker-controlled.** Anyone can craft `sunair.fun/#m=<payload>` and
send it to someone. Every string that comes out of the URL goes through `safeRender()` in
`js/share/render.js`, which is `textContent` and nothing else. Line breaks come from
`white-space: pre-wrap` in CSS — **never** from replacing `\n` with `<br>` and assigning
`innerHTML`. That "harmless" convenience is exactly how the hole gets reopened, and there are
tests that will catch you.
