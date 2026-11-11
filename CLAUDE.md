# Working on The Unfolding

- Owner: Jakes. He gives taste notes; Claude does the build. Keep replies short: what changed, how to check it, what you need from him.
- No build step and no dependencies. `index.html` must keep working when opened from any static host.
- Facts live in `data/events.json` and `data/sources.json`, never hard-coded in the page. Run `npm test` before every commit.
- Follow `docs/science-policy.md`: label every claim, cite a real source you have read, say when shapes are procedural or exaggerated.
- To look at a stage, serve the folder (`npm run serve`) and screenshot `index.html#<tick>` in headless Chrome with SwiftShader; `file://` cannot load the Atlas.
- The prototype is also published as a claude.ai artifact (slug `27ee1faf-26b2-4187-9ded-a7b4c795761a`, shared publicly). Republish `index.html` and `data/*.json` together.
