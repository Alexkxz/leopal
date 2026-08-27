const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

function createContext() {
  const store = new Map();
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
    window: {},
  };
  context.window.localStorage = context.localStorage;
  context.window.crypto = context.crypto;
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
loadScript(context, "modules/teacher-dashboard.js");
loadScript(context, "modules/teacher-control.js");

const storage = context.window.LectoVozStorage;
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

const config = control.makeDefaultConfig();
assert.strictEqual(config.levelStart, "silabas");
assert.strictEqual(config.sessionGoal, 10);
assert.strictEqual(config.consonants.length, context.window.LectoVozContent.defaultConsonants.length);

const student = control.createStudentRecord("Ana", "1A");
assert.strictEqual(student.id, "student-id");
assert.strictEqual(student.config.levelStart, "silabas");
assert.strictEqual(control.getSelectedStudent([student], "student-id"), student);
assert.strictEqual(control.replaceStudentConfig([student], "student-id", { sessionGoal: 5 })[0].config.sessionGoal, 5);
assertJson(control.deleteStudentById([student], "student-id"), []);

console.log("Module tests passed");
