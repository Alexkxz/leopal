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
  const listeners = {};
  return {
    value: "silabas",
    textContent: "",
    innerHTML: "",
    style: {},
    dataset: {},
    hidden: false,
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
    addEventListener(event, handler) {
      listeners[event] = handler;
    },
    click() {
      return listeners.click?.();
    },
    querySelector() {
      return createFakeElement();
    },
    querySelectorAll() {
      return [];
    },
  };
}

const elements = new Map();
let recognitionInstances = 0;
let lastRecognition;
let getUserMediaCalls = 0;
const mediaTrack = {
  stopped: false,
  stop() {
    this.stopped = true;
  },
};

function FakeSpeechRecognition() {
  recognitionInstances += 1;
  lastRecognition = this;
  this.startCalls = 0;
  this.stopCalls = 0;
}

FakeSpeechRecognition.prototype.start = function start() {
  this.startCalls += 1;
};

FakeSpeechRecognition.prototype.stop = function stop() {
  this.stopCalls += 1;
};

function createAudioNode() {
  return {
    type: "",
    frequency: { value: 0 },
    Q: { value: 0 },
    gain: { value: 0 },
    threshold: { value: 0 },
    knee: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    release: { value: 0 },
    connect() {},
    disconnect() {},
  };
}

function FakeAudioContext() {
  this.state = "running";
  this.resume = () => Promise.resolve();
  this.createBiquadFilter = createAudioNode;
  this.createDynamicsCompressor = createAudioNode;
  this.createGain = createAudioNode;
  this.createMediaStreamSource = createAudioNode;
  this.createAnalyser = () => ({
    fftSize: 512,
    smoothingTimeConstant: 0,
    connect() {},
    disconnect() {},
    getByteTimeDomainData(data) {
      data.fill(128);
    },
  });
}

function createConfiguredStudent(maxAttemptsPerChunk, label) {
  return {
    id: `student-${label}`,
    name: `Intentos ${label}`,
    group: "1A",
    config: {
      consonants: ["m", "p", "l", "s", "t", "n", "r", "c", "q", "b", "d", "f", "g", "j", "v", "z", "y", "h", "k", "w", "x", "ch", "ll", "rr"],
      levelStart: "frases_cortas",
      sessionGoal: 10,
      shuffleSyllables: false,
      maxAttemptsPerChunk,
    },
  };
}

const storedStudents = [
  createConfiguredStudent(1, "uno"),
  createConfiguredStudent(2, "dos"),
  createConfiguredStudent(3, "tres"),
  createConfiguredStudent(undefined, "sin valor"),
  createConfiguredStudent(9, "invalido"),
];
const localStore = new Map();

