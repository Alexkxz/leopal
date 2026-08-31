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

const context = {
  console,
  Blob,
  Date,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  DataView,
  ArrayBuffer,
  Math,
  window: {},
};
context.window.Blob = Blob;
context.window.Date = Date;
context.window.TextEncoder = TextEncoder;
context.window.TextDecoder = TextDecoder;
context.window.Uint8Array = Uint8Array;
context.window.DataView = DataView;
context.window.ArrayBuffer = ArrayBuffer;
context.window.Math = Math;

vm.createContext(context);
vm.runInContext(fs.readFileSync("modules/content.js", "utf8"), context);
vm.runInContext(fs.readFileSync("modules/offline-audio-analyzer.js", "utf8"), context);
vm.runInContext(fs.readFileSync("modules/voice-sampler.js", "utf8"), context);

const sampler = context.window.LectoVozVoiceSampler;
const analyzer = context.window.LectoVozOfflineAudioAnalyzer;

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const dataset = sampler.getSamplerDataset(context.window.LectoVozContent);
assert.ok(dataset.syllables.length >= 70);
assert.ok(dataset.prioritySyllables.includes("ma"));
assert.ok(dataset.prioritySyllables.includes("pa"));
assert.ok(dataset.prioritySyllables.includes("ba"));
assert.ok(dataset.prioritySyllables.includes("za"));
assert.strictEqual(dataset.shortWords.length, 45);
assert.strictEqual(dataset.mediumWords.length, 36);
assert.strictEqual(dataset.longWords.length, 22);
assert.strictEqual(dataset.phrases.length, 12);

const defaultConfig = {
  mode: "complete",
  syllableRepetitions: 3,
  wordRepetitions: 2,
  phraseRepetitions: 2,
  randomOrder: false,
};
const completeSequence = sampler.buildRecordingSequence(defaultConfig, dataset);
const expectedCompleteTotal = (dataset.syllables.length * 3)
  + ((dataset.shortWords.length + dataset.mediumWords.length + dataset.longWords.length) * 2)
  + (dataset.phrases.length * 2);
assert.strictEqual(completeSequence.length, expectedCompleteTotal);
assert.deepStrictEqual(plain(completeSequence[0]), {
  target: dataset.syllables[0],
  category: "syllable",
  subcategory: "short",
  repetition: 1,
  repetitions: 3,
  order: 1,
});
assert.strictEqual(completeSequence[2].repetition, 3);
assert.strictEqual(completeSequence[3].repetition, 1);

const quickSequence = sampler.buildRecordingSequence({ ...defaultConfig, mode: "quick" }, dataset);
assert.strictEqual(quickSequence.length, (24 * 3) + ((12 + 6) * 2) + (4 * 2));

const randomized = sampler.buildRecordingSequence(
  { ...defaultConfig, mode: "priority-syllables", randomOrder: true },
  dataset,
  () => 0,
);
const priorityNormal = sampler.buildRecordingSequence(
  { ...defaultConfig, mode: "priority-syllables", randomOrder: false },
  dataset,
);
assert.strictEqual(randomized.length, dataset.prioritySyllables.length * 3);
assert.notStrictEqual(
  JSON.stringify(randomized.map((item) => `${item.target}:${item.repetition}`)),
  JSON.stringify(priorityNormal.map((item) => `${item.target}:${item.repetition}`)),
);
assert.strictEqual(randomized[0].order, 1);

assert.strictEqual(sampler.sanitizeIdentifier("  Alumno Áñez 001!! "), "Alumno_Anez_001");
assert.strictEqual(sampler.sanitizeIdentifier(""), "ALUMNO");
assert.strictEqual(sampler.makeRecordingFileName(1, "ma", 1, "audio/webm"), "001_ma_rep1.webm");
assert.strictEqual(sampler.makeRecordingFileName(12, "niño feliz", 2, "audio/ogg"), "012_nino_feliz_rep2.ogg");
assert.strictEqual(sampler.makeRecordingFileName(123, "cumpleaños", 3, "audio/mp4"), "123_cumpleanos_rep3.m4a");

const fakeRecorder = {
  isTypeSupported(type) {
    return type === "audio/webm";
  },
};
assert.strictEqual(sampler.pickSupportedMimeType(fakeRecorder), "audio/webm");
assert.strictEqual(sampler.pickSupportedMimeType(null), "");

