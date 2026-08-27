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

function createContext() {
  const store = new Map();
  let now = 0;
  const context = {
    console,
    Intl,
    Date,
    localStorage: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
      removeItem(key) {
        store.delete(key);
      },
    },
    crypto: {
      randomUUID() {
        return "student-id";
      },
    },
    performance: {
      now() {
        now += 100;
        return now;
      },
    },
    Uint8Array,
    window: {},
  };
  context.window.localStorage = context.localStorage;
  context.window.crypto = context.crypto;
  context.window.performance = context.performance;
  context.window.setTimeout = (callback) => {
    callback();
    return 1;
  };
  context.window.cancelAnimationFrame = () => {};
  context.window.requestAnimationFrame = () => 1;
  return context;
}

function loadScript(context, path) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

const context = createContext();
vm.createContext(context);
loadScript(context, "modules/evaluation.js");
loadScript(context, "modules/content.js");
loadScript(context, "modules/storage.js");
loadScript(context, "modules/speech-recognition.js");
loadScript(context, "modules/teacher-dashboard.js");
loadScript(context, "modules/teacher-control.js");

const storage = context.window.LectoVozStorage;
const speech = context.window.LectoVozSpeech;
const dashboard = context.window.LectoVozTeacherDashboard;
const control = context.window.LectoVozTeacherControl;

function assertArray(actual, expected) {
  assert.deepStrictEqual(Array.from(actual), expected);
}

function assertJson(actual, expected) {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected);
}

storage.addPracticeRecord({ id: "old", group: "1A", errors: 2, accuracy: 80 });
storage.addPracticeRecord({ id: "new", group: "1B", errors: 0, accuracy: 100 });
assertArray(storage.getRecords().map((record) => record.id), ["new", "old"]);

storage.addPracticeRecord({ id: "kept" }, 2);
assertArray(storage.getRecords().map((record) => record.id), ["kept", "new"]);
storage.saveSession({ student: "Ana", group: "1A" });
assertJson(storage.getSession(), { student: "Ana", group: "1A" });
storage.clearSession();
assert.strictEqual(storage.getSession(), null);
storage.saveRecords([]);
assertJson(storage.getRecords(), []);

const records = [
  { group: "1B", errors: 1, accuracy: 90, student: "Ana", text: "ma", transcript: "ma" },
  { group: "1A", errors: 3, accuracy: 70, student: "Luis", text: "pa", transcript: "pa" },
];
assertArray(dashboard.getGroups(records), ["1A", "1B"]);
assertArray(dashboard.filterRecords(records, "1A").map((record) => record.student), ["Luis"]);
assertJson(dashboard.calculateSummary(records), {
  totalRecords: 2,
  averageAccuracy: 80,
  totalErrors: 4,
});
assert.ok(dashboard.escapeHtml('<script>"x"</script>').includes("&lt;script&gt;"));
assert.ok(dashboard.buildCsv([{ student: 'Ana "A"', text: "ma" }]).includes('"Ana ""A"""'));
assert.ok(dashboard.buildCsv([{ student: "Ana", transcript: "ma" }]).startsWith('"fecha","alumno","grupo"'));

const teacherControlHtml = fs.readFileSync("teacher-control.html", "utf8");
const teacherControlScript = fs.readFileSync("teacher-control.js", "utf8");
assert.ok(teacherControlHtml.includes('select id="max-attempts-per-chunk"'));
assert.ok(teacherControlHtml.includes('<option value="1">1 intento</option>'));
assert.ok(teacherControlHtml.includes('<option value="2">2 intentos</option>'));
assert.ok(teacherControlHtml.includes('<option value="3">3 intentos</option>'));
assert.ok(teacherControlScript.includes("TeacherControl.normalizeMaxAttemptsPerChunk(maxAttemptsPerChunk.value)"));

