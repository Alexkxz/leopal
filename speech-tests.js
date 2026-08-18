const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

function createFakeElement() {
  return {
    value: "silabas",
    textContent: "",
    innerHTML: "",
    style: {},
    dataset: {},
    className: "",
    classList: {
      add() {},
      remove() {},
      contains() {
        return false;
      },
    },
    appendChild() {},
    addEventListener() {},
    querySelector() {
      return createFakeElement();
    },
    querySelectorAll() {
      return [];
    },
  };
}

const elements = new Map();
const context = {
  console,
  performance,
  setTimeout,
  clearTimeout,
  window: {
    SpeechRecognition: function SpeechRecognition() {},
    webkitSpeechRecognition: function SpeechRecognition() {},
    setTimeout,
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {},
  },
  navigator: {
    mediaDevices: null,
  },
  document: {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, createFakeElement());
      return elements.get(selector);
    },
    createElement() {
      return createFakeElement();
    },
  },
};

vm.createContext(context);
vm.runInContext(fs.readFileSync("app.js", "utf8"), context);

const levelSelect = elements.get("#level-select");

function assertArray(actual, expected) {
  assert.deepStrictEqual(Array.from(actual), expected);
}

assert.strictEqual(context.normalizeText("Ni\u00f1a, mam\u00e1."), "nina mama");
assertArray(context.syllabifyWord("mama"), ["ma", "ma"]);
assertArray(context.syllabifyWord("pelota"), ["pe", "lo", "ta"]);

assert.ok(context.getLessonList("palabras_cortas").length > 100);
assert.ok(context.getLessonList("palabras_medianas").length > 100);
assert.ok(context.getLessonList("palabras_largas").length > 50);
assert.ok(context.getLessonList("frases_cortas").length > 50);
assert.ok(context.getLessonList("frases_medianas").length > 50);
assert.ok(context.getLessonList("frases_largas").length > 30);

levelSelect.value = "palabras_cortas";
assertArray(context.splitIntoChunks("mapa"), ["ma", "pa"]);

levelSelect.value = "frases_cortas";
assertArray(context.splitIntoChunks("Mi mama me quiere"), ["mi", "mama", "me", "quiere"]);

assert.strictEqual(context.canAdvanceWithTranscript("ma me mi", "ma"), true);
assert.strictEqual(context.canAdvanceWithTranscript("ma me mi", "me"), true);
assert.strictEqual(context.canAdvanceWithTranscript("mama", "ma"), true);
assert.strictEqual(context.canAdvanceWithTranscript("pelota", "lo"), true);
assert.strictEqual(context.canAdvanceWithTranscript("sopa", "ma"), false);
assert.strictEqual(context.buildSpokenCandidates("pelota").includes("ta"), true);
assert.strictEqual(context.chunkMatches("baca", "vaca"), true);
assert.strictEqual(context.chunkMatches("keso", "queso"), true);
assert.strictEqual(context.chunkMatches("caza", "casa"), true);
assert.strictEqual(context.chunkMatches("pelota", "pelota"), true);
assert.strictEqual(context.chunkMatches("mesa", "luna"), false);
assert.ok(context.scoreMatch("mariposa", "mariposa") > context.scoreMatch("mariposa", "mapa"));

console.log("Speech logic tests passed");
