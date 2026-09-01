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
loadScript(context, "modules/academic-structure.js");
loadScript(context, "modules/storage.js");
loadScript(context, "modules/json-backup.js");
loadScript(context, "modules/speech-recognition.js");
loadScript(context, "modules/teacher-dashboard.js");
loadScript(context, "modules/teacher-control.js");
loadScript(context, "modules/mic-diagnostic.js");
loadScript(context, "modules/offline-audio-analyzer.js");

const storage = context.window.LectoVozStorage;
const academic = context.window.LectoVozAcademic;
const jsonBackup = context.window.LectoVozJsonBackup;
const speech = context.window.LectoVozSpeech;
const dashboard = context.window.LectoVozTeacherDashboard;
const control = context.window.LectoVozTeacherControl;
const micDiagnostic = context.window.LectoVozMicDiagnostic;
const offlineAnalyzer = context.window.LectoVozOfflineAudioAnalyzer;
const content = context.window.LectoVozContent;

function assertArray(actual, expected) {
  assert.deepStrictEqual(Array.from(actual), expected);
}

function assertJson(actual, expected) {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)));
}

assertArray(Object.keys(content.contentTree), ["syllables", "words", "sentences"]);
assert.strictEqual(Object.keys(content.contentTree.syllables.sublevels).length, 2);
assert.strictEqual(Object.keys(content.contentTree.words.sublevels).length, 2);
assert.strictEqual(Object.keys(content.contentTree.sentences.sublevels).length, 2);
assert.strictEqual(content.lessons.syllables.length, 19);
assert.strictEqual(content.lessons.segmentedWords.length >= 60, true);
assert.strictEqual(content.lessons.simpleWords.length >= 80, true);
assert.strictEqual(content.lessons.complexWords.length >= 80, true);
assert.strictEqual(content.lessons.shortSentences.length >= 40, true);
assert.strictEqual(content.lessons.longSentences.length >= 40, true);
const segmentedCamioneta = content.lessons.segmentedWords.find((item) => item.expectedText === "camioneta");
assert.strictEqual(segmentedCamioneta.displayText, "ca-mio-ne-ta");
assert.strictEqual(segmentedCamioneta.expectedText, "camioneta");
assert.strictEqual(content.normalizeLevelId("palabras_largas"), "complexWords");
assert.strictEqual(content.normalizeLevelId("frases_cortas"), "shortSentences");

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

assert.strictEqual(micDiagnostic.TEST_ITEMS.length, 33);
assertJson(micDiagnostic.GATES_MS, [80, 100, 120, 150, 180]);
assert.strictEqual(micDiagnostic.average([80, 100, 120]), 100);
assert.strictEqual(micDiagnostic.median([180, 80, 120]), 120);
assert.strictEqual(micDiagnostic.median([80, 100, 120, 150]), 110);
const diagnosticAttempt = micDiagnostic.createAttempt("ma", 180, 100);
micDiagnostic.applyMetrics(diagnosticAttempt, {
  currentVolume: 0.08,
  noiseFloor: 0.02,
  voiceEvidenceDuration: 150,
  voiceStartThreshold: 0.03,
  voiceStopThreshold: 0.025,
  minVoiceEvidenceMs: 180,
  isVoiceActive: true,
}, "listening");
micDiagnostic.applyTranscript(diagnosticAttempt, "mas", 0.8, true, ["ma"], 520);
micDiagnostic.finalizeAttempt(diagnosticAttempt, 540);
assert.strictEqual(diagnosticAttempt.gate.passed, false);
assert.strictEqual(diagnosticAttempt.possibleFalseRejection, true);
assert.strictEqual(diagnosticAttempt.evaluation.status, "correct");
assert.ok(diagnosticAttempt.classification.includes("possible_false_rejection"));
const diagnosticSummary = micDiagnostic.calculateSummary([diagnosticAttempt]);
assert.strictEqual(diagnosticSummary[80].falseRejections, 0);
assert.strictEqual(diagnosticSummary[180].falseRejections, 1);
assert.strictEqual(diagnosticSummary[180].attempts, 1);
assert.strictEqual(diagnosticSummary[180].voiceDetected, 1);
assert.strictEqual(diagnosticSummary[180].transcriptReceived, 1);
assert.strictEqual(diagnosticSummary[180].correct, 1);
assert.strictEqual(diagnosticSummary[180].averageVoiceEvidenceMs, 150);
assert.strictEqual(diagnosticSummary[180].medianVoiceEvidenceMs, 150);
assert.strictEqual(diagnosticSummary[180].averageLatencyMs, 420);
const exportPayload = micDiagnostic.buildExportPayload([diagnosticAttempt], { selectedGateMs: 180 }, { userAgent: "Test Browser" });
assert.strictEqual(exportPayload.format, "lectovoz-mic-diagnostic");
assert.strictEqual(exportPayload.version, 1);
assert.strictEqual(exportPayload.userAgent, "Test Browser");
assert.strictEqual(exportPayload.configuration.selectedGateMs, 180);
assert.strictEqual(exportPayload.attempts.length, 1);