assert.deepStrictEqual(plain(sampler.validateAudioMetrics({ durationMs: 100, rms: 0.02, peak: 0.5, sizeBytes: 10 })), ["recording_too_short"]);
assert.deepStrictEqual(plain(sampler.validateAudioMetrics({ durationMs: 700, rms: 0.003, peak: 0.5, sizeBytes: 10 })), ["volume_very_low"]);
assert.deepStrictEqual(plain(sampler.validateAudioMetrics({ durationMs: 700, rms: 0.02, peak: 0.99, sizeBytes: 10 })), ["possible_saturation"]);
assert.deepStrictEqual(plain(sampler.validateAudioMetrics({ durationMs: 700, rms: 0.02, peak: 0.5, sizeBytes: 0 })), ["empty_audio"]);

const acceptedRecordings = [{
  file: "001_ma_rep1.webm",
  target: "ma",
  category: "syllable",
  subcategory: "short",
  repetition: 1,
  order: 1,
  mimeType: "audio/webm",
  sizeBytes: 4,
  durationMs: 920,
  recordedAt: "2026-08-31T00:00:00.000Z",
  warnings: [],
  blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm" }),
}];

const metadata = sampler.buildMetadata({
  participant: {
    id: "ALUMNO_001",
    grade: "3",
    age: "8",
    group: "A",
    region: "Colima, Mexico",
    notes: "Prueba local",
  },
  session: {
    mode: "syllables",
    repetitionsConfigured: { syllable: 3, word: 2, phrase: 2 },
    syllableRepetitions: 3,
    wordRepetitions: 2,
    phraseRepetitions: 2,
    randomOrder: true,
  },
  sequence: completeSequence.slice(0, 2),
  acceptedRecordings,
  skippedItems: [completeSequence[1]],
  repeatedTakes: 1,
});
assert.strictEqual(metadata.format, "lectovoz-voice-samples");
assert.strictEqual(metadata.version, 2);
assert.strictEqual(metadata.participant.id, "ALUMNO_001");
assert.strictEqual(metadata.alumno.nombre, "ALUMNO_001");
assert.strictEqual(metadata.session.totalExpected, 2);
assert.strictEqual(metadata.session.totalAccepted, 1);
assert.strictEqual(metadata.session.totalSkipped, 1);
assert.strictEqual(metadata.recordings[0].file, "001_ma_rep1.webm");
assert.strictEqual(metadata.recordings[0].archivo, "001_ma_rep1.webm");
assert.strictEqual(metadata.recordings[0].target, "ma");
assert.strictEqual(metadata.recordings[0].palabra_objetivo, "ma");
assert.strictEqual(metadata.grabaciones[0].categoria, "syllable");

assert.strictEqual(analyzer.getStudentName(metadata, "sample.zip"), "ALUMNO_001");
assert.deepStrictEqual(plain(analyzer.matchRecordingMetadata(metadata, "001_ma_rep1.webm")), plain(metadata.recordings[0]));
assert.strictEqual(analyzer.collectDatasetInfo([{
  zipName: "sample.zip",
  metadata,
  audioEntries: [{ name: "001_ma_rep1.webm" }],
}]).uniqueExpectedWords, 1);

(async () => {
  const zip = await sampler.createZipBlob([
    { name: "metadata.json", blob: new Blob([JSON.stringify(metadata)], { type: "application/json" }) },
    { name: acceptedRecordings[0].file, blob: acceptedRecordings[0].blob },
  ]);
  assert.ok(zip.size > acceptedRecordings[0].sizeBytes);
  const inspected = await analyzer.inspectZipFile({
    name: "lectovoz_muestras_ALUMNO_001_2026-08-31.zip",
    arrayBuffer: () => zip.arrayBuffer(),
  });
  assert.strictEqual(inspected.metadata.format, "lectovoz-voice-samples");
  assert.strictEqual(inspected.audioEntries.length, 1);
  assert.strictEqual(inspected.audioEntries[0].name, "001_ma_rep1.webm");
  assert.strictEqual(sampler.makeZipName("Alumno Áñez 001", new Date("2026-08-31T12:00:00Z")), "lectovoz_muestras_Alumno_Anez_001_2026-08-31.zip");
  console.log(`Voice sampler tests passed (${passedChecks} checks)`);
})();
