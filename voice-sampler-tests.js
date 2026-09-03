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
const content = context.window.LectoVozContent;
const samplerHtml = fs.readFileSync("voice-sampler.html", "utf8");

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const dataset = sampler.getSamplerDataset(content);
assert.ok(samplerHtml.includes('id="record-btn"'));
assert.ok(samplerHtml.includes('id="next-btn"'));
assert.ok(samplerHtml.includes('id="finish-btn"'));
["stop-btn", "accept-btn", "skip-btn", "pause-btn", "cancel-btn"].forEach((id) => {
  assert.strictEqual(samplerHtml.includes(`id="${id}"`), false);
});
assert.deepStrictEqual(Object.keys(sampler.STRUCTURE), ["syllables", "words", "sentences"]);
assert.strictEqual(Object.keys(sampler.STRUCTURE.syllables.sublevels).length, 2);
assert.strictEqual(Object.keys(sampler.STRUCTURE.words.sublevels).length, 2);
assert.strictEqual(Object.keys(sampler.STRUCTURE.sentences.sublevels).length, 2);
assert.strictEqual(dataset.syllables.length, 95);
assert.ok(dataset.syllables.some((item) => item.displayText === "ma" && item.expectedText === "ma"));
assert.ok(dataset.syllables.some((item) => item.displayText === "cha" && item.expectedText === "cha"));
assert.ok(dataset.syllables.some((item) => item.displayText === "ña" && item.expectedText === "ña"));
assert.strictEqual(dataset.segmentedWords.length, 68);
const segmentedCamioneta = dataset.segmentedWords.find((item) => item.expectedText === "camioneta");
assert.strictEqual(segmentedCamioneta.displayText, "ca-mio-ne-ta");
assert.strictEqual(segmentedCamioneta.expectedText, "camioneta");
assert.strictEqual(dataset.simpleWords.length, 130);
assert.strictEqual(dataset.simpleWords.some((item) => item.displayText.includes("-")), false);
assert.strictEqual(dataset.complexWords.length, 167);
assert.ok(dataset.complexWords.some((item) => item.expectedText === "flamenco"));
assert.strictEqual(dataset.shortSentences.length, 50);
assert.strictEqual(dataset.longSentences.length, 42);

const syllableQuick = sampler.buildRecordingSequence({
  category: "syllables",
  sublevel: "syllables",
  mode: "quick",
  syllableRepetitions: 3,
  randomOrder: false,
}, dataset);
assert.strictEqual(syllableQuick.length, sampler.QUICK_LIMITS.syllables * 3);
assert.deepStrictEqual(plain(syllableQuick[0]), {
  category: "syllables",
  sublevel: "syllables",
  displayText: "ma",
  expectedText: "ma",
  consonant: "m",
  itemIndex: 1,
  repetition: 1,
  repetitions: 3,
  order: 1,
});
assert.strictEqual(syllableQuick[2].repetition, 3);
assert.strictEqual(syllableQuick[3].repetition, 1);

const simpleQuick = sampler.buildRecordingSequence({ sublevel: "simpleWords", mode: "quick", randomOrder: false }, dataset);
assert.strictEqual(simpleQuick.length, 24);
assert.strictEqual(simpleQuick[0].displayText.includes("-"), false);
assert.strictEqual(simpleQuick[0].repetitions, 1);

const sentenceQuick = sampler.buildRecordingSequence({ sublevel: "shortSentences", mode: "quick", randomOrder: false }, dataset);
assert.strictEqual(sentenceQuick.length, 12);
assert.ok(sentenceQuick[0].displayText.split(/\s+/).length >= 4);

const completeBySublevel = {
  syllables: sampler.buildRecordingSequence({ sublevel: "syllables", mode: "complete", syllableRepetitions: 3 }, dataset).length,
  segmentedWords: sampler.buildRecordingSequence({ sublevel: "segmentedWords", mode: "complete" }, dataset).length,
  simpleWords: sampler.buildRecordingSequence({ sublevel: "simpleWords", mode: "complete" }, dataset).length,
  complexWords: sampler.buildRecordingSequence({ sublevel: "complexWords", mode: "complete" }, dataset).length,
  shortSentences: sampler.buildRecordingSequence({ sublevel: "shortSentences", mode: "complete" }, dataset).length,
  longSentences: sampler.buildRecordingSequence({ sublevel: "longSentences", mode: "complete" }, dataset).length,
};
assert.deepStrictEqual(completeBySublevel, {
  syllables: 285,
  segmentedWords: 68,
  simpleWords: 130,
  complexWords: 167,
  shortSentences: 50,
  longSentences: 42,
});