assertJson(offlineAnalyzer.GATES_MS, [80, 100, 120, 150, 180]);
assert.strictEqual(offlineAnalyzer.average([80, 100, 120]), 100);
assert.strictEqual(offlineAnalyzer.median([80, 120, 100]), 100);
assert.strictEqual(offlineAnalyzer.percentile([100, 200, 300], 0.25), 150);
assert.strictEqual(offlineAnalyzer.isAudioPath("voz.webm"), true);
assert.strictEqual(offlineAnalyzer.isAudioPath("metadata.json"), false);
const offlineDatasetInfo = offlineAnalyzer.collectDatasetInfo([
  {
    zipName: "leopal_muestras_Ana_2026-05-20.zip",
    metadata: {
      alumno: { nombre: "Ana" },
      grabaciones: [
        { archivo: "Ana_ma_r1.webm", palabra: "ma", repeticion: 1 },
        { archivo: "Ana_ma_r2.webm", palabra: "ma", repeticion: 2 },
      ],
    },
    audioEntries: [{ name: "Ana_ma_r1.webm" }, { name: "Ana_ma_r2.webm" }],
  },
]);
assert.strictEqual(offlineDatasetInfo.zipFiles, 1);
assert.strictEqual(offlineDatasetInfo.students, 1);
assert.strictEqual(offlineDatasetInfo.audioFiles, 2);
assert.strictEqual(offlineDatasetInfo.metadataValid, 1);
assert.strictEqual(offlineDatasetInfo.repetitions, 2);
assert.strictEqual(offlineDatasetInfo.uniqueExpectedWords, 1);
const syntheticSamples = new Float32Array(24000);
for (let index = 4800; index < 19200; index += 1) syntheticSamples[index] = 0.08;
const sampleMetrics = offlineAnalyzer.analyzeSamples(syntheticSamples, 48000);
assert.ok(sampleMetrics.voiceDurationMs >= 200);
assert.ok(sampleMetrics.snr > 1);
assert.ok(sampleMetrics.voiceAttackMs >= 20);
const offlineAttempts = offlineAnalyzer.attachOutliers([
  { datasetId: "ana:uno", studentName: "Ana", zipName: "a.zip", fileName: "a.webm", voiceDurationMs: 90, rms: 0.04, noiseFloor: 0.01, snr: 4, snrDb: 12, peakVolume: 0.2, voiceAttackMs: 30 },
  { datasetId: "ana:uno", studentName: "Ana", zipName: "a.zip", fileName: "b.webm", voiceDurationMs: 130, rms: 0.04, noiseFloor: 0.01, snr: 4, snrDb: 12, peakVolume: 0.2, voiceAttackMs: 30 },
  { datasetId: "luis:uno", studentName: "Luis", zipName: "l.zip", fileName: "c.webm", voiceDurationMs: 220, rms: 0.05, noiseFloor: 0.01, snr: 5, snrDb: 14, peakVolume: 0.25, voiceAttackMs: 40 },
  { datasetId: "luis:uno", studentName: "Luis", zipName: "l.zip", fileName: "d.webm", voiceDurationMs: 240, rms: 0.001, noiseFloor: 0.01, snr: 0.5, snrDb: -6, peakVolume: 0.002, voiceAttackMs: null },
]);
assert.ok(offlineAttempts[3].isTechnicalOutlier);
const offlineByStudent = offlineAnalyzer.summarizeByStudent(offlineAttempts);
assert.strictEqual(offlineByStudent["ana:uno"].audioFiles, 2);
assert.strictEqual(offlineByStudent["ana:uno"].gates[120].accepted, 1);
assert.strictEqual(offlineByStudent["luis:uno"].gates[180].accepted, 2);
const offlineBetween = offlineAnalyzer.compareStudents(offlineByStudent);
assert.strictEqual(offlineBetween.lowestMedianVoiceStudent, "Ana");
assert.strictEqual(offlineBetween.highestMedianVoiceStudent, "Luis");
const offlineGateRows = offlineAnalyzer.summarizeGates(offlineAttempts, offlineByStudent);
assert.strictEqual(offlineGateRows.find((row) => row.gate === 180).worstStudent, "Ana");
const offlineAnalysis = offlineAnalyzer.buildAnalysis(offlineAttempts, offlineDatasetInfo, []);
assert.strictEqual(offlineAnalysis.format, "lectovoz-offline-audio-analysis");
assert.strictEqual(offlineAnalysis.dataset.validAudioFiles, 4);
assert.strictEqual(offlineAnalysis.outliers.length >= 1, true);
assert.strictEqual(Number.isFinite(offlineAnalysis.gates[0].globalAcceptanceRate), true);
assert.strictEqual(offlineAnalysis.recommendation.gate !== null, true);

const teacherControlHtml = fs.readFileSync("teacher-control.html", "utf8");
const teacherControlScript = fs.readFileSync("teacher-control.js", "utf8");
assert.ok(teacherControlHtml.includes("CENTRO DE CONTROL"));
assert.ok(teacherControlHtml.includes("data-tab=\"players\""));
assert.ok(teacherControlHtml.includes("data-tab=\"missions\""));
assert.ok(teacherControlHtml.includes("data-tab=\"progress\""));
assert.ok(teacherControlHtml.includes("id=\"student-search\""));
assert.ok(teacherControlHtml.includes("id=\"category-card-grid\""));
assert.ok(teacherControlHtml.includes("id=\"sublevel-grid\""));
assert.ok(teacherControlHtml.includes("id=\"bulk-student-list\""));
assert.ok(teacherControlHtml.includes("RESPALDO DE DATOS"));
assert.ok(teacherControlHtml.includes('select id="max-attempts-per-chunk"'));
assert.ok(teacherControlHtml.includes('<option value="1">1 intento</option>'));
assert.ok(teacherControlHtml.includes('<option value="2">2 intentos</option>'));
assert.ok(teacherControlHtml.includes('<option value="3">3 intentos</option>'));
assert.ok(teacherControlScript.includes("TeacherControl.normalizeMaxAttemptsPerChunk(maxAttemptsPerChunk.value)"));
assert.ok(teacherControlScript.includes("normalizeComparable(student.name).includes(studentFilter)"));
assert.ok(teacherControlScript.includes("shouldShowConsonants()"));
assert.ok(teacherControlScript.includes("replaceManyStudentConfigs"));

