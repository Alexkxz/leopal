const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

let passedChecks = 0;
["strictEqual", "deepStrictEqual", "ok"].forEach((method) => {
  const original = assert[method];
  assert[method] = (...args) => {
    original(...args);
    passedChecks += 1;
  };
});

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
      toggle() {},
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
  localStorage: {
    getItem() {
      return null;
    },
    setItem() {},
    removeItem() {},
  },
  crypto: {
    randomUUID() {
      return "test-id";
    },
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
context.window.localStorage = context.localStorage;
context.window.crypto = context.crypto;
context.window.navigator = context.navigator;
context.window.performance = performance;

vm.createContext(context);
vm.runInContext(fs.readFileSync("modules/evaluation.js", "utf8"), context);
vm.runInContext(fs.readFileSync("modules/content.js", "utf8"), context);
vm.runInContext(fs.readFileSync("modules/storage.js", "utf8"), context);
vm.runInContext(fs.readFileSync("modules/speech-recognition.js", "utf8"), context);
vm.runInContext(fs.readFileSync("app.js", "utf8"), context);

const levelSelect = elements.get("#level-select");

function assertArray(actual, expected) {
  assert.deepStrictEqual(Array.from(actual), expected);
}

assert.strictEqual(context.normalizeText("Ni\u00f1a, mam\u00e1."), "nina mama");
assert.strictEqual(context.normalizeText("  \u00a1Hola, NI\u00d1O! 123  "), "hola nino");
assert.strictEqual(context.normalizeText(null), "");
assertArray(context.syllabifyWord("mama"), ["ma", "ma"]);
assertArray(context.syllabifyWord("pelota"), ["pe", "lo", "ta"]);
assertArray(context.splitIntoChunks("Mi mama me quiere"), ["mi", "mama", "me", "quiere"]);

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
assert.strictEqual(context.canAdvanceWithTranscript("la pelota roja", "la pelota"), true);
assert.strictEqual(context.canAdvanceWithTranscript("sopa", "ma"), false);
assert.strictEqual(context.buildSpokenCandidates("pelota").includes("ta"), true);
assert.strictEqual(context.buildSpokenCandidates("mi mama").includes("mimama"), true);
assert.strictEqual(context.chunkMatches("baca", "vaca"), true);
assert.strictEqual(context.chunkMatches("keso", "queso"), true);
assert.strictEqual(context.chunkMatches("caza", "casa"), true);
assert.strictEqual(context.chunkMatches("pelota", "pelota"), true);
assert.strictEqual(context.chunkMatches("mesa", "luna"), false);
assert.strictEqual(context.phoneticKey("vaca"), context.phoneticKey("baca"));
assert.strictEqual(context.phoneticKey("queso"), context.phoneticKey("keso"));
assert.strictEqual(context.diceSimilarity("casa", "casa"), 1);
assert.ok(context.diceSimilarity("casa", "cosa") > context.diceSimilarity("casa", "tren"));
assert.strictEqual(context.normalizedDistance("casa", "casa"), 0);
assert.ok(context.normalizedDistance("casa", "cosa") < context.normalizedDistance("casa", "tren"));
assert.strictEqual(context.findError(["luna"], "ma"), true);
assert.strictEqual(context.findError(["m"], "ma"), false);
assert.ok(context.scoreMatch("mariposa", "mariposa") > context.scoreMatch("mariposa", "mapa"));

function assertEvaluation(spoken, expected, status) {
  const result = context.evaluateReading(spoken, expected);
  assert.strictEqual(result.status, status);
  assert.strictEqual(result.normalizedSpoken, context.normalizeText(spoken));
  assert.strictEqual(result.normalizedExpected, context.normalizeText(expected));
  assert.ok(Number.isFinite(result.score));
  assert.ok(result.reason.length > 0);
}

assertEvaluation("casa", "casa", "correct");
assertEvaluation("mariposa", "mariposa", "correct");
assertEvaluation("ma", "ma", "correct");
assertEvaluation("CASA", "casa", "correct");
assertEvaluation("arbol", "\u00e1rbol", "correct");
assertEvaluation("camion", "cami\u00f3n", "correct");
assertEvaluation("mama", "mam\u00e1", "correct");
assertEvaluation("baca", "vaca", "correct");
assertEvaluation("keso", "queso", "correct");
assertEvaluation("caza", "casa", "correct");

assertEvaluation("ma", "pa", "incorrect");
assertEvaluation("mesa", "casa", "incorrect");
assertEvaluation("sal", "sol", "incorrect");

assertEvaluation("marposa", "mariposa", "approximate");
assertEvaluation("maripisa", "mariposa", "approximate");
assertEvaluation("mariposal", "mariposa", "approximate");
assert.strictEqual(context.chunkMatches("marposa", "mariposa"), false);
assert.strictEqual(context.canAdvanceWithTranscript("marposa", "mariposa"), false);
assert.strictEqual(context.canAdvanceWithTranscript("mi mama me quiere", "mi"), true);
assert.strictEqual(context.canAdvanceWithTranscript("mi mama me quiere", "mama"), true);

console.log(`Speech logic tests passed (${passedChecks} checks)`);