const general = sampler.buildRecordingSequence({ mode: "general", randomOrder: false }, dataset);
assert.strictEqual(general.length, 52);
assert.strictEqual(new Set(general.map((item) => item.sublevel)).size, 6);
const randomized = sampler.buildRecordingSequence({ sublevel: "syllables", mode: "quick", syllableRepetitions: 1, randomOrder: true }, dataset, () => 0);
const normal = sampler.buildRecordingSequence({ sublevel: "syllables", mode: "quick", syllableRepetitions: 1, randomOrder: false }, dataset);
assert.notStrictEqual(JSON.stringify(randomized.map((item) => item.expectedText)), JSON.stringify(normal.map((item) => item.expectedText)));
assert.strictEqual(randomized[0].order, 1);

assert.strictEqual(sampler.sanitizeIdentifier("  Alumno Áñez 001!! "), "Alumno_Anez_001");
assert.strictEqual(sampler.sanitizeIdentifier(""), "ALUMNO");
assert.strictEqual(sampler.makeRecordingFileName(1, syllableQuick[0], 1, "audio/webm"), "001_ma_rep1.webm");
assert.strictEqual(sampler.makeRecordingFileName(18, segmentedCamioneta, 1, "audio/webm"), "018_camioneta_rep1.webm");
assert.strictEqual(sampler.makeRecordingFileName(35, { ...dataset.complexWords.find((item) => item.expectedText === "flamenco"), itemIndex: 35 }, 1, "audio/webm"), "035_flamenco_rep1.webm");
assert.strictEqual(sampler.makeRecordingFileName(48, { ...sentenceQuick[0], itemIndex: 1 }, 1, "audio/webm"), "048_oracion_001_rep1.webm");
assert.strictEqual(sampler.makeRecordingFileName(12, "niño feliz", 2, "audio/ogg"), "012_nino_feliz_rep2.ogg");
assert.strictEqual(sampler.makeRecordingFileName(123, "cumpleaños", 3, "audio/mp4"), "123_cumpleanos_rep3.m4a");
assert.strictEqual(sampler.makeZipName("Alumno Áñez 001", { category: "words", sublevel: "complexWords" }, new Date("2026-09-01T12:00:00Z")), "lectovoz_muestras_Alumno_Anez_001_words_complexwords_2026-09-01.zip");

