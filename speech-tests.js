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
  const children = [];
  const element = {
    value: "syllables",
    textContent: "",
    style: {},
    dataset: {},
    hidden: false,
    className: "",
    classList: {
      add(...names) {
        const classes = new Set(element.className.split(/\s+/).filter(Boolean));
        names.forEach((name) => classes.add(name));
        element.className = Array.from(classes).join(" ");
      },
      remove(...names) {
        const removed = new Set(names);
        element.className = element.className
          .split(/\s+/)
          .filter((name) => name && !removed.has(name))
          .join(" ");
      },
      toggle(name, force) {
        const classes = new Set(element.className.split(/\s+/).filter(Boolean));
        const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        element.className = Array.from(classes).join(" ");
      },
      contains(name) {
        return element.className.split(/\s+/).includes(name);
      },
    },
    appendChild(child) {
      children.push(child);
      return child;
    },
    addEventListener(event, handler) {
      listeners[event] = handler;
    },
    click() {
      return listeners.click?.();
    },
    querySelector(selector) {
      const indexMatch = String(selector || "").match(/\[data-index=['"]([^'"]+)['"]\]/);
      if (indexMatch) {
        return children.find((child) => String(child.dataset?.index) === indexMatch[1]) || null;
      }
      return createFakeElement();
    },
    querySelectorAll(selector) {
      if (selector === ".chunk") {
        return children.filter((child) => child.classList?.contains("chunk"));
      }
      return [];
    },
  };
  Object.defineProperty(element, "innerHTML", {
    get() {
      return "";
    },
    set() {
      children.length = 0;
    },
  });
  return element;
}

const elements = new Map();
let recognitionInstances = 0;
let lastRecognition;
const recognitionHistory = [];
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
  recognitionHistory.push(this);
  this.startCalls = 0;
  this.stopCalls = 0;
  this.abortCalls = 0;
}

FakeSpeechRecognition.prototype.start = function start() {
  this.startCalls += 1;
};

FakeSpeechRecognition.prototype.stop = function stop() {
  this.stopCalls += 1;
};