const config = control.makeDefaultConfig();
assert.strictEqual(config.levelStart, "silabas");
assert.strictEqual(config.sessionGoal, 10);
assert.strictEqual(config.maxAttemptsPerChunk, 3);
assert.strictEqual(config.consonants.length, context.window.LectoVozContent.defaultConsonants.length);
assert.strictEqual(control.normalizeMaxAttemptsPerChunk(1), 1);
assert.strictEqual(control.normalizeMaxAttemptsPerChunk(2), 2);
assert.strictEqual(control.normalizeMaxAttemptsPerChunk(3), 3);
assert.strictEqual(control.normalizeMaxAttemptsPerChunk(0), 3);
assert.strictEqual(control.normalizeMaxAttemptsPerChunk(4), 3);
assert.strictEqual(control.normalizeMaxAttemptsPerChunk("texto"), 3);
assert.strictEqual(control.normalizeMaxAttemptsPerChunk(null), 3);

const student = control.createStudentRecord("Ana", "1A");
assert.strictEqual(student.id, "student-id");
assert.strictEqual(student.config.levelStart, "silabas");
assert.strictEqual(student.config.maxAttemptsPerChunk, 3);
assert.strictEqual(control.getSelectedStudent([student], "student-id"), student);
const updatedStudent = control.replaceStudentConfig([student], "student-id", { sessionGoal: 5, maxAttemptsPerChunk: 2 })[0];
assert.strictEqual(updatedStudent.config.sessionGoal, 5);
assert.strictEqual(updatedStudent.config.maxAttemptsPerChunk, 2);
const normalizedStudent = control.replaceStudentConfig([student], "student-id", { ...student.config, maxAttemptsPerChunk: 9 })[0];
assert.strictEqual(normalizedStudent.config.maxAttemptsPerChunk, 3);
assertJson(control.deleteStudentById([student], "student-id"), []);

function createSpeechHarness(overrides = {}) {
  const events = [];
  const harness = {
    events,
    session: { student: "Ana", group: "1A" },
    currentChunk: "ma",
    transcriptCalls: [],
  };
  const options = {
    window: {
      setTimeout(callback) {
        events.push(["timeout"]);
        callback();
        return 1;
      },
      requestAnimationFrame() {
        events.push(["animation"]);
        return 1;
      },
      cancelAnimationFrame(id) {
        events.push(["cancelAnimation", id]);
      },
    },
    navigator: {},
    recognitionCtor: overrides.recognitionCtor,
    getCurrentSession: () => harness.session,
    getCurrentChunk: () => harness.currentChunk,
    processTranscript: (...args) => harness.transcriptCalls.push(args),
    onMissingSession: () => events.push(["missingSession"]),
    setFeedback: (value) => events.push(["feedback", value]),
    setStatus: (value, isListening) => events.push(["status", value, isListening]),
    setStartLabel: (value) => events.push(["label", value]),
    setNoiseLevel: (percent) => events.push(["noise", percent]),
    setVoiceLevel: (percent) => events.push(["voice", percent]),
  };

  if (overrides.navigator) options.navigator = overrides.navigator;
  if (overrides.window) options.window = { ...options.window, ...overrides.window };
  harness.controller = speech.createSpeechController(options);
  return harness;
}

function createFakeAudioContext(metrics = { closeCalls: 0 }) {
  const makeNode = () => ({
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
  });

  return function FakeAudioContext() {
    this.state = "running";
    this.resume = () => Promise.resolve();
    this.close = () => {
      metrics.closeCalls += 1;
      return Promise.resolve();
    };
    this.createBiquadFilter = makeNode;
    this.createDynamicsCompressor = makeNode;
    this.createGain = makeNode;
    this.createMediaStreamSource = makeNode;
    this.createAnalyser = () => ({
      fftSize: 512,
      smoothingTimeConstant: 0,
      connect() {},
      disconnect() {},
      getByteTimeDomainData(data) {
        data.fill(128);
      },
    });
  };
}

function createTrack() {
  return {
    stopped: false,
    stop() {
      this.stopped = true;
    },
  };
}

