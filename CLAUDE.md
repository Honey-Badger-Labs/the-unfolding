# Working on The Unfolding

- Owner: Jakes. He gives taste notes; Claude does the build. Keep replies short: what changed, how to check it, what you need from him.
- No build step and no dependencies. `index.html` must keep working when opened from any static host.
- Facts live in `data/events.json` and `data/sources.json`, never hard-coded in the page. Run `npm test` before every commit.
- Follow `docs/science-policy.md`: label every claim, cite a real source you have read, say when shapes are procedural or exaggerated.
- Sound: one voice per stage in `audio.js`, levelled with `tests/audio-levels.html` (needs a browser driver such as puppeteer-core; headless `--dump-dom` returns before offline rendering finishes).
- To look at a stage, serve the folder (`npm run serve`) and screenshot `index.html#<tick>` in headless Chrome with SwiftShader; `file://` cannot load the Atlas.
- The prototype is also published as a claude.ai artifact (slug `27ee1faf-26b2-4187-9ded-a7b4c795761a`). Republish `index.html`, `audio.js` and `data/*.json` together. It is currently private (owner only); GitHub Pages is the public link.

## Commits

- Do not add Claude session links (`Claude-Session:` lines) to commit messages or PRs. Owner's request.