const fakeRecorder = {
  isTypeSupported(type) {
    return type === "audio/webm";
  },
};
assert.strictEqual(sampler.pickSupportedMimeType(fakeRecorder), "audio/webm");
assert.strictEqual(sampler.pickSupportedMimeType(null), "");
assert.deepStrictEqual(plain(sampler.validateAudioMetrics({ durationMs: 100, rms: 0.02, peak: 0.5, sizeBytes: 10 }, syllableQuick[0])), ["recording_too_short"]);
assert.deepStrictEqual(plain(sampler.validateAudioMetrics({ durationMs: 700, rms: 0.003, peak: 0.5, sizeBytes: 10 }, simpleQuick[0])), ["volume_very_low"]);
assert.deepStrictEqual(plain(sampler.validateAudioMetrics({ durationMs: 700, rms: 0.02, peak: 0.99, sizeBytes: 10 }, simpleQuick[0])), ["possible_saturation"]);
assert.deepStrictEqual(plain(sampler.validateAudioMetrics({ durationMs: 700, rms: 0.02, peak: 0.5, sizeBytes: 0 }, simpleQuick[0])), ["empty_audio"]);
assert.strictEqual(sampler.validateRecordingBlob(new Blob([], { type: "audio/webm" }), "audio/webm", {}, simpleQuick[0]).valid, false);
assert.strictEqual(sampler.validateRecordingBlob(new Blob([new Uint8Array([1])], { type: "text/plain" }), "text/plain", { durationMs: 700, rms: 0.02, peak: 0.5 }, simpleQuick[0]).valid, false);
const validBlobResult = sampler.validateRecordingBlob(new Blob([new Uint8Array([1])], { type: "audio/webm" }), "audio/webm", { durationMs: 700, rms: 0.02, peak: 0.5 }, simpleQuick[0]);
assert.strictEqual(validBlobResult.valid, true);
assert.strictEqual(sampler.canAcceptRecording("stopping", new Blob([new Uint8Array([1])], { type: "audio/webm" }), validBlobResult), false);
assert.strictEqual(sampler.canAcceptRecording("recording", new Blob([new Uint8Array([1])], { type: "audio/webm" }), validBlobResult), false);
assert.strictEqual(sampler.canAcceptRecording("recorded", new Blob([new Uint8Array([1])], { type: "audio/webm" }), validBlobResult), true);
assert.deepStrictEqual(plain(sampler.getSamplerControls("ready", false, null)), {
  recordVisible: true,
  recordDisabled: false,
  recordMode: "record",
  reviewVisible: false,
  nextDisabled: true,
  reconnectVisible: false,
  finishDisabled: false,
});
assert.strictEqual(sampler.getSamplerControls("recording", false, null).recordMode, "stop");
assert.strictEqual(sampler.getSamplerControls("recording", false, null).reviewVisible, false);
assert.strictEqual(sampler.getSamplerControls("processing", false, null).recordDisabled, true);
assert.strictEqual(sampler.getSamplerControls("recorded", true, validBlobResult).reviewVisible, true);
assert.strictEqual(sampler.getSamplerControls("recorded", true, validBlobResult).nextDisabled, false);
assert.strictEqual(sampler.getSamplerControls("ready", false, null).reviewVisible, false);
const lowVolumeResult = sampler.validateRecordingBlob(new Blob([new Uint8Array([1])], { type: "audio/webm" }), "audio/webm", { durationMs: 700, rms: 0.003, peak: 0.5 }, simpleQuick[0]);
assert.strictEqual(lowVolumeResult.valid, true);
assert.deepStrictEqual(plain(lowVolumeResult.warnings), ["volume_very_low"]);
assert.strictEqual(sampler.getSamplerControls("recorded", true, lowVolumeResult).nextDisabled, false);
assert.strictEqual(sampler.getSamplerControls("mic-disconnected", false, null).reconnectVisible, true);
assert.strictEqual(sampler.getSamplerControls("finished", false, null).finishDisabled, true);

function makeStream(label = "stream") {
  const track = {
    label,
    readyState: "live",
    stopCalls: 0,
    onended: null,
    stop() {
      this.stopCalls += 1;
      this.readyState = "ended";
    },
    endUnexpectedly() {
      this.readyState = "ended";
      this.onended?.();
    },
  };
  return {
    active: true,
    track,
    getTracks() {
      return [track];
    },
  };
}

(async () => {
  let getUserMediaCalls = 0;
  const sessionState = { stream: null, status: "idle" };
  const getUserMedia = async () => {
    getUserMediaCalls += 1;
    return makeStream(`stream-${getUserMediaCalls}`);
  };

  const firstStream = await sampler.requestSessionStream(sessionState, getUserMedia);
  assert.strictEqual(firstStream.requested, true);
  assert.strictEqual(getUserMediaCalls, 1);
  const sameStream = await sampler.requestSessionStream(sessionState, getUserMedia);
  assert.strictEqual(sameStream.requested, false);
  assert.strictEqual(getUserMediaCalls, 1);

  const liveTrack = sessionState.stream.track;
  ["accept", "retry", "skip", "pause", "advance", "change_category"].forEach(() => {
    assert.strictEqual(liveTrack.stopCalls, 0);
    assert.strictEqual(sampler.isStreamUsable(sessionState.stream), true);
  });

  assert.strictEqual(sampler.stopSessionStream(sessionState.stream), 1);
  assert.strictEqual(liveTrack.stopCalls, 1);
  const cancelStream = makeStream("cancel");
  assert.strictEqual(sampler.stopSessionStream(cancelStream), 1);
  assert.strictEqual(cancelStream.track.stopCalls, 1);

  const disconnectedState = { stream: makeStream("lost"), status: "connected" };
  disconnectedState.stream.track.endUnexpectedly();
  disconnectedState.stream.active = false;
  assert.strictEqual(sampler.getMicrophoneStatus(disconnectedState.stream), "disconnected");
  const noAutoReconnect = await sampler.requestSessionStream(disconnectedState, getUserMedia);
  assert.strictEqual(noAutoReconnect.status, "disconnected");
  assert.strictEqual(noAutoReconnect.requested, false);
  assert.strictEqual(getUserMediaCalls, 1);
  const reconnected = await sampler.requestSessionStream(disconnectedState, getUserMedia, { forceReconnect: true });
  assert.strictEqual(reconnected.requested, true);
  assert.strictEqual(getUserMediaCalls, 2);
  assert.strictEqual(sampler.getMicrophoneStatus(disconnectedState.stream), "connected");
})();