const context = {
  console,
  performance,
  setTimeout(callback) {
    callback();
    return 1;
  },
  clearTimeout,
  window: {
    SpeechRecognition: FakeSpeechRecognition,
    webkitSpeechRecognition: FakeSpeechRecognition,
    AudioContext: FakeAudioContext,
    setTimeout(callback) {
      callback();
      return 1;
    },
    clearTimeout,
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {},
  },
  localStorage: {
    getItem(key) {
      if (localStore.has(key)) return localStore.get(key);
      if (key === "lectovoz_students") return JSON.stringify(storedStudents);
      return null;
    },
    setItem(key, value) {
      localStore.set(key, String(value));
    },
    removeItem(key) {
      localStore.delete(key);
    },
  },
  crypto: {
    randomUUID() {
      return "test-id";
    },
  },
  navigator: {
    mediaDevices: {
      getUserMedia() {
        getUserMediaCalls += 1;
        return Promise.resolve({ getTracks: () => [mediaTrack] });
      },
    },
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
vm.runInContext(fs.readFileSync("modules/academic-structure.js", "utf8"), context);
vm.runInContext(fs.readFileSync("modules/storage.js", "utf8"), context);
vm.runInContext(fs.readFileSync("modules/json-backup.js", "utf8"), context);
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

(async () => {
  const flushAsync = async (times = 8) => {
    for (let index = 0; index < times; index += 1) await Promise.resolve();
  };

  const continueBtn = elements.get("#continue-btn");
  const statusEl = elements.get("#mic-status");
  const missionCard = elements.get("#mission-card");

  context.createSession("Ana", "1A");
  await context.startListening();
  assert.strictEqual(getUserMediaCalls, 1);
  assert.strictEqual(recognitionInstances, 1);
  assert.strictEqual(statusEl.textContent, "Escuchando");

  context.stopListening(false);
  assert.strictEqual(mediaTrack.stopped, false);
  assert.strictEqual(statusEl.textContent, "Microfono listo");

  context.showMissionComplete();
  assert.strictEqual(missionCard.hidden, false);
  await continueBtn.click();
  assert.strictEqual(missionCard.hidden, true);
  assert.strictEqual(getUserMediaCalls, 1);
  assert.strictEqual(recognitionInstances, 1);
  assert.strictEqual(statusEl.textContent, "Escuchando");
  assert.ok(lastRecognition.startCalls >= 2);

  const JsonBackup = context.window.LectoVozJsonBackup;
  const Storage = context.window.LectoVozStorage;
  const getStoredRecords = () => JSON.parse(localStore.get("lectovoz_records") || "[]");
  Storage.saveRecords([]);
  let backupWrites = 0;
  let backupPickerCalls = 0;

  context.setLesson("ma");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.window.__lectovozListeningGateOverrideMs = 500;
  context.processTranscript("ma", 1, true);
  await flushAsync();
  assert.strictEqual(backupWrites, 0);
  assert.strictEqual(getStoredRecords().length, 1);

  context.window.showOpenFilePicker = async () => {
    backupPickerCalls += 1;
    return [{
      name: "lectovoz-datos.json",
      getFile: async () => ({
        name: "lectovoz-datos.json",
        text: async () => JSON.stringify(JsonBackup.buildBackupData()),
      }),
      createWritable: async () => ({
        write: async () => {
          backupWrites += 1;
        },
        close: async () => {},
      }),
    }];
  };
  await JsonBackup.openBackupFile("merge");
  backupWrites = 0;

  context.setLesson("me");
  context.processTranscript("me", 1, true);
  await flushAsync();
  assert.strictEqual(backupWrites, 1);
  assert.strictEqual(backupPickerCalls, 1);
  const recordCountAfterAutoSave = getStoredRecords().length;
  await JsonBackup.autoSaveOpenedBackup();
  assert.strictEqual(getStoredRecords().length, recordCountAfterAutoSave);

  backupWrites = 0;
  context.showMissionComplete();
  await flushAsync();
  assert.strictEqual(backupWrites, 1);

  JsonBackup.setAutoSaveEnabled(false);
  backupWrites = 0;
  context.setLesson("mi");
  context.processTranscript("mi", 1, true);
  await flushAsync();
  assert.strictEqual(backupWrites, 0);
  const manualSave = await JsonBackup.saveToOpenedFile();
  assert.strictEqual(manualSave.success, true);
  assert.strictEqual(backupWrites, 1);
  JsonBackup.setAutoSaveEnabled(true);

  context.window.showOpenFilePicker = async () => [{
    name: "lectovoz-datos.json",
    getFile: async () => ({
      name: "lectovoz-datos.json",
      text: async () => JSON.stringify(JsonBackup.buildBackupData()),
    }),
    createWritable: async () => {
      throw new Error("write failed");
    },
  }];
  await JsonBackup.openBackupFile("merge");
  const recordsBeforeFailedWrite = getStoredRecords().length;
  context.setLesson("mo");
  context.processTranscript("mo", 1, true);
  await flushAsync();
  assert.strictEqual(getStoredRecords().length, recordsBeforeFailedWrite + 1);
  assert.strictEqual(JsonBackup.getBackupStatus().lastError, "write failed");

  levelSelect.value = "frases_cortas";
  context.setLesson("caballo perro");
  context.window.__lectovozVoiceGateOverrideMs = 0;
  context.window.__lectovozListeningGateOverrideMs = 500;
  context.processTranscript("capallo", 1, true);
  let pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.chunkAttempts.length, 0);

  context.window.__lectovozVoiceGateOverrideMs = 350;
  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 1);
  assert.strictEqual(pedagogy.chunkAttempts[0].evaluationStatus, "approximate");

  context.setLesson("ma me");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("ma", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);

  context.setLesson("ma me");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("ma", 1, false);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);

  context.setLesson("ma me");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("pa", 1, false);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 0);

  context.setLesson("ma me");
  const immediateTimeout = context.window.setTimeout;
  context.window.setTimeout = (callback, ms) => {
    if (ms === 450) return 1;
    callback();
    return 1;
  };
  context.window.__lectovozVoiceGateOverrideMs = 100;
  context.processTranscript("ma", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.flushPendingTranscript();
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  context.window.setTimeout = immediateTimeout;

  context.setLesson("ma me");
  context.window.setTimeout = (callback, ms) => {
    if (ms === 450) return 1;
    callback();
    return 1;
  };
  context.window.__lectovozVoiceGateOverrideMs = 100;
  context.processTranscript("ma", 1, true);
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("ma", 1, true);
  context.flushPendingTranscript();
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  context.window.setTimeout = immediateTimeout;

  context.setLesson("ma me");
  context.window.__lectovozVoiceGateOverrideMs = 0;
  context.processTranscript("ma", 1, true);
  context.flushPendingTranscript(true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 0);

  context.setLesson("caballo perro");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 1);

  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 2);

  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.notMasteredChunks.length, 1);
  assert.strictEqual(pedagogy.notMasteredChunks[0].status, "not_mastered");
  assert.strictEqual(pedagogy.notMasteredChunks[0].attempts, 3);
  assert.strictEqual(pedagogy.notMasteredChunks[0].observedDifference.expectedPart, "ba");
  assert.strictEqual(pedagogy.notMasteredChunks[0].observedDifference.recognizedPart, "pa");

  context.setLesson("caballo perro");
  context.processTranscript("capallo", 1, true);
  context.processTranscript("caballo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.chunkAttempts.length, 1);
  assert.strictEqual(pedagogy.notMasteredChunks.length, 0);

  context.setLesson("mariposa perro");
  context.processTranscript("marposa", 1, true);
  context.processTranscript("marposa", 1, true);
  context.processTranscript("marposa", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.notMasteredChunks[0].evaluationStatus, "approximate");
  assert.strictEqual(getUserMediaCalls, 1);
  assert.strictEqual(recognitionInstances, 1);

  context.createSession("Intentos uno", "1A");
  context.setLesson("caballo perro");
  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.notMasteredChunks[0].attempts, 1);

  context.createSession("Intentos dos", "1A");
  context.setLesson("caballo perro");
  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 1);
  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.notMasteredChunks[0].attempts, 2);

  context.createSession("Intentos tres", "1A");
  context.setLesson("caballo perro");
  context.processTranscript("capallo", 1, true);
  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 2);
  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.notMasteredChunks[0].attempts, 3);

  context.createSession("Intentos sin valor", "1A");
  context.setLesson("caballo perro");
  context.processTranscript("capallo", 1, true);
  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  context.processTranscript("capallo", 1, true);
  assert.strictEqual(context.getPedagogicalState().notMasteredChunks[0].attempts, 3);

  context.createSession("Intentos invalido", "1A");
  context.setLesson("caballo perro");
  context.processTranscript("capallo", 1, true);
  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  context.processTranscript("capallo", 1, true);
  assert.strictEqual(context.getPedagogicalState().notMasteredChunks[0].attempts, 3);

  console.log(`Speech logic tests passed (${passedChecks} checks)`);
})();
