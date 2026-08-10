import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CAPTION_LENGTH,
  classifyCaption,
  cryptoRandom,
  makeVerdict,
  selectVerdictKey,
} from "../app/referee.ts";

test("caption tiers use the declared maximum and conservative phrase boundaries", () => {
  assert.equal(MAX_CAPTION_LENGTH, 240);
  assert.equal(classifyCaption(""), "base");
  assert.equal(classifyCaption("2 weeks later"), "base");
  assert.equal(classifyCaption("both photos in one post"), "base");
  assert.equal(classifyCaption("rizzler energy"), "base");

  assert.equal(classifyCaption("RIZZ"), "strong");
  assert.equal(classifyCaption("out of their league"), "strong");
  assert.equal(classifyCaption("two women"), "multiple");
  assert.equal(classifyCaption("2 girlfriends at once"), "multiple");

  // Captions are capped before phrase matching, so cues beyond the input limit
  // cannot silently affect a verdict.
  assert.equal(classifyCaption(`${"x".repeat(MAX_CAPTION_LENGTH)} rizz`), "base");
});

test("weighted selection respects boundaries for every caption tier", () => {
  assert.equal(selectVerdictKey("base", 0), "no-foul");
  assert.equal(selectVerdictKey("base", 0.45), "yellow");
  assert.equal(selectVerdictKey("base", 0.8), "red");

  assert.equal(selectVerdictKey("strong", 0), "no-foul");
  assert.equal(selectVerdictKey("strong", 0.35), "yellow");
  assert.equal(selectVerdictKey("strong", 0.75), "red");

  assert.equal(selectVerdictKey("multiple", 0), "no-foul");
  assert.equal(selectVerdictKey("multiple", 0.25), "yellow");
  assert.equal(selectVerdictKey("multiple", 0.65), "red");
});

test("a reroll excludes the previous key and renormalizes the remaining weights", () => {
  assert.equal(selectVerdictKey("base", 0, "no-foul"), "yellow");
  assert.equal(selectVerdictKey("base", 35 / 55, "no-foul"), "red");
  assert.equal(selectVerdictKey("strong", 0, "yellow"), "no-foul");
  assert.equal(selectVerdictKey("multiple", 0.999999, "red"), "yellow");

  for (const previousKey of ["no-foul", "yellow", "red"]) {
    for (const randomValue of [0, 0.2, 0.5, 0.999999]) {
      assert.notEqual(selectVerdictKey("base", randomValue, previousKey), previousKey);
    }
  }
});

test("makeVerdict returns a context-aware ruling and exactly two safe VAR notes", () => {
  const verdict = makeVerdict("somehow pulled", 0.1);

  assert.equal(verdict.tier, "strong");
  assert.equal(verdict.key, "no-foul");
  assert.equal(verdict.ruling.length > 0, true);
  assert.equal(verdict.notes.length, 2);
  assert.ok(verdict.notes.every((note) => /^VAR note:/u.test(note)));
  assert.doesNotMatch(`${verdict.ruling} ${verdict.notes.join(" ")}`, /pixel|inspect|appearance|ugly/iu);
});

test("cryptoRandom returns values in the half-open unit interval", () => {
  const value = cryptoRandom();
  assert.equal(typeof value, "number");
  assert.ok(value >= 0 && value < 1);
});

