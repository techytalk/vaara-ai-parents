import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUserPrompt,
  decideAction,
  englishBodyFor,
  parseVerdict,
} from "../src/lib/content-filter.js";

test("a school note is allowed", () => {
  const action = decideAction({
    isEnglish: true,
    language: "",
    english: "",
    filthy: 0.02,
    sexualOrRomantic: 0.01,
    harassing: 0.04,
  });
  assert.equal(action, "allow");
});

test("a proposition is blocked", () => {
  const action = decideAction({
    isEnglish: true,
    language: "",
    english: "",
    filthy: 0.1,
    sexualOrRomantic: 0.93,
    harassing: 0.4,
  });
  assert.equal(action, "block");
});

test("a directed insult at filthy 0.60 is blocked", () => {
  const action = decideAction({
    isEnglish: false,
    language: "Telugu",
    english: "Damn you",
    filthy: 0.6,
    sexualOrRomantic: 0,
    harassing: 0.5,
  });
  assert.equal(action, "block");
});

test("harassing at 0.50 is blocked", () => {
  const action = decideAction({
    isEnglish: true,
    language: "",
    english: "",
    filthy: 0.2,
    sexualOrRomantic: 0.1,
    harassing: 0.5,
  });
  assert.equal(action, "block");
});

test("sexualOrRomantic at 0.65 is blocked", () => {
  const action = decideAction({
    isEnglish: true,
    language: "",
    english: "",
    filthy: 0.1,
    sexualOrRomantic: 0.65,
    harassing: 0.1,
  });
  assert.equal(action, "block");
});

test("an elevated but below-block score is logged as review", () => {
  const action = decideAction({
    isEnglish: false,
    language: "Telugu",
    english: "The driver was rude.",
    filthy: 0.4,
    sexualOrRomantic: 0.05,
    harassing: 0.2,
  });
  assert.equal(action, "review");
});

test("mixed text keeps the translation and drops it for English", () => {
  const mixed = parseVerdict({
    isEnglish: false,
    language: "mixed Telugu and English",
    english: "The bus was late, the driver was rude.",
    filthy: 0.1,
    sexualOrRomantic: 0,
    harassing: 0.1,
  });
  assert.ok(mixed);
  assert.equal(englishBodyFor(mixed), "The bus was late, the driver was rude.");

  const english = parseVerdict({
    isEnglish: true,
    language: "English",
    english: "should be ignored",
    filthy: 0,
    sexualOrRomantic: 0,
    harassing: 0,
  });
  assert.ok(english);
  assert.equal(english.language, "");
  assert.equal(englishBodyFor(english), null);
});

test("a non-English verdict without a translation is unusable", () => {
  assert.equal(
    parseVerdict({
      isEnglish: false,
      language: "Hindi",
      english: "  ",
      filthy: 0.9,
      sexualOrRomantic: 0,
      harassing: 0,
    }),
    null
  );
});

test("a reply prompt includes the thread and not a new post", () => {
  const reply = buildUserPrompt({
    text: "will you marry me?",
    threadTitle: "School bus",
    replyTo: "The bus was late today",
  });
  assert.match(reply, /Thread title: School bus/);
  assert.match(reply, /Replying to: The bus was late today/);
  const post = buildUserPrompt({ text: "Homework for class 5?" });
  assert.doesNotMatch(post, /Thread title/);
});