let schoolResult = academic.createSchool([], " Escuela Primaria Ignacio Allende ");
assert.strictEqual(schoolResult.success, true);
assert.strictEqual(schoolResult.school.name, "Escuela Primaria Ignacio Allende");
assert.strictEqual(academic.createSchool(schoolResult.schools, "  ").reason, "school_name_required");
assert.strictEqual(academic.createSchool(schoolResult.schools, "escuela primaria ignacio allende").reason, "duplicate_school_name");
const secondSchoolResult = academic.createSchool(schoolResult.schools, "Escuela Benito Juarez");
assert.strictEqual(secondSchoolResult.success, true);
assert.ok(secondSchoolResult.schools[0].id !== secondSchoolResult.schools[1].id);
const editedSchoolResult = academic.editSchool(secondSchoolResult.schools, schoolResult.school.id, { name: "Primaria Ignacio Allende" });
assert.strictEqual(editedSchoolResult.success, true);
assert.strictEqual(editedSchoolResult.school.id, schoolResult.school.id);
assert.strictEqual(academic.listSchools(editedSchoolResult.schools).length, 2);
assert.strictEqual(academic.getSchoolById(editedSchoolResult.schools, schoolResult.school.id).name, "Primaria Ignacio Allende");

const firstStudentResult = academic.createStudent([], editedSchoolResult.schools, {
  name: "Ana",
  schoolId: schoolResult.school.id,
  grade: "3",
  group: "A",
  config: { sessionGoal: 8, maxAttemptsPerChunk: 2, notes: "conservar" },
});
assert.strictEqual(firstStudentResult.success, true);
assert.strictEqual(firstStudentResult.student.config.maxAttemptsPerChunk, 2);
assert.strictEqual(firstStudentResult.student.config.notes, "conservar");
const secondStudentResult = academic.createStudent(firstStudentResult.students, editedSchoolResult.schools, {
  name: "Ana",
  schoolId: schoolResult.school.id,
  grade: "3",
  group: "Multigrado",
  config: { maxAttemptsPerChunk: 9 },
});
assert.strictEqual(secondStudentResult.success, true);
assert.ok(secondStudentResult.students[0].id !== secondStudentResult.students[1].id);
assert.strictEqual(secondStudentResult.students[1].config.maxAttemptsPerChunk, 3);
assert.strictEqual(academic.filterStudentsBySchool(secondStudentResult.students, schoolResult.school.id).length, 2);
assert.strictEqual(academic.filterStudentsByGrade(secondStudentResult.students, "3").length, 2);
assert.strictEqual(academic.filterStudentsByGroup(secondStudentResult.students, " multigrado ").length, 1);
const editedStudentResult = academic.editStudent(secondStudentResult.students, editedSchoolResult.schools, firstStudentResult.student.id, { grade: "4", group: "3A" });
assert.strictEqual(editedStudentResult.success, true);
assert.strictEqual(academic.getStudentById(editedStudentResult.students, firstStudentResult.student.id).grade, "4");
assert.strictEqual(academic.deleteSchool(editedSchoolResult.schools, schoolResult.school.id, editedStudentResult.students).reason, "school_has_students");
const deletedStudentResult = academic.deleteStudent(editedStudentResult.students, firstStudentResult.student.id);
assert.strictEqual(deletedStudentResult.success, true);
assert.strictEqual(deletedStudentResult.students.length, 1);

const migrated = academic.migrateAcademicData({
  schools: [],
  students: [{ name: "Ana", group: "3A", config: { sessionGoal: 6, maxAttemptsPerChunk: 2, notes: "vieja" } }],
});
assert.strictEqual(migrated.version, academic.storageSchemaVersion);
assert.strictEqual(migrated.schools.length, 1);
assert.strictEqual(migrated.schools[0].name, academic.defaultSchoolName);
assert.strictEqual(migrated.students[0].name, "Ana");
assert.strictEqual(migrated.students[0].group, "3A");
assert.strictEqual(migrated.students[0].grade, academic.defaultGrade);
assert.ok(migrated.students[0].id.length > 0);
assert.strictEqual(migrated.students[0].schoolId, academic.defaultSchoolId);
assert.strictEqual(migrated.students[0].config.sessionGoal, 6);
assert.strictEqual(migrated.students[0].config.maxAttemptsPerChunk, 2);
assertJson(academic.migrateAcademicData(migrated), migrated);
const migratedWithExistingDefault = academic.migrateAcademicData({
  schools: [{ id: "custom-default", name: " sin escuela " }],
  students: [{ name: "Luis", group: "A" }],
});
assert.strictEqual(migratedWithExistingDefault.schools.length, 1);
assert.strictEqual(migratedWithExistingDefault.students[0].schoolId, "custom-default");