const acceptedRecordings = [{
  ...segmentedCamioneta,
  file: "018_camioneta_rep1.webm",
  repetition: 1,
  repetitions: 1,
  order: 18,
  mimeType: "audio/webm",
  sizeBytes: 4,
  durationMs: 920,
  validation: { tooShort: false, tooQuiet: false, clipping: false },
  recordedAt: "2026-09-01T00:00:00.000Z",
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
    category: "syllables",
    sublevel: "segmentedWords",
    mode: "complete",
    syllableRepetitions: 3,
    itemRepetitions: 1,
    randomOrder: true,
  },
  sequence: sampler.buildRecordingSequence({ sublevel: "segmentedWords", mode: "complete" }, dataset),
  acceptedRecordings,
  skippedItems: [dataset.segmentedWords[1]],
  repeatedTakes: 1,
});
assert.strictEqual(metadata.format, "lectovoz-voice-samples");
assert.strictEqual(metadata.version, 3);
assert.strictEqual(metadata.participant.id, "ALUMNO_001");
assert.strictEqual(metadata.alumno.nombre, "ALUMNO_001");
assert.strictEqual(metadata.session.category, "syllables");
assert.strictEqual(metadata.session.sublevel, "segmentedWords");
assert.strictEqual(metadata.session.totalExpected, 68);
assert.strictEqual(metadata.session.totalAccepted, 1);
assert.strictEqual(metadata.session.totalSkipped, 1);
assert.strictEqual(metadata.recordings[0].file, "018_camioneta_rep1.webm");
assert.strictEqual(metadata.recordings[0].displayText, "ca-mio-ne-ta");
assert.strictEqual(metadata.recordings[0].expectedText, "camioneta");
assert.strictEqual(metadata.recordings[0].archivo, "018_camioneta_rep1.webm");
assert.strictEqual(metadata.recordings[0].palabra_objetivo, "camioneta");
assert.strictEqual(metadata.grabaciones[0].categoria, "syllables");
assert.strictEqual(metadata.grabaciones[0].sublevel, "segmentedWords");

const legacyMetadata = {
  format: "lectovoz-voice-samples",
  version: 2,
  alumno: { nombre: "ALUMNO_OLD" },
  grabaciones: [{ archivo: "001_ma_rep1.webm", palabra_objetivo: "ma", categoria: "syllable", subcategoria: "short", repeticion: 1 }],
};
assert.strictEqual(analyzer.getStudentName(legacyMetadata, "sample.zip"), "ALUMNO_OLD");
assert.deepStrictEqual(plain(analyzer.matchRecordingMetadata(legacyMetadata, "001_ma_rep1.webm")), plain(legacyMetadata.grabaciones[0]));
assert.strictEqual(analyzer.getStudentName(metadata, "sample.zip"), "ALUMNO_001");
assert.deepStrictEqual(plain(analyzer.matchRecordingMetadata(metadata, "018_camioneta_rep1.webm")), plain(metadata.recordings[0]));
assert.strictEqual(analyzer.collectDatasetInfo([{
  zipName: "sample.zip",
  metadata,
  audioEntries: [{ name: "018_camioneta_rep1.webm" }],
}]).uniqueExpectedWords, 1);

(async () => {
  const zip = await sampler.createZipBlob([
    { name: "metadata.json", blob: new Blob([JSON.stringify(metadata)], { type: "application/json" }) },
    { name: acceptedRecordings[0].file, blob: acceptedRecordings[0].blob },
  ]);
  assert.ok(zip.size > acceptedRecordings[0].sizeBytes);
  const inspected = await analyzer.inspectZipFile({
    name: "lectovoz_muestras_ALUMNO_001_syllables_segmentedwords_2026-09-01.zip",
    arrayBuffer: () => zip.arrayBuffer(),
  });
  assert.strictEqual(inspected.metadata.format, "lectovoz-voice-samples");
  assert.strictEqual(inspected.metadata.version, 3);
  assert.strictEqual(inspected.audioEntries.length, 1);
  assert.strictEqual(inspected.audioEntries[0].name, "018_camioneta_rep1.webm");
  console.log(`Voice sampler tests passed (${passedChecks} checks)`);
})();
