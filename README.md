# The Unfolding

A psychedelic, scientifically grounded journey through 13.8 billion years, from primordial energy to an eye made of a dying star's shed gas. One particle body travels through twelve stages, zooming between scales, and every stage carries an evidence label and its sources.

**Live:** https://honey-badger-labs.github.io/the-unfolding/

## Run it

```sh
npm run serve        # then open http://localhost:8000
npm test             # checks the Atlas
```

Jump to a stage with a hash: `#quasar`, `#heart`, `#worlds`, `#eye`, or `#t250` for stage 2.5. Space plays and pauses, M turns sound on and off, the arrow keys step.

## How it is built

- **`index.html`** is the whole renderer: one WebGL2 particle system, no build step, no dependencies. Each stage is a shape function in the vertex shader. A morph moves each particle from one shape to the next; a zoom draws both scenes, the one you leave streaming past while the next grows out of the point you aim at.
- **`audio.js`** is the soundtrack: one live-generated voice per stage (Web Audio, no audio files), crossfaded by the timeline, with a rush of air on every zoom. Press **Sound** or **M**. `tests/audio-levels.html` renders each voice offline and reports its loudness.
- **`data/events.json`** is the Cosmic Atlas. One record per stage: title, evidence label, era, scale, note, age, sources, camera framing and how the journey leaves it (morph or zoom). The page reads all of its text from here.
- **`data/sources.json`** lists every source, with the claim it supports.
- **`tests/atlas.test.mjs`** fails the build if a stage is missing, unsourced, mislabelled, dated out of order, or out of step with the renderer's shape count.
- **`.github/workflows/test.yml`** runs the tests on every push. GitHub Pages serves the site straight from the root of `main`.

## The scientific contract

Every stage is labelled **Observed**, **Model-dependent** or **Artistic interpretation**. Procedural shapes are said to be procedural. Dates are ranges, not false precision. See [docs/science-policy.md](docs/science-policy.md).

## Adding a stage

1. Add a shape branch to `shape()` in the vertex shader and raise `SHAPE_COUNT`.
2. Add an event to `data/events.json` with its sources.
3. Run `npm test`.

## Licence

The code (`index.html`, `audio.js`, `tests/`, `.github/`, `package.json`) is [MIT](LICENSE). The content (the Atlas text, docs, the name and media made from the experience) is all rights reserved; see [LICENSE-CONTENT.md](LICENSE-CONTENT.md).