FakeSpeechRecognition.prototype.abort = function abort() {
  this.abortCalls += 1;
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
      levelStart: "shortSentences",
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

assert.strictEqual(context.window.LectoVozContent.lessons.syllables.length, 19);
assert.ok(context.getLessonList("syllables").length >= 18);
assert.ok(context.getLessonList("segmentedWords").length >= 60);
assert.ok(context.getLessonList("simpleWords").length >= 80);
assert.ok(context.getLessonList("complexWords").length >= 80);
assert.ok(context.getLessonList("shortSentences").length >= 40);
assert.ok(context.getLessonList("longSentences").length >= 40);

levelSelect.value = "simpleWords";
assertArray(context.splitIntoChunks("mapa"), ["mapa"]);
assertArray(context.splitIntoChunks("ca-mio-ne-ta"), ["camioneta"]);
assert.strictEqual(context.evaluateReading("camioneta", "ca-mio-ne-ta").status, "correct");

levelSelect.value = "shortSentences";
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
assertEvaluation("perro", "sol", "incorrect");
assertEvaluation("sal", "sol", "incorrect");

assertEvaluation("marposa", "mariposa", "approximate");
assertEvaluation("maripisa", "mariposa", "approximate");
assertEvaluation("mariposal", "mariposa", "approximate");
assert.strictEqual(context.chunkMatches("marposa", "mariposa"), false);
assert.strictEqual(context.canAdvanceWithTranscript("marposa", "mariposa"), false);
assert.strictEqual(context.canAdvanceWithTranscript("mi mama me quiere", "mi"), true);
assert.strictEqual(context.canAdvanceWithTranscript("mi mama me quiere", "mama"), true);

const styles = fs.readFileSync("styles.css", "utf8");
assert.ok(styles.includes(".student-page .feedback-correct"));
assert.ok(styles.includes(".student-page .feedback-uncertain"));
assert.ok(styles.includes(".student-page .feedback-approximate"));
assert.ok(styles.includes(".student-page .feedback-incorrect"));

(async () => {
  const flushAsync = async (times = 8) => {
    for (let index = 0; index < times; index += 1) await Promise.resolve();
  };

  const continueBtn = elements.get("#continue-btn");
  const statusEl = elements.get("#mic-status");
  const missionCard = elements.get("#mission-card");
  const calibrationScreen = elements.get("#calibration-screen");
  const calibrationSkipBtn = elements.get("#calibration-skip-btn");
  const calibrationTargetEl = elements.get("#calibration-target");
  const promptEl = elements.get("#prompt");

  context.createSession("Ana", "1A");
  assert.strictEqual(calibrationScreen.classList.contains("hidden"), false);
  await context.startListening();
  assert.strictEqual(getUserMediaCalls, 0);
  assert.strictEqual(recognitionInstances, 0);
  assert.strictEqual(calibrationScreen.classList.contains("hidden"), false);
  await Promise.all([context.startCalibration(), context.startCalibration()]);
  assert.strictEqual(getUserMediaCalls, 1);
  assert.strictEqual(recognitionInstances, 0);
  assert.notStrictEqual(calibrationTargetEl.textContent, "Silencio");
  calibrationSkipBtn.click();
  assert.strictEqual(calibrationScreen.classList.contains("hidden"), true);
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

  levelSelect.value = "shortSentences";
  context.setLesson("caballo perro");
  context.window.__lectovozVoiceGateOverrideMs = 0;
  context.window.__lectovozListeningGateOverrideMs = 500;
  context.processTranscript("capallo", 1, true);
  let pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.chunkAttempts[0].evaluationStatus, "approximate");
  assert.strictEqual(pedagogy.notMasteredChunks[0].evaluationStatus, "approximate");

  context.setLesson("caballo perro");
  context.window.__lectovozVoiceGateOverrideMs = 350;
  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.chunkAttempts[0].evaluationStatus, "approximate");
  assert.strictEqual(pedagogy.notMasteredChunks[0].evaluationStatus, "approximate");

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
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.chunkAttempts[0].evaluationStatus, "incorrect");

  const feedbackEl = elements.get("#feedback");
  const heardFeedbackEl = elements.get("#heard-feedback");
  const heardEl = elements.get("#heard-text");
  const scoreEl = elements.get("#score-count");
  levelSelect.value = "shortSentences";

  context.setLesson("casa gato");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  const scoreBeforeEmptyTranscript = Number(scoreEl.textContent || 0);
  context.processTranscript("", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.lastReadingDebug.evaluationStatus, "uncertain");
  assert.strictEqual(pedagogy.lastReadingDebug.uncertaintyReason, "empty_transcript");
  assert.strictEqual(feedbackEl.classList.contains("feedback-uncertain"), true);
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), false);
  assert.strictEqual(feedbackEl.textContent.includes("No pude escucharte con claridad."), true);
  assert.strictEqual(feedbackEl.textContent.includes("Escuch"), false);
  assert.strictEqual(heardFeedbackEl.hidden, true);
  assert.strictEqual(heardFeedbackEl.dataset.transcript, "");
  assert.strictEqual(Number(scoreEl.textContent), scoreBeforeEmptyTranscript);

  levelSelect.value = "shortSentences";
  context.setLesson("casa gato");
  context.window.__lectovozVoiceGateOverrideMs = 0;
  context.processTranscript("mesa", 1, true);
  context.flushPendingTranscript(true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.chunkAttempts[0].evaluationStatus, "incorrect");
  assert.strictEqual(feedbackEl.classList.contains("feedback-uncertain"), false);
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), true);
  assert.strictEqual(feedbackEl.textContent.includes("Escuch"), false);
  assert.strictEqual(heardFeedbackEl.hidden, true);

  context.setLesson("casa gato");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  lastRecognition.onerror({ error: "no-speech" });
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.lastReadingDebug.evaluationStatus, "uncertain");
  assert.strictEqual(pedagogy.lastReadingDebug.uncertaintyReason, "no_speech");
  assert.strictEqual(feedbackEl.classList.contains("feedback-uncertain"), true);
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), false);

  context.setLesson("casa gato");
  context.window.__lectovozVoiceGateOverrideMs = 0;
  context.processTranscript("", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.lastReadingDebug.evaluationStatus, "uncertain");
  assert.strictEqual(feedbackEl.classList.contains("feedback-uncertain"), true);
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), false);
  assert.strictEqual(feedbackEl.textContent.includes("Escuch"), false);
  assert.strictEqual(heardFeedbackEl.hidden, true);
  assert.strictEqual(heardFeedbackEl.dataset.transcript, "");

  levelSelect.value = "syllables";
  context.setLesson("poco gato");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("po po", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.chunkAttempts[0].heardText, "po po");
  assert.strictEqual(heardFeedbackEl.hidden, false);
  assert.strictEqual(heardFeedbackEl.dataset.transcript, "po po");

  levelSelect.value = "shortSentences";
  context.setLesson("caballo perro");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.chunkAttempts[0].evaluationStatus, "approximate");
  assert.strictEqual(pedagogy.chunkAttempts[0].heardText, "capallo");
  assert.strictEqual(pedagogy.notMasteredChunks[0].evaluationStatus, "approximate");
  assert.strictEqual(feedbackEl.classList.contains("feedback-approximate"), false);
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), true);
  assert.strictEqual(feedbackEl.textContent.includes("Escuch"), false);
  assert.strictEqual(heardFeedbackEl.hidden, true);
  assert.strictEqual(heardFeedbackEl.dataset.transcript, "");
  assert.strictEqual(feedbackEl.textContent.includes('Sigue con: "perro"'), true);

  levelSelect.value = "syllables";
  context.setLesson("casa");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("mesa", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 1);
  assert.strictEqual(pedagogy.chunkAttempts[0].evaluationStatus, "incorrect");
  assert.strictEqual(pedagogy.chunkAttempts[0].heardText, "mesa");
  assert.strictEqual(pedagogy.lastReadingDebug.evaluationStatus, "incorrect");
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), true);
  assert.strictEqual(feedbackEl.textContent.includes("Escuch"), false);
  assert.strictEqual(heardFeedbackEl.hidden, false);
  assert.strictEqual(heardFeedbackEl.dataset.transcript, "mesa");
  assert.strictEqual(feedbackEl.textContent.includes("Otra palabra"), true);
  assert.strictEqual(feedbackEl.textContent.includes('Intenta nuevamente: "casa"'), true);
  assert.strictEqual(heardEl.textContent, "mesa");

  levelSelect.value = "shortSentences";
  context.setLesson("ma me");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("pa", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.chunkAttempts[0].evaluationStatus, "incorrect");
  assert.strictEqual(pedagogy.chunkAttempts[0].heardText, "pa");
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), true);
  assert.strictEqual(heardFeedbackEl.hidden, true);
  assert.strictEqual(promptEl.querySelector('[data-index="0"]').classList.contains("error"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="1"]').classList.contains("current"), true);

  context.setLesson("ma me");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  const scoreBeforeCorrect = Number(scoreEl.textContent || 0);
  context.processTranscript("ma", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(Number(scoreEl.textContent), scoreBeforeCorrect + 10);
  assert.strictEqual(feedbackEl.classList.contains("feedback-correct"), true);
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), false);
  assert.strictEqual(heardFeedbackEl.hidden, true);
  assert.strictEqual(heardFeedbackEl.dataset.transcript, "");

  context.setLesson("pierna poco");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("pierna", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  const scoreAfterPiernaAdvance = Number(scoreEl.textContent || 0);
  context.processTranscript("pierna", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(Number(scoreEl.textContent), scoreAfterPiernaAdvance);
  assert.strictEqual(pedagogy.lastReadingDebug.evaluationStatus, "ignored_carryover");
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), false);
  assert.strictEqual(heardFeedbackEl.hidden, true);

  context.setLesson("pierna");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("pierna", 1, true);
  const recognitionBeforeSingleWordTransition = lastRecognition;
  context.setLesson("poco", { preserveAcceptedTranscript: true });
  assert.strictEqual(lastRecognition, recognitionBeforeSingleWordTransition);
  const scoreAfterSingleWordPierna = Number(scoreEl.textContent || 0);
  context.processTranscript("pierna", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(Number(scoreEl.textContent), scoreAfterSingleWordPierna);
  assert.strictEqual(pedagogy.lastReadingDebug.evaluationStatus, "ignored_carryover");
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), false);
  assert.strictEqual(heardFeedbackEl.hidden, true);

  context.setLesson("aguacate");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("aguacate", 1, true);
  context.setLesson("tostada", { preserveAcceptedTranscript: true });
  const scoreAfterAguacate = Number(scoreEl.textContent || 0);
  context.processTranscript("aguacate", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(Number(scoreEl.textContent), scoreAfterAguacate);
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), false);
  assert.strictEqual(heardFeedbackEl.hidden, true);

  levelSelect.value = "complexWords";
  context.setLesson("ventana");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("mapache", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 1);
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="0"]').classList.contains("error"), true);

  context.setLesson("ventana");
  context.window.__lectovozVoiceGateOverrideMs = 0;
  context.processTranscript("mapache", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 1);
  assert.strictEqual(pedagogy.chunkAttempts[0].evaluationStatus, "incorrect");
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="0"]').classList.contains("error"), true);

  context.setLesson("ventana");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("mapache", 1, false);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 1);
  assert.strictEqual(pedagogy.chunkAttempts[0].evaluationStatus, "incorrect");
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="0"]').classList.contains("error"), true);

  context.processTranscript("ventana", 1, true);
  context.setLesson("tostada", { preserveAcceptedTranscript: true });
  context.window.__lectovozVoiceGateOverrideMs = 0;
  context.processTranscript("ventana", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.lastReadingDebug.evaluationStatus, "ignored_carryover");
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), false);
  assert.strictEqual(heardFeedbackEl.hidden, true);

  levelSelect.value = "shortSentences";
  context.setLesson("pa me");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  const paWindow = context.getActiveListeningContext();
  const recognitionBeforePaAdvance = lastRecognition;
  const getUserMediaBeforePaAdvance = getUserMediaCalls;
  context.processTranscript("ma", 1, true, [], paWindow);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), true);
  assert.strictEqual(heardFeedbackEl.hidden, true);
  assert.strictEqual(promptEl.querySelector('[data-index="0"]').classList.contains("error"), true);
  context.processTranscript("pa", 1, true, [], paWindow);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(feedbackEl.classList.contains("feedback-correct"), false);
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), true);
  assert.strictEqual(heardFeedbackEl.hidden, true);
  assert.strictEqual(heardFeedbackEl.dataset.transcript, "");
  assert.strictEqual(lastRecognition, recognitionBeforePaAdvance);
  assert.strictEqual(recognitionBeforePaAdvance.abortCalls, 0);
  assert.strictEqual(getUserMediaCalls, getUserMediaBeforePaAdvance);
  const scoreAfterPaAdvance = Number(scoreEl.textContent || 0);
  const generationAfterPaAdvance = pedagogy.listeningGeneration;
  const feedbackAfterPaAdvance = feedbackEl.textContent;
  const heardAfterPaAdvance = heardFeedbackEl.dataset.transcript;
  context.processTranscript("pa", 1, true, [], paWindow);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.listeningGeneration, generationAfterPaAdvance);
  assert.strictEqual(Number(scoreEl.textContent), scoreAfterPaAdvance);
  assert.strictEqual(feedbackEl.textContent, feedbackAfterPaAdvance);
  assert.strictEqual(heardFeedbackEl.dataset.transcript, heardAfterPaAdvance);
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), true);

  context.setLesson("ma pa");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  const maWindow = context.getActiveListeningContext();
  context.processTranscript("ma", 1, true, [], maWindow);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  const scoreAfterMaAdvance = Number(scoreEl.textContent || 0);
  context.processTranscript("ma", 1, true, [], maWindow);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(Number(scoreEl.textContent), scoreAfterMaAdvance);
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), false);
  assert.strictEqual(heardFeedbackEl.hidden, true);
  lastRecognition.onresult({
    timeStamp: 0,
    resultIndex: 0,
    results: [{
      isFinal: true,
      0: { transcript: "ma", confidence: 1 },
      length: 1,
    }],
  });
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(Number(scoreEl.textContent), scoreAfterMaAdvance);
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), false);
  assert.strictEqual(heardFeedbackEl.hidden, true);
  assert.strictEqual(heardFeedbackEl.dataset.transcript, "");

  const paWindowAfterStale = context.getActiveListeningContext();
  const scoreBeforeValidPa = Number(scoreEl.textContent || 0);
  context.processTranscript("pa", 1, true, [], paWindowAfterStale);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(Number(scoreEl.textContent), scoreBeforeValidPa + 10);

  levelSelect.value = "shortSentences";
  context.setLesson("mi casa grande");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("mi", 1, true);
  context.processTranscript("perro", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 2);
  assert.strictEqual(pedagogy.notMasteredChunks.length, 1);
  assert.strictEqual(pedagogy.notMasteredChunks[0].expected, "casa");
  assert.strictEqual(pedagogy.notMasteredChunks[0].spoken, "perro");
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="1"]').classList.contains("error"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="2"]').classList.contains("current"), true);

  levelSelect.value = "shortSentences";
  context.setLesson("mi hermana toco la flauta");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("mi hermana toca", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 3);
  assert.strictEqual(promptEl.querySelector('[data-index="0"]').classList.contains("correct"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="1"]').classList.contains("correct"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="2"]').classList.contains("error"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="3"]').classList.contains("current"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="3"]').classList.contains("error"), false);
  context.processTranscript("mi hermana toca", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 3);
  assert.strictEqual(promptEl.querySelector('[data-index="3"]').classList.contains("current"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="3"]').classList.contains("error"), false);

  context.setLesson("mi hermana toco la flauta");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("mi hermana toca la", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 3);
  assert.strictEqual(promptEl.querySelector('[data-index="0"]').classList.contains("correct"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="1"]').classList.contains("correct"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="2"]').classList.contains("error"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="3"]').classList.contains("current"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="3"]').classList.contains("error"), false);
  assert.strictEqual(promptEl.querySelector('[data-index="4"]').classList.contains("error"), false);

  levelSelect.value = "shortSentences";
  context.setLesson("mi casa grande");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  const timeoutBeforeFullSentence = context.window.setTimeout;
  context.window.setTimeout = (callback, ms) => (ms === 900 ? 1 : timeoutBeforeFullSentence(callback, ms));
  context.processTranscript("mi perro grande", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.notMasteredChunks.length, 1);
  assert.strictEqual(pedagogy.notMasteredChunks[0].expected, "casa");
  assert.strictEqual(pedagogy.notMasteredChunks[0].spoken, "perro");
  assert.strictEqual(promptEl.querySelector('[data-index="0"]').classList.contains("correct"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="1"]').classList.contains("error"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="2"]').classList.contains("current"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="2"]').classList.contains("correct"), false);
  context.window.setTimeout = timeoutBeforeFullSentence;

  context.setLesson("luna brilla");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  const timeoutBeforeBufferedSentenceMiss = context.window.setTimeout;
  context.window.setTimeout = (callback, ms) => (ms === 450 ? 1 : timeoutBeforeBufferedSentenceMiss(callback, ms));
  context.processTranscript("manos", 1, false);
  assert.strictEqual(heardEl.textContent, "manos");
  context.window.__lectovozVoiceGateOverrideMs = 0;
  context.flushPendingTranscript(true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.notMasteredChunks.length, 1);
  assert.strictEqual(pedagogy.notMasteredChunks[0].expected, "luna");
  assert.strictEqual(pedagogy.notMasteredChunks[0].spoken, "manos");
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="0"]').classList.contains("error"), true);
  assert.strictEqual(promptEl.querySelector('[data-index="1"]').classList.contains("current"), true);
  context.window.setTimeout = timeoutBeforeBufferedSentenceMiss;

  context.setLesson("pa me");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  const realIncorrectWindow = context.getActiveListeningContext();
  context.processTranscript("mesa", 1, true, [], realIncorrectWindow);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.chunkAttempts[0].evaluationStatus, "incorrect");
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), true);
  assert.strictEqual(heardFeedbackEl.hidden, true);

  context.setLesson("pa me");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  const realUncertainWindow = context.getActiveListeningContext();
  context.processTranscript("", 1, true, [], realUncertainWindow);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.lastReadingDebug.evaluationStatus, "uncertain");
  assert.strictEqual(feedbackEl.classList.contains("feedback-uncertain"), true);
  assert.strictEqual(feedbackEl.classList.contains("feedback-incorrect"), false);
  assert.strictEqual(heardFeedbackEl.hidden, true);

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
  assert.strictEqual(pedagogy.currentIndex, 1);
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
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);

  levelSelect.value = "syllables";
  context.setLesson("caballo perro");
  context.window.__lectovozVoiceGateOverrideMs = 180;
  context.processTranscript("capallo", 1, true);
  context.processTranscript("caballo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.chunkAttempts.length, 1);
  assert.strictEqual(pedagogy.notMasteredChunks.length, 0);

  levelSelect.value = "syllables";
  context.setLesson("mariposa perro");
  context.processTranscript("marposa", 1, true);
  context.processTranscript("marposa", 1, true);
  context.processTranscript("marposa", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.attemptCount, 0);
  assert.strictEqual(pedagogy.notMasteredChunks[0].evaluationStatus, "approximate");
  assert.strictEqual(getUserMediaCalls, 1);
  assert.ok(recognitionInstances >= 1);

  context.createSession("Intentos uno", "1A");
  levelSelect.value = "syllables";
  context.setLesson("caballo perro");
  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 1);
  assert.strictEqual(pedagogy.notMasteredChunks[0].attempts, 1);

  context.createSession("Intentos dos", "1A");
  levelSelect.value = "syllables";
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
  levelSelect.value = "syllables";
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
  levelSelect.value = "syllables";
  context.setLesson("caballo perro");
  context.processTranscript("capallo", 1, true);
  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  context.processTranscript("capallo", 1, true);
  assert.strictEqual(context.getPedagogicalState().notMasteredChunks[0].attempts, 3);

  context.createSession("Intentos invalido", "1A");
  levelSelect.value = "syllables";
  context.setLesson("caballo perro");
  context.processTranscript("capallo", 1, true);
  context.processTranscript("capallo", 1, true);
  pedagogy = context.getPedagogicalState();
  assert.strictEqual(pedagogy.currentIndex, 0);
  context.processTranscript("capallo", 1, true);
  assert.strictEqual(context.getPedagogicalState().notMasteredChunks[0].attempts, 3);

  console.log(`Speech logic tests passed (${passedChecks} checks)`);
})();