storage.saveSchools([]);
storage.writeJson(storage.storageKeys.students, [{ name: "Ana", group: "3A", config: { sessionGoal: 5, maxAttemptsPerChunk: 2 } }]);
const storedMigratedStudents = storage.getStudents();
assert.strictEqual(storage.getSchools().length, 1);
assert.strictEqual(storedMigratedStudents[0].schoolId, academic.defaultSchoolId);
assert.strictEqual(storedMigratedStudents[0].grade, academic.defaultGrade);
assert.strictEqual(storedMigratedStudents[0].config.maxAttemptsPerChunk, 2);
assertJson(storage.getStudents(), storedMigratedStudents);

storage.saveRecords([
  { id: "new-record", studentId: storedMigratedStudents[0].id, student: "Ana", schoolId: academic.defaultSchoolId, grade: "3", group: "3A", chunkAttempts: [{ expected: "ma" }], notMasteredChunks: [{ expected: "pa" }] },
  { id: "legacy-record", student: "Luis", group: "A", chunkAttempts: [{ expected: "la" }], notMasteredChunks: [{ expected: "sa" }] },
]);
const storedRecords = storage.getRecords();
assert.strictEqual(storedRecords[0].studentId, storedMigratedStudents[0].id);
assert.strictEqual(storedRecords[1].student, "Luis");
assert.strictEqual(storedRecords[0].chunkAttempts.length, 1);
assert.strictEqual(storedRecords[0].notMasteredChunks.length, 1);
assert.strictEqual(storedRecords[1].chunkAttempts.length, 1);
assert.strictEqual(storedRecords[1].notMasteredChunks.length, 1);
const exportBefore = JSON.stringify({
  schools: storage.getSchools(),
  students: storage.getStudents(),
  records: storage.getRecords(),
});
const exported = storage.exportLocalData();
assert.strictEqual(exported.version, academic.storageSchemaVersion);
assert.ok(exported.exportedAt.length > 0);
assert.strictEqual(exported.schools.length, 1);
assert.strictEqual(exported.students.length, 1);
assert.strictEqual(exported.records.length, 2);
assert.strictEqual(JSON.stringify({
  schools: storage.getSchools(),
  students: storage.getStudents(),
  records: storage.getRecords(),
}), exportBefore);

const backupData = jsonBackup.buildBackupData();
assert.strictEqual(backupData.format, "lectovoz-backup");
assert.strictEqual(backupData.version, 1);
assert.strictEqual(backupData.storageSchemaVersion, academic.storageSchemaVersion);
assert.ok(backupData.exportedAt.length > 0);
assert.strictEqual(Array.isArray(backupData.schools), true);
assert.strictEqual(Array.isArray(backupData.students), true);
assert.strictEqual(Array.isArray(backupData.records), true);
assert.strictEqual(jsonBackup.validateBackupData(backupData).valid, true);
assert.strictEqual(jsonBackup.parseBackupJson("{").reason, "invalid_backup_file");
assert.strictEqual(jsonBackup.validateBackupData({ ...backupData, format: "other" }).reason, "invalid_backup_format");
assert.strictEqual(jsonBackup.validateBackupData({ ...backupData, version: 99 }).reason, "unsupported_backup_version");
assert.strictEqual(jsonBackup.validateBackupData({ ...backupData, schools: {} }).reason, "invalid_schools");
assert.strictEqual(jsonBackup.validateBackupData({ ...backupData, students: {} }).reason, "invalid_students");
assert.strictEqual(jsonBackup.validateBackupData({ ...backupData, records: {} }).reason, "invalid_records");
assert.strictEqual(jsonBackup.validateBackupData({ ...backupData, schools: [{ id: "x" }] }).reason, "invalid_schools");

const beforeInvalidImport = JSON.stringify({
  schools: storage.getSchools(),
  students: storage.getStudents(),
  records: storage.getRecords(),
});
assert.strictEqual(jsonBackup.importBackupJson({ ...backupData, format: "bad" }).success, false);
assert.strictEqual(JSON.stringify({
  schools: storage.getSchools(),
  students: storage.getStudents(),
  records: storage.getRecords(),
}), beforeInvalidImport);