async function runSpeechControllerTests() {
  const missingSession = createSpeechHarness({ recognitionCtor: function Recognition() {} });
  missingSession.session = null;
  await missingSession.controller.start();
  assertJson(missingSession.events, [["missingSession"]]);
  assert.strictEqual(missingSession.controller.isListening(), false);

  const unsupported = createSpeechHarness({ recognitionCtor: null });
  await unsupported.controller.start();
  assert.ok(unsupported.events.some((event) => event[0] === "feedback" && event[1].includes("no soporta reconocimiento")));
  assert.strictEqual(unsupported.controller.isListening(), false);

  const audioMetrics = { closeCalls: 0 };
  context.window.AudioContext = createFakeAudioContext(audioMetrics);
  const denied = createSpeechHarness({
    recognitionCtor: function Recognition() {},
    navigator: {
      mediaDevices: {
        getUserMedia() {
          return Promise.reject(new Error("Permission denied"));
        },
      },
    },
  });
  await denied.controller.start();
  assert.ok(denied.events.some((event) => event[0] === "feedback" && event[1].includes("Necesitamos el microfono")));
  assert.strictEqual(denied.controller.isListening(), false);

  let recognitionInstance;
  let recognitionInstances = 0;
  function FakeRecognition() {
    recognitionInstance = this;
    recognitionInstances += 1;
    this.startCalls = 0;
    this.stopCalls = 0;
    this.continuous = false;
  }
  FakeRecognition.prototype.start = function start() {
    this.startCalls += 1;
    if (this.startCalls > 1) {
      const error = new Error("already started");
      error.name = "InvalidStateError";
      throw error;
    }
  };
  FakeRecognition.prototype.stop = function stop() {
    this.stopCalls += 1;
    if (this.stopCalls > 1) {
      const error = new Error("already stopped");
      error.name = "InvalidStateError";
      throw error;
    }
  };

  const track = createTrack();
  let getUserMediaCalls = 0;
  const controllerHarness = createSpeechHarness({
    recognitionCtor: FakeRecognition,
    navigator: {
      mediaDevices: {
        getUserMedia() {
          getUserMediaCalls += 1;
          return Promise.resolve({ getTracks: () => [track] });
        },
      },
    },
  });
  await controllerHarness.controller.start();
  assert.strictEqual(controllerHarness.controller.isListening(), true);
  assert.strictEqual(controllerHarness.controller.getState(), "listening");
  assert.strictEqual(getUserMediaCalls, 1);
  assert.strictEqual(recognitionInstances, 1);
  await controllerHarness.controller.start();
  assert.strictEqual(getUserMediaCalls, 1);
  assert.strictEqual(recognitionInstances, 1);
  assert.strictEqual(recognitionInstance.continuous, true);
  controllerHarness.controller.stop();
  controllerHarness.controller.stop();
  assert.strictEqual(controllerHarness.controller.isListening(), false);
  assert.strictEqual(track.stopped, false);
  assert.strictEqual(audioMetrics.closeCalls, 0);
  assert.ok(controllerHarness.events.some((event) => event[0] === "status" && event[1] === "Microfono listo"));

  await controllerHarness.controller.start();
  recognitionInstance.onerror({ error: "no-speech" });
  assert.ok(controllerHarness.events.some((event) => event[0] === "feedback" && event[1].includes("Sigo escuchando")));
  recognitionInstance.onerror({ error: "network" });
  assert.ok(controllerHarness.events.some((event) => event[0] === "status" && event[1] === "Reintentando microfono"));
  recognitionInstance.onerror({ error: "aborted" });
  recognitionInstance.onend();
  assert.ok(recognitionInstance.startCalls >= 2);
  controllerHarness.controller.close();
  assert.strictEqual(controllerHarness.controller.isListening(), false);
  assert.strictEqual(controllerHarness.controller.getState(), "stopped");
  assert.strictEqual(track.stopped, true);
  assert.strictEqual(audioMetrics.closeCalls, 1);
  const callsAfterClose = recognitionInstance.startCalls;
  recognitionInstance.onend();
  assert.strictEqual(recognitionInstance.startCalls, callsAfterClose);

  const unavailable = createSpeechHarness({
    recognitionCtor: function Recognition() {},
    navigator: {},
  });
  await unavailable.controller.start();
  assert.ok(unavailable.events.some((event) => event[0] === "feedback" && event[1].includes("microfono no esta disponible")));
}

runSpeechControllerTests().then(() => {
  console.log(`Module tests passed (${passedChecks} checks)`);
});
