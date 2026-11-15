// Renders the journey to a video file, frame by frame, with its soundtrack.
//
//   npm i --no-save puppeteer-core @fontsource/cormorant-garamond @fontsource/ibm-plex-mono
//   npm run serve                      (in another terminal)
//   node tools/film.mjs --out film.mp4 [--width 1920 --height 1080 --fps 30 --from 0 --to 15 --particles 240]
//
// Needs Chrome and ffmpeg. Nothing here runs in real time: the page's clock is replaced by one that this
// script advances by exactly one frame at a time, so the film has no dropped frames however slow the machine.
// The soundtrack is rendered separately, offline, from the same timeline, then joined to the picture.
// --from and --to are stage numbers; a part-film (say --from 6 --to 7) is useful for checking one transition.
import puppeteer from "puppeteer-core";
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, createWriteStream, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : fallback; };
const W = +arg("width", 1920), H = +arg("height", 1080), FPS = +arg("fps", 30);
const OUT = path.resolve(arg("out", "film.mp4"));
const FROM = +arg("from", 0), TO = arg("to", null);
const PARTICLES = arg("particles", "240");
const SITE = arg("site", "http://localhost:8765");
const CHROME = arg("chrome", process.env.CHROME || "/usr/bin/google-chrome");
const HEAD = +arg("head", 2.5);      // seconds held on the first stage before the journey moves
const TAIL = +arg("tail", 9);        // seconds after the last stage, while the sound fades
const RATE = 48000;

// the web fonts, served from node_modules so the film never depends on the network
const FONT = {
  "cg-500": "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2",
  "cg-500i": "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2",
  "pm-400": "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
  "pm-500": "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
};
const face = (family, style, weight, key) =>
  `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};src:url(https://fonts.gstatic.com/film/${key}.woff2) format('woff2')}`;
const FONT_CSS = face("Cormorant Garamond", "normal", 500, "cg-500") + face("Cormorant Garamond", "italic", 500, "cg-500i") +
  face("IBM Plex Mono", "normal", 400, "pm-400") + face("IBM Plex Mono", "normal", 500, "pm-500");

// Replaces every clock the page can see. Time only moves when __advance is called.
function virtualClock() {
  let now = 0, id = 1, rafs = [];
  const timers = new Map(), anims = new Map(), epoch = Date.now();
  performance.now = () => now;
  Date.now = () => epoch + now;
  window.requestAnimationFrame = (cb) => { rafs.push(cb); return id++; };
  window.cancelAnimationFrame = () => {};
  window.setTimeout = (fn, ms, ...a) => { const i = id++; timers.set(i, { at: now + (ms || 0), fn, a }); return i; };
  window.setInterval = (fn, ms, ...a) => { const i = id++; timers.set(i, { at: now + ms, fn, a, every: ms || 1 }); return i; };
  window.clearTimeout = window.clearInterval = (i) => { timers.delete(i); };
  window.__advance = (ms) => {
    now += ms;
    for (let guard = 0; guard < 5000; guard++) {
      let due = null, key = 0;
      for (const [i, t] of timers) if (t.at <= now && (!due || t.at < due.at)) { due = t; key = i; }
      if (!due) break;
      if (due.every) due.at += due.every; else timers.delete(key);
      try { due.fn(...due.a); } catch (e) { console.error(e); }
    }
    const run = rafs; rafs = [];
    for (const cb of run) { try { cb(now); } catch (e) { console.error(e); } }
    // CSS transitions and animations (the text) follow the same clock
    for (const a of document.getAnimations()) {
      if (!anims.has(a)) anims.set(a, now);
      const t = now - anims.get(a), end = a.effect ? a.effect.getComputedTiming().endTime : 0;
      if (t >= end) { try { a.finish(); } catch (e) {} } else { a.pause(); a.currentTime = t; }
    }
    return now;
  };
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", `--window-size=${W},${H}`],
});
const page = await browser.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(e.message));
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.setRequestInterception(true);
page.on("request", (r) => {
  const u = r.url();
  if (u.startsWith(SITE)) return r.continue();
  if (u.includes("fonts.googleapis.com/css")) return r.respond({ contentType: "text/css", body: FONT_CSS });
  const m = u.match(/fonts\.gstatic\.com\/film\/([\w-]+)\.woff2/);
  if (m && FONT[m[1]]) {
    const f = path.join(root, "node_modules", FONT[m[1]]);
    if (existsSync(f)) return r.respond({ contentType: "font/woff2", headers: { "access-control-allow-origin": "*" }, body: readFileSync(f) });
  }
  r.abort();
});
await page.evaluateOnNewDocument(virtualClock);
await page.goto(SITE + "/index.html", { waitUntil: "domcontentloaded", timeout: 120000 });
const step = (ms) => page.evaluate((x) => window.__advance(x), ms);
// let the Atlas and the fonts arrive (real time), turning the virtual clock a little so the page settles
await page.waitForFunction(() => document.querySelectorAll("#ticks i").length > 1, { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: ".ctl,#fps{display:none!important}body{cursor:none}" });
const clicks = { 60: 2, 120: 0, 240: 1 }[PARTICLES] ?? 1;
for (let i = 0; i < clicks; i++) await page.click("#q", { offset: { x: 1, y: 1 } }).catch(() => page.evaluate(() => document.getElementById("q").click()));
const last = await page.evaluate(() => document.querySelectorAll("#ticks i").length - 1);
const END = TO === null ? last : Math.min(last, +TO);
await page.evaluate((v) => { const s = document.getElementById("t"); s.value = v; s.dispatchEvent(new Event("input")); window.dispatchEvent(new Event("resize")); }, FROM);
for (let i = 0; i < 90; i++) await step(1000 / FPS);       // warm-up draws and the first text, unfilmed