const validImport = {
  format: "lectovoz-backup",
  version: 1,
  storageSchemaVersion: 2,
  exportedAt: "2026-01-01T00:00:00.000Z",
  schools: [{ id: "school-a", name: "Escuela A", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
  students: [{ id: "student-a", name: "Ana", schoolId: "school-a", grade: "2", group: "A", config: { sessionGoal: 7, maxAttemptsPerChunk: 2 } }],
  records: [{ id: "record-a", studentId: "student-a", student: "Ana", schoolId: "school-a", grade: "2", group: "A", chunkAttempts: [{ expected: "ma" }], notMasteredChunks: [{ expected: "pa" }], createdAt: "2026-01-01T00:00:00.000Z" }],
};
assert.strictEqual(jsonBackup.importBackupJson(JSON.stringify(validImport), "replace").success, true);
assert.strictEqual(storage.getSchools().some((school) => school.id === "school-a"), true);
assert.strictEqual(storage.getStudents().find((item) => item.id === "student-a").config.maxAttemptsPerChunk, 2);
assert.strictEqual(storage.getRecords()[0].chunkAttempts.length, 1);
assert.strictEqual(storage.getRecords()[0].notMasteredChunks.length, 1);

storage.writeJson("unrelated_key", { keep: true });
const replaceImport = {
  ...validImport,
  schools: [{ id: "school-b", name: "Escuela B", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" }],
  students: [{ id: "student-b", name: "Luis", schoolId: "school-b", grade: "4", group: "B", config: { maxAttemptsPerChunk: 3 } }],
  records: [{ id: "record-b", studentId: "student-b", student: "Luis", createdAt: "2026-01-02T00:00:00.000Z" }],
};
assert.strictEqual(jsonBackup.replaceLocalData(replaceImport).success, true);
assert.strictEqual(storage.getStudents().some((item) => item.id === "student-a"), false);
assert.strictEqual(storage.getStudents().some((item) => item.id === "student-b"), true);
assertJson(storage.readJson("unrelated_key", null), { keep: true });

const mergeImport = {
  ...validImport,
  schools: [
    { id: "school-b", name: "Escuela B", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-03T00:00:00.000Z" },
    { id: "school-b-duplicate", name: " escuela b ", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  ],
  students: [
    { id: "student-b", name: "Luis editado", schoolId: "school-b", grade: "5", group: "B", updatedAt: "2026-01-03T00:00:00.000Z", config: { maxAttemptsPerChunk: 1 } },
    { id: "student-c", name: "Luis", schoolId: "school-b-duplicate", grade: "5", group: "B", config: { maxAttemptsPerChunk: 2 } },
  ],
  records: [
    { id: "record-b", studentId: "student-b", student: "Luis", createdAt: "2026-01-02T00:00:00.000Z" },
    { studentId: "student-c", student: "Luis", text: "ma", level: "silabas", createdAt: "2026-01-03T00:00:00.000Z" },
  ],
};
assert.strictEqual(jsonBackup.mergeBackupData(mergeImport).success, true);
const schoolsAfterMerge = storage.getSchools().filter((school) => academic.normalizeComparable(school.name) === academic.normalizeComparable("Escuela B"));
assert.strictEqual(schoolsAfterMerge.length, 1);
assert.strictEqual(storage.getStudents().filter((item) => item.id === "student-b").length, 1);
assert.strictEqual(storage.getStudents().some((item) => item.id === "student-c" && item.name === "Luis"), true);
assert.strictEqual(storage.getRecords().filter((record) => record.id === "record-b").length, 1);
const mergeSnapshot = JSON.stringify({
  schools: storage.getSchools(),
  students: storage.getStudents(),
  records: storage.getRecords(),
});
assert.strictEqual(jsonBackup.mergeBackupData(mergeImport).success, true);
assert.strictEqual(JSON.stringify({
  schools: storage.getSchools(),
  students: storage.getStudents(),
  records: storage.getRecords(),
}), mergeSnapshot);

const fallbackExport = jsonBackup.exportBackupJson();
assert.strictEqual(fallbackExport.success, true);
assert.strictEqual(fallbackExport.filename, "lectovoz-datos.json");
assert.ok(["json", "download"].includes(fallbackExport.method));

const config = control.makeDefaultConfig();
assert.strictEqual(config.levelStart, "syllables");
assert.strictEqual(config.category, "syllables");
assert.strictEqual(config.sublevel, "syllables");
assert.strictEqual(config.sessionGoal, 10);
assert.strictEqual(config.maxAttemptsPerChunk, 3);
assert.strictEqual(config.isConfigured, false);
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
assert.strictEqual(student.config.levelStart, "syllables");
assert.strictEqual(student.config.isConfigured, false);
assert.strictEqual(student.config.maxAttemptsPerChunk, 3);
assert.strictEqual(control.getSelectedStudent([student], "student-id"), student);
const updatedStudent = control.replaceStudentConfig([student], "student-id", { sessionGoal: 5, maxAttemptsPerChunk: 2 })[0];
assert.strictEqual(updatedStudent.config.sessionGoal, 5);
assert.strictEqual(updatedStudent.config.maxAttemptsPerChunk, 2);
assert.strictEqual(updatedStudent.config.isConfigured, true);
assert.ok(updatedStudent.config.updatedAt.length > 0);
assert.strictEqual(control.replaceStudentConfig([student], "student-id", { levelStart: "frases_largas" })[0].config.levelStart, "longSentences");
const normalizedStudent = control.replaceStudentConfig([student], "student-id", { ...student.config, maxAttemptsPerChunk: 9 })[0];
assert.strictEqual(normalizedStudent.config.maxAttemptsPerChunk, 3);
assertJson(control.deleteStudentById([student], "student-id"), []);
assert.strictEqual(control.getCategoryLabel("syllables"), "SILABAS");
assert.strictEqual(control.getCategoryLabel("words"), "PALABRAS");
assert.strictEqual(control.getCategoryLabel("sentences"), "ORACIONES");
assert.strictEqual(control.getLevelLabel("segmentedWords"), "Palabras silabeadas");
assert.strictEqual(control.getLevelLabel("simpleWords"), "Simples");
assert.strictEqual(control.getLevelLabel("complexWords"), "Complejas");
assert.strictEqual(control.getLevelLabel("shortSentences"), "Cortas");
assert.strictEqual(control.getLevelLabel("longSentences"), "Amplias");
assert.strictEqual(context.window.LectoVozContent.getLevelDefinition("syllables").category, "syllables");
assert.strictEqual(context.window.LectoVozContent.getLevelDefinition("segmentedWords").category, "syllables");
assert.strictEqual(context.window.LectoVozContent.getLevelDefinition("simpleWords").category, "words");
assert.strictEqual(context.window.LectoVozContent.getLevelDefinition("complexWords").category, "words");
assert.strictEqual(context.window.LectoVozContent.getLevelDefinition("shortSentences").category, "sentences");
assert.strictEqual(context.window.LectoVozContent.getLevelDefinition("longSentences").category, "sentences");

const unconfiguredStudent = { ...student, config: { ...student.config, isConfigured: false } };
const readyStudent = { ...student, id: "ready", config: { ...student.config, isConfigured: true } };
const progressStudent = { ...student, id: "progress" };
const progressRecords = [
  {
    studentId: "progress",
    student: "Ana",
    group: "1A",
    level: "simpleWords",
    accuracy: 82,
    correct: 34,
    errors: 6,
    chunkAttempts: [
      { evaluation: { status: "correct" } },
      { evaluation: { status: "approximate" } },
      { evaluation: { status: "incorrect" } },
      { evaluation: { status: "uncertain" } },
    ],
    notMasteredChunks: [{ expected: "tra" }, { expected: "pla" }],
  },
];
assert.strictEqual(control.getStudentStatus(unconfiguredStudent, []).label, "SIN CONFIGURAR");
assert.strictEqual(control.getStudentStatus(readyStudent, []).label, "LISTO");
assert.strictEqual(control.getStudentStatus(progressStudent, progressRecords).label, "EN PROGRESO");
const progressSummary = control.summarizeStudentProgress(progressStudent, progressRecords);
assert.strictEqual(progressSummary.accuracy, 82);
assert.strictEqual(progressSummary.correct, 34);
assert.strictEqual(progressSummary.approximate, 1);
assert.strictEqual(progressSummary.incorrect, 6);
assert.strictEqual(progressSummary.unevaluated, 0);
assertArray(progressSummary.weakChunks, ["tra", "pla"]);
assertJson(control.summarizeGroup([unconfiguredStudent, readyStudent, progressStudent], progressRecords), {
  total: 3,
  ready: 1,
  progress: 1,
  unconfigured: 1,
});
const bulkConfigured = control.replaceManyStudentConfigs([unconfiguredStudent, readyStudent], [unconfiguredStudent.id, readyStudent.id], {
  levelStart: "longSentences",
  sessionGoal: 20,
  maxAttemptsPerChunk: 1,
});
assert.strictEqual(bulkConfigured[0].config.levelStart, "longSentences");
assert.strictEqual(bulkConfigured[1].config.sessionGoal, 20);
assert.strictEqual(bulkConfigured[0].config.maxAttemptsPerChunk, 1);
assert.strictEqual(bulkConfigured[0].config.isConfigured, true);

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
    onUncertain: (reason) => events.push(["uncertain", reason]),
    setFeedback: (value) => events.push(["feedback", value]),
    setStatus: (value, isListening) => events.push(["status", value, isListening]),
    setStartLabel: (value) => events.push(["label", value]),
    setNoiseLevel: (percent) => events.push(["noise", percent]),
    setVoiceLevel: (percent) => events.push(["voice", percent]),
  };

  if (overrides.navigator) options.navigator = overrides.navigator;
  if (overrides.window) options.window = { ...options.window, ...overrides.window };
  if (overrides.minVoiceEvidenceMs !== undefined) options.minVoiceEvidenceMs = overrides.minVoiceEvidenceMs;
  if (overrides.getMinVoiceEvidenceMs) options.getMinVoiceEvidenceMs = overrides.getMinVoiceEvidenceMs;
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
  const flushAsync = async (times = 8) => {
    for (let index = 0; index < times; index += 1) await Promise.resolve();
  };

  const noOpenedAutoSave = await jsonBackup.autoSaveOpenedBackup();
  assert.strictEqual(noOpenedAutoSave.skipped, true);
  assert.strictEqual(noOpenedAutoSave.reason, "no_open_file");

  let openPickerCalls = 0;
  let writableWrites = 0;
  let writableCloses = 0;
  context.window.showOpenFilePicker = async () => {
    openPickerCalls += 1;
    return [{
      name: "lectovoz-datos.json",
      getFile: async () => ({
        name: "lectovoz-datos.json",
        text: async () => JSON.stringify(validImport),
      }),
      createWritable: async () => ({
        write: async (value) => {
          writableWrites += String(value).includes("lectovoz-backup") ? 1 : 0;
        },
        close: async () => {
          writableCloses += 1;
        },
      }),
    }];
  };
  const openedFile = await jsonBackup.openBackupFile("merge");
  assert.strictEqual(openedFile.success, true);
  assert.strictEqual(openedFile.fileName, "lectovoz-datos.json");
  assert.strictEqual(openPickerCalls, 1);
  assert.strictEqual(jsonBackup.hasOpenedWritableFile(), true);
  jsonBackup.setAutoSaveEnabled(false);
  const disabledAutoSave = await jsonBackup.autoSaveOpenedBackup();
  assert.strictEqual(disabledAutoSave.skipped, true);
  assert.strictEqual(disabledAutoSave.reason, "autosave_disabled");
  const savedOpenedFile = await jsonBackup.saveToOpenedFile();
  assert.strictEqual(savedOpenedFile.success, true);
  assert.strictEqual(writableWrites, 1);
  assert.strictEqual(writableCloses, 1);
  jsonBackup.setAutoSaveEnabled(true);
  const autoSavedOpenedFile = await jsonBackup.autoSaveOpenedBackup();
  assert.strictEqual(autoSavedOpenedFile.success, true);
  assert.strictEqual(writableWrites, 2);
  const savedAgain = await jsonBackup.saveToOpenedFile();
  assert.strictEqual(savedAgain.success, true);
  assert.strictEqual(openPickerCalls, 1);
  assert.strictEqual(writableWrites, 3);
  assert.strictEqual(jsonBackup.getBackupStatus().lastError, null);

  context.window.showOpenFilePicker = async () => [{
    name: "lectovoz-datos.json",
    getFile: async () => ({
      name: "lectovoz-datos.json",
      text: async () => JSON.stringify(validImport),
    }),
    createWritable: async () => {
      throw new Error("disk full");
    },
  }];
  await jsonBackup.openBackupFile("merge");
  const beforeFailedAutoSave = JSON.stringify(storage.getRecords());
  const failedAutoSave = await jsonBackup.autoSaveOpenedBackup();
  assert.strictEqual(failedAutoSave.success, false);
  assert.strictEqual(failedAutoSave.reason, "write_failed");
  assert.strictEqual(JSON.stringify(storage.getRecords()), beforeFailedAutoSave);
  assert.strictEqual(jsonBackup.getBackupStatus().lastError, "disk full");

  const releaseWrites = [];
  let slowWrites = 0;
  let slowOpenPickerCalls = 0;
  context.window.showOpenFilePicker = async () => {
    slowOpenPickerCalls += 1;
    return [{
      name: "lectovoz-datos.json",
      getFile: async () => ({
        name: "lectovoz-datos.json",
        text: async () => JSON.stringify(validImport),
      }),
      createWritable: async () => ({
        write: async () => {
          slowWrites += 1;
          await new Promise((resolve) => {
            releaseWrites.push(resolve);
          });
        },
        close: async () => {},
      }),
    }];
  };
  await jsonBackup.openBackupFile("merge");
  const firstQueuedSave = jsonBackup.autoSaveOpenedBackup();
  await flushAsync(4);
  const secondQueuedSave = jsonBackup.autoSaveOpenedBackup();
  assert.strictEqual(jsonBackup.getBackupStatus().saving, true);
  assert.strictEqual(jsonBackup.getBackupStatus().pending, true);
  assert.strictEqual(releaseWrites.length, 1);
  releaseWrites[0]();
  await flushAsync(20);
  assert.strictEqual(releaseWrites.length, 2);
  releaseWrites[1]();
  await Promise.all([firstQueuedSave, secondQueuedSave]);
  assert.strictEqual(slowWrites, 2);
  assert.strictEqual(slowOpenPickerCalls, 1);
  delete context.window.showOpenFilePicker;
  const noFileApi = await jsonBackup.openBackupFile("merge");
  assert.strictEqual(noFileApi.reason, "file_system_access_unavailable");
  const inputImport = await jsonBackup.readFileInput({ text: async () => JSON.stringify(validImport) }, "merge");
  assert.strictEqual(inputImport.success, true);

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
    this.abortCalls = 0;
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
  FakeRecognition.prototype.abort = function abort() {
    this.abortCalls += 1;
  };

  const calibrationTrack = createTrack();
  let calibrationGetUserMediaCalls = 0;
  const calibrationHarness = createSpeechHarness({
    recognitionCtor: FakeRecognition,
    navigator: {
      mediaDevices: {
        getUserMedia() {
          calibrationGetUserMediaCalls += 1;
          return Promise.resolve({ getTracks: () => [calibrationTrack] });
        },
      },
    },
  });
  const recognitionInstancesBeforeCalibration = recognitionInstances;
  const calibrationReady = await calibrationHarness.controller.prepareMicrophone();
  assert.strictEqual(calibrationReady.ok, true);
  assert.strictEqual(calibrationHarness.controller.isListening(), false);
  assert.strictEqual(calibrationHarness.controller.isAudioReady(), true);
  assert.strictEqual(calibrationGetUserMediaCalls, 1);
  assert.strictEqual(recognitionInstances, recognitionInstancesBeforeCalibration);
  await calibrationHarness.controller.prepareMicrophone();
  assert.strictEqual(calibrationGetUserMediaCalls, 1);
  await calibrationHarness.controller.start();
  assert.strictEqual(calibrationGetUserMediaCalls, 1);
  assert.strictEqual(calibrationTrack.stopped, false);

  const track = createTrack();
  let getUserMediaCalls = 0;
  const recognitionInstancesBeforeStartHarness = recognitionInstances;
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
  assert.strictEqual(recognitionInstances, recognitionInstancesBeforeStartHarness + 1);
  await controllerHarness.controller.start();
  assert.strictEqual(getUserMediaCalls, 1);
  assert.strictEqual(recognitionInstances, recognitionInstancesBeforeStartHarness + 1);
  assert.strictEqual(recognitionInstance.continuous, true);
  controllerHarness.controller.stop();
  controllerHarness.controller.stop();
  assert.strictEqual(controllerHarness.controller.isListening(), false);
  assert.strictEqual(track.stopped, false);
  assert.strictEqual(audioMetrics.closeCalls, 0);
  assert.ok(controllerHarness.events.some((event) => event[0] === "status" && event[1] === "Microfono listo"));

  await controllerHarness.controller.start();
  recognitionInstance.onerror({ error: "no-speech" });
  assert.ok(controllerHarness.events.some((event) => event[0] === "uncertain" && event[1] === "no_speech"));
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

  const restartTrack = createTrack();
  let queuedRestart = null;
  const staleRestart = createSpeechHarness({
    recognitionCtor: FakeRecognition,
    navigator: {
      mediaDevices: {
        getUserMedia() {
          return Promise.resolve({ getTracks: () => [restartTrack] });
        },
      },
    },
    window: {
      setTimeout(callback, ms) {
        if (ms === 180) {
          queuedRestart = callback;
          return 77;
        }
        callback();
        return 1;
      },
      clearTimeout(id) {
        staleRestart.events.push(["clearTimeout", id]);
      },
    },
  });
  await staleRestart.controller.start();
  const restartStartCalls = recognitionInstance.startCalls;
  recognitionInstance.onend();
  assert.ok(queuedRestart);
  staleRestart.controller.beginListeningWindow();
  queuedRestart();
  assert.strictEqual(recognitionInstance.startCalls, restartStartCalls);

  const unavailable = createSpeechHarness({
    recognitionCtor: function Recognition() {},
    navigator: {},
  });
  await unavailable.controller.start();
  assert.ok(unavailable.events.some((event) => event[0] === "feedback" && event[1].includes("microfono no esta disponible")));

  const fragmentedVoice = createSpeechHarness({ recognitionCtor: function Recognition() {} });
  fragmentedVoice.controller.debugSetNoiseFloor(0.01);
  fragmentedVoice.controller.debugSampleVolume(0.03, 100);
  fragmentedVoice.controller.debugSampleVolume(0.03, 280);
  fragmentedVoice.controller.debugSampleVolume(0.011, 320);
  fragmentedVoice.controller.debugSampleVolume(0.03, 430);
  fragmentedVoice.controller.debugSampleVolume(0.03, 590);
  assert.ok(fragmentedVoice.controller.getVoiceEvidenceDuration(590) >= 180);

  const shortNoise = createSpeechHarness({ recognitionCtor: function Recognition() {} });
  shortNoise.controller.debugSetNoiseFloor(0.01);
  shortNoise.controller.debugSampleVolume(0.03, 100);
  shortNoise.controller.debugSampleVolume(0.03, 140);
  shortNoise.controller.debugSampleVolume(0.011, 180);
  assert.ok(shortNoise.controller.getVoiceEvidenceDuration(180) < 180);

  const hysteresis = createSpeechHarness({ recognitionCtor: function Recognition() {} });
  hysteresis.controller.debugSetNoiseFloor(0.01);
  hysteresis.controller.debugSampleVolume(0.03, 100);
  assert.strictEqual(hysteresis.controller.isVoiceActive(), true);
  hysteresis.controller.debugSampleVolume(0.013, 150);
  assert.strictEqual(hysteresis.controller.isVoiceActive(), true);
  hysteresis.controller.debugSampleVolume(0.011, 220);
  assert.strictEqual(hysteresis.controller.isVoiceActive(), false);

  const variableNoise = createSpeechHarness({ recognitionCtor: function Recognition() {} });
  variableNoise.controller.debugSetNoiseFloor(0.01);
  variableNoise.controller.debugSampleVolume(0.011, 100);
  variableNoise.controller.debugSampleVolume(0.012, 180);
  variableNoise.controller.debugSampleVolume(0.0115, 260);
  assert.strictEqual(variableNoise.controller.isVoiceActive(), false);
  assert.strictEqual(variableNoise.controller.getVoiceEvidenceDuration(260), 0);

  const metrics = fragmentedVoice.controller.getDebugMetrics();
  assert.strictEqual(metrics.voiceEvidenceWindowMs, 600);
  assert.strictEqual(metrics.minVoiceEvidenceMs, 180);
  assert.ok(Number.isFinite(metrics.noiseFloor));
  assert.ok(Number.isFinite(metrics.currentVolume));

  const diagnosticGate = createSpeechHarness({ recognitionCtor: function Recognition() {}, minVoiceEvidenceMs: 80 });
  diagnosticGate.controller.debugSetNoiseFloor(0.01);
  diagnosticGate.controller.debugSampleVolume(0.03, 100);
  diagnosticGate.controller.debugSampleVolume(0.03, 190);
  assert.strictEqual(diagnosticGate.controller.getDebugMetrics(190).minVoiceEvidenceMs, 80);
  assert.strictEqual(diagnosticGate.controller.getVoiceEvidenceDuration(190) >= 80, true);

  let selectedDiagnosticGate = 100;
  const dynamicDiagnosticGate = createSpeechHarness({
    recognitionCtor: function Recognition() {},
    getMinVoiceEvidenceMs: () => selectedDiagnosticGate,
  });
  assert.strictEqual(dynamicDiagnosticGate.controller.getDebugMetrics().minVoiceEvidenceMs, 100);
  selectedDiagnosticGate = 150;
  assert.strictEqual(dynamicDiagnosticGate.controller.getDebugMetrics().minVoiceEvidenceMs, 150);

  const normalGameGate = createSpeechHarness({ recognitionCtor: function Recognition() {} });
  assert.strictEqual(normalGameGate.controller.getDebugMetrics().minVoiceEvidenceMs, 180);
}

runSpeechControllerTests().then(() => {
  console.log(`Module tests passed (${passedChecks} checks)`);
});
