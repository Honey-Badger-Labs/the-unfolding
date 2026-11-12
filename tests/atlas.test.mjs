// Checks that the Cosmic Atlas is complete, sourced and in step with the renderer.
// Run with: npm test   (Node 20+, no dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const { events } = JSON.parse(read("data/events.json"));
const { sources } = JSON.parse(read("data/sources.json"));
const html = read("index.html");

const AGE_OF_UNIVERSE = 13.8e9;
const LABELS = ["observed", "model", "art"];
const sourceIds = new Set(sources.map((s) => s.id));

test("one event per shape the renderer draws", () => {
  const m = html.match(/var SHAPE_COUNT=(\d+)/);
  assert.ok(m, "index.html must declare SHAPE_COUNT");
  assert.equal(events.length, Number(m[1]));
});

test("stages run 0..n-1 with no gaps or repeats", () => {
  const stages = events.map((e) => e.stage).sort((a, b) => a - b);
  stages.forEach((s, i) => assert.equal(s, i, `stage ${i} missing or duplicated`));
});

test("ids and ticks are unique", () => {
  for (const key of ["id", "tick"]) {
    const vals = events.map((e) => String(e[key]).toLowerCase());
    assert.equal(new Set(vals).size, vals.length, `duplicate ${key}`);
  }
});

for (const e of events) {
  test(`event ${e.id} is complete and sourced`, () => {
    for (const f of ["title", "tick", "era", "scale", "note"]) {
      assert.ok(typeof e[f] === "string" && e[f].trim(), `${f} missing`);
    }
    assert.ok(LABELS.includes(e.label), `label must be one of ${LABELS}`);
    assert.ok(e.note.length <= 200, `note is ${e.note.length} chars; keep it to 200 so it fits the panel`);
    assert.ok(Array.isArray(e.sources) && e.sources.length > 0, "needs at least one source");
    for (const id of e.sources) assert.ok(sourceIds.has(id), `unknown source ${id}`);
    assert.ok(e.camera && e.camera.dist > 0, "needs a camera cue");
  });

  test(`event ${e.id} has a sane age`, () => {
    if (e.age === null) return;
    assert.ok(Array.isArray(e.age) && e.age.length === 2, "age is [earliest, latest] or null");
    const [lo, hi] = e.age;
    assert.ok(lo >= 0 && lo <= hi, "age range is out of order");
    if (hi > AGE_OF_UNIVERSE) {
      assert.equal(e.future, true, "an age beyond 13.8 billion years must be marked future");
      assert.match(e.era, /from now/, "future events must say so in their era");
    }
  });
}

test("ages never run backwards through the journey", () => {
  const dated = events.filter((e) => e.age).sort((a, b) => a.stage - b.stage);
  for (let i = 1; i < dated.length; i++) {
    assert.ok(dated[i].age[1] >= dated[i - 1].age[0], `${dated[i].id} is dated before ${dated[i - 1].id}`);
  }
});

test("every source is complete and used", () => {
  const used = new Set(events.flatMap((e) => e.sources));
  for (const s of sources) {
    assert.match(s.url, /^https:\/\//, `${s.id} needs an https url`);
    assert.ok(s.title && s.publisher && s.supports, `${s.id} needs title, publisher and supports`);
    assert.ok(used.has(s.id), `${s.id} is not cited by any event`);
  }
});

test("every stage but the last says how the journey leaves it", () => {
  const sorted = [...events].sort((a, b) => a.stage - b.stage);
  sorted.forEach((e, i) => {
    if (i === sorted.length - 1) {
      assert.equal(e.transition, undefined, "the last stage has nowhere to go");
      return;
    }
    const t = e.transition;
    assert.ok(t && ["morph", "zoom-in", "zoom-out"].includes(t.type), `${e.id} needs a transition of morph, zoom-in or zoom-out`);
    if (t.type !== "morph") assert.ok(t.depth > 0 && t.depth < 6, `${e.id} zoom depth should be between 0 and 6`);
  });
});