const silent = OUT + ".video.mp4";
const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
  "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", silent], { stdio: ["pipe", "inherit", "inherit"] });
const cdp = await page.createCDPSession();
const track = [];
let frame = 0, started = false, endedAt = -1;
const t0 = Date.now();
for (;;) {
  const time = frame / FPS;
  if (!started && time >= HEAD) { await page.evaluate(() => document.getElementById("play").click()); started = true; }
  await step(1000 / FPS);
  const state = await page.evaluate(() => ({ T: parseFloat(document.getElementById("t").value), label: document.getElementById("play").textContent }));
  track.push(state.T);
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
  if (!ff.stdin.write(Buffer.from(shot.data, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
  frame++;
  if (started && endedAt < 0) {
    if (state.label === "Replay") endedAt = time;                                  // the journey played to its end
    else if (TO !== null && state.T >= END - 1e-4 && state.label === "Pause") {     // a part-film: rest on the last stage, then stop
      if (!track.restFrom) track.restFrom = time;
      if (time - track.restFrom > 6) { endedAt = time; await page.evaluate(() => document.getElementById("play").click()); }
    }
  }
  if (endedAt >= 0 && time - endedAt >= TAIL) break;
  if (frame % 150 === 0) process.stdout.write(`\r${frame} frames, stage ${state.T.toFixed(2)} of ${END}, ${(frame / ((Date.now() - t0) / 1000)).toFixed(1)} frames/s   `);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
const seconds = frame / FPS;
console.log(`\npicture: ${frame} frames, ${seconds.toFixed(1)} s, rendered in ${((Date.now() - t0) / 60000).toFixed(1)} min`);

// ---- the soundtrack, rendered offline from the same timeline
const snd = await browser.newPage();
snd.on("pageerror", (e) => problems.push("audio: " + e.message));
const wav = OUT + ".wav";
const sink = createWriteStream(wav);
await snd.exposeFunction("__wav", (b64) => { sink.write(Buffer.from(b64, "base64")); });
await snd.goto(SITE + "/tools/film-audio.html", { waitUntil: "load", timeout: 60000 });
const atlas = JSON.parse(readFileSync(path.join(root, "data/events.json"), "utf8"));
await snd.evaluate((o) => window.renderFilmAudio(o), { track: Array.from(track), fps: FPS, head: HEAD, endedAt, seconds, rate: RATE, events: atlas.events });
await new Promise((r) => sink.end(r));
await browser.close();

execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", silent, "-i", wav, "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", OUT]);
rmSync(silent); rmSync(wav);
writeFileSync(OUT + ".json", JSON.stringify({ width: W, height: H, fps: FPS, frames: frame, seconds, from: FROM, to: END, particles: PARTICLES, problems }, null, 1));
console.log("film:", OUT, problems.length ? "\nproblems: " + problems.slice(0, 5).join(" | ") : "");
