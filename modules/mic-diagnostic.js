(function initMicDiagnostic(global) {
  const Evaluation = global.LectoVozEvaluation || global;
  const Speech = global.LectoVozSpeech;

  const TEST_ITEMS = [
    "ma", "me", "mi", "mo", "mu",
    "pa", "pe", "pi", "po", "pu",
    "ba", "be", "bi", "bo", "bu",
    "la", "le", "li", "lo", "lu",
    "sa", "se", "si", "so", "su",
    "mam\u00e1", "mapa", "pala", "pato", "bala", "mano", "mesa", "loma",
  ];
  const GATES_MS = [80, 100, 120, 150, 180];
  const DEFAULT_GATE_MS = 180;
  const WARMUP_MS = 250;

  function now() {
    return global.performance?.now ? global.performance.now() : Date.now();
  }

  function normalizeText(value) {
    return Evaluation.normalizeText ? Evaluation.normalizeText(value) : String(value ?? "").trim().toLowerCase();
  }

  function round(value, digits = 3) {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function average(values) {
    const numeric = values.filter((value) => Number.isFinite(value));
    return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : 0;
  }

  function median(values) {
    const numeric = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
    if (!numeric.length) return 0;
    const middle = Math.floor(numeric.length / 2);
    return numeric.length % 2 ? numeric[middle] : (numeric[middle - 1] + numeric[middle]) / 2;
  }

  function getBestEvaluation(transcripts, expected) {
    const expectedText = normalizeText(expected);
    const candidates = [...new Set(transcripts.flatMap((transcript) => (
      Evaluation.buildSpokenCandidates ? Evaluation.buildSpokenCandidates(transcript) : [normalizeText(transcript)]
    )).filter(Boolean))];
    if (!candidates.length) return { status: "no_transcript", score: 0 };
    return candidates
      .map((candidate) => Evaluation.evaluateReading
        ? Evaluation.evaluateReading(candidate, expectedText)
        : { status: candidate === expectedText ? "correct" : "incorrect", score: candidate === expectedText ? 1 : 0 })
      .sort((left, right) => (right.score || 0) - (left.score || 0))[0];
  }

  function hasUsefulTranscript(attempt) {
    return Boolean(normalizeText(attempt.transcript) || attempt.alternatives.some((item) => normalizeText(item)));
  }

  function detectFalseRejection(attempt) {
    return hasUsefulTranscript(attempt) && !attempt.gate.passed && attempt.gate.voiceEvidenceMs < attempt.gate.thresholdMs;
  }

  function classifyAttempt(attempt) {
    const hasVoice = attempt.gate.voiceEvidenceMs > 0;
    const hasTranscript = hasUsefulTranscript(attempt);
    const falseRejection = detectFalseRejection(attempt);
    const labels = [];
    if (hasVoice && hasTranscript) labels.push("voice_with_transcript");
    if (hasVoice && !hasTranscript) labels.push("voice_without_transcript");
    if (falseRejection) labels.push("transcript_rejected_by_gate", "possible_false_rejection");
    if (!attempt.gate.passed && attempt.gate.voiceEvidenceMs < attempt.gate.thresholdMs) labels.push("insufficient_voice_evidence");
    if (["correct", "approximate", "incorrect"].includes(attempt.evaluation.status)) labels.push(attempt.evaluation.status);
    return labels;
  }

  function createAttempt(expected, thresholdMs = DEFAULT_GATE_MS, startedAt = now()) {
    return {
      expected,
      transcript: "",
      interimTranscript: "",
      finalTranscript: "",
      alternatives: [],
      gate: {
        thresholdMs,
        passed: false,
        voiceEvidenceMs: 0,
        voiceStartThreshold: 0,
        voiceStopThreshold: 0,
      },
      audio: {
        noiseFloor: 0,
        averageVolume: 0,
        peakVolume: 0,
        voiceToNoiseRatio: 0,
      },
      timing: {
        recognitionStartedAt: startedAt,
        voiceStartedAt: 0,
        firstTranscriptAt: 0,
        finalTranscriptAt: 0,
        transcriptLatencyMs: null,
      },
      evaluation: {
        status: "no_transcript",
        score: 0,
      },
      recognition: {
        state: "idle",
        events: [],
      },
      classification: [],
      possibleFalseRejection: false,
      volumeSampleCount: 0,
      volumeTotal: 0,
    };
  }

  function applyMetrics(attempt, metrics = {}, state = "idle") {
    const volume = Number(metrics.currentVolume || 0);
    attempt.gate.voiceEvidenceMs = Number(metrics.voiceEvidenceDuration || 0);
    attempt.gate.voiceStartThreshold = Number(metrics.voiceStartThreshold || 0);
    attempt.gate.voiceStopThreshold = Number(metrics.voiceStopThreshold || 0);
    attempt.gate.thresholdMs = Number(metrics.minVoiceEvidenceMs || attempt.gate.thresholdMs);
    attempt.gate.passed = attempt.gate.voiceEvidenceMs >= attempt.gate.thresholdMs;
    attempt.audio.noiseFloor = Number(metrics.noiseFloor || 0);
    attempt.audio.peakVolume = Math.max(attempt.audio.peakVolume, volume);
    attempt.volumeTotal += volume;
    attempt.volumeSampleCount += 1;
    attempt.audio.averageVolume = attempt.volumeSampleCount ? attempt.volumeTotal / attempt.volumeSampleCount : 0;
    attempt.audio.voiceToNoiseRatio = attempt.audio.noiseFloor > 0 ? attempt.audio.peakVolume / attempt.audio.noiseFloor : 0;
    attempt.recognition.state = state;
    if (metrics.isVoiceActive && !attempt.timing.voiceStartedAt) {
      attempt.timing.voiceStartedAt = now();
    }
    return attempt;
  }

  function applyTranscript(attempt, transcript, confidence = 0, isFinal = false, alternatives = [], receivedAt = now()) {
    const rawTranscript = String(transcript || "").trim();
    if (!attempt.timing.firstTranscriptAt) attempt.timing.firstTranscriptAt = receivedAt;
    if (isFinal) attempt.timing.finalTranscriptAt = receivedAt;
    attempt.transcript = rawTranscript || attempt.transcript;
    attempt.interimTranscript = isFinal ? attempt.interimTranscript : rawTranscript;
    attempt.finalTranscript = isFinal ? rawTranscript : attempt.finalTranscript;
    attempt.alternatives = [...new Set([...attempt.alternatives, ...alternatives].filter(Boolean))];
    attempt.recognition.events.push({
      transcript: rawTranscript,
      alternatives: [...alternatives],
      confidence,
      isFinal,
      receivedAt,
    });
    if (attempt.timing.voiceStartedAt) {
      attempt.timing.transcriptLatencyMs = Math.max(0, receivedAt - attempt.timing.voiceStartedAt);
    }
    return attempt;
  }

  function finalizeAttempt(attempt, finishedAt = now()) {
    const transcripts = [attempt.finalTranscript, attempt.transcript, ...attempt.alternatives].filter(Boolean);
    const evaluation = getBestEvaluation(transcripts, attempt.expected);
    attempt.evaluation = {
      status: evaluation.status || "incorrect",
      score: Number(evaluation.score || 0),
    };
    attempt.gate.passed = attempt.gate.voiceEvidenceMs >= attempt.gate.thresholdMs;
    attempt.possibleFalseRejection = detectFalseRejection(attempt);
    attempt.classification = classifyAttempt(attempt);
    attempt.timing.finishedAt = finishedAt;
    return attempt;
  }

  function summarizeGate(attempts, thresholdMs) {
    const projected = attempts.map((attempt) => {
      const gatePassed = attempt.gate.voiceEvidenceMs >= thresholdMs;
      const usefulTranscript = hasUsefulTranscript(attempt);
      return { attempt, gatePassed, usefulTranscript, falseRejection: usefulTranscript && !gatePassed };
    });
    const total = projected.length;
    const count = (predicate) => projected.filter(predicate).length;
    const voiceDetected = count(({ attempt }) => attempt.gate.voiceEvidenceMs > 0);
    const transcriptReceived = count(({ usefulTranscript }) => usefulTranscript);
    const correct = count(({ attempt }) => attempt.evaluation.status === "correct");
    const approximate = count(({ attempt }) => attempt.evaluation.status === "approximate");
    const incorrect = count(({ attempt }) => attempt.evaluation.status === "incorrect");
    const falseRejections = count(({ falseRejection }) => falseRejection);
    return {
      thresholdMs,
      attempts: total,
      voiceDetected,
      transcriptReceived,
      correct,
      approximate,
      incorrect,
      falseRejections,
      detectionRate: total ? voiceDetected / total : 0,
      correctRecognitionRate: total ? correct / total : 0,
      falseRejectionRate: total ? falseRejections / total : 0,
      averageVoiceEvidenceMs: average(projected.map(({ attempt }) => attempt.gate.voiceEvidenceMs)),
      medianVoiceEvidenceMs: median(projected.map(({ attempt }) => attempt.gate.voiceEvidenceMs)),
      averageLatencyMs: average(projected.map(({ attempt }) => attempt.timing.transcriptLatencyMs).filter((value) => value !== null)),
    };
  }

  function calculateSummary(attempts, gates = GATES_MS) {
    return gates.reduce((summary, thresholdMs) => {
      summary[thresholdMs] = summarizeGate(attempts, thresholdMs);
      return summary;
    }, {});
  }

  function buildExportPayload(attempts, configuration = {}, nav = global.navigator || {}) {
    const summary = calculateSummary(attempts, configuration.gatesMs || GATES_MS);
    return {
      format: "lectovoz-mic-diagnostic",
      version: 1,
      createdAt: new Date().toISOString(),
      userAgent: nav.userAgent || "No disponible",
      configuration: {
        gatesMs: configuration.gatesMs || GATES_MS,
        selectedGateMs: configuration.selectedGateMs || DEFAULT_GATE_MS,
        warmupMs: configuration.warmupMs || WARMUP_MS,
        items: configuration.items || TEST_ITEMS,
      },
      attempts,
      summary,
    };
  }

  function downloadJson(payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lectovoz-mic-diagnostic-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function bootDiagnosticUI() {
    if (!global.document || !Speech?.createSpeechController) return;
    const doc = global.document;
    const $ = (id) => doc.getElementById(id);
    const els = {
      start: $("start-lab"),
      finish: $("finish-attempt"),
      next: $("next-attempt"),
      end: $("end-lab"),
      export: $("export-diagnostic"),
      expected: $("expected-text"),
      itemProgress: $("item-progress"),
      status: $("mic-status"),
      gateButtons: [...doc.querySelectorAll("[data-gate-ms]")],
      gateValue: $("selected-gate"),
      gateState: $("gate-state"),
      volume: $("volume-value"),
      volumeBar: $("volume-bar"),
      noise: $("noise-floor"),
      evidence: $("voice-evidence"),
      startThreshold: $("voice-start-threshold"),
      stopThreshold: $("voice-stop-threshold"),
      interim: $("interim-transcript"),
      final: $("final-transcript"),
      alternatives: $("alternatives"),
      evaluation: $("evaluation"),
      latency: $("latency"),
      falseRejection: $("false-rejection"),
      history: $("attempt-history"),
      summary: $("summary-body"),
    };

    let selectedGateMs = DEFAULT_GATE_MS;
    let index = 0;
    let currentAttempt = null;
    const attempts = [];

    const controller = Speech.createSpeechController({
      window: global,
      navigator: global.navigator,
      recognitionCtor: global.SpeechRecognition || global.webkitSpeechRecognition,
      getCurrentSession: () => ({ diagnostic: true }),
      getCurrentChunk: () => TEST_ITEMS[index],
      getMinVoiceEvidenceMs: () => selectedGateMs,
      processTranscript: (transcript, confidence, isFinal, alternatives) => {
        if (!currentAttempt) return;
        applyTranscript(currentAttempt, transcript, confidence, isFinal, alternatives);
        renderCurrent();
        if (isFinal) finishAttempt();
      },
      onMissingSession: () => {},
      setFeedback: () => {},
      setStatus: (value) => {
        els.status.textContent = value;
      },
      setStartLabel: () => {},
      setNoiseLevel: () => {},
      setVoiceLevel: () => {},
      onVoiceActivityChange: (metrics) => {
        if (currentAttempt) applyMetrics(currentAttempt, metrics, controller.getState());
        renderLive(metrics);
      },
    });

    function setText(el, value) {
      if (el) el.textContent = value;
    }

    function setBar(el, value) {
      if (el) el.style.width = `${Math.max(0, Math.min(100, value))}%`;
    }

    function setGate(thresholdMs) {
      selectedGateMs = Number(thresholdMs);
      els.gateButtons.forEach((button) => {
        button.classList.toggle("active", Number(button.dataset.gateMs) === selectedGateMs);
      });
      setText(els.gateValue, `${selectedGateMs} ms`);
      if (currentAttempt) currentAttempt.gate.thresholdMs = selectedGateMs;
      renderCurrent();
      renderSummary();
    }

    function renderLive(metrics = controller.getDebugMetrics()) {
      setText(els.volume, round(metrics.currentVolume).toFixed(3));
      setBar(els.volumeBar, Number(metrics.currentVolume || 0) * 650);
      setText(els.noise, round(metrics.noiseFloor).toFixed(3));
      setText(els.evidence, `${Math.round(metrics.voiceEvidenceDuration || 0)} ms`);
      setText(els.startThreshold, round(metrics.voiceStartThreshold).toFixed(3));
      setText(els.stopThreshold, round(metrics.voiceStopThreshold).toFixed(3));
      setText(els.gateState, Number(metrics.voiceEvidenceDuration || 0) >= selectedGateMs ? "Superado" : "No superado");
      els.gateState.className = Number(metrics.voiceEvidenceDuration || 0) >= selectedGateMs ? "pass" : "fail";
    }

    function renderCurrent() {
      if (!currentAttempt) return;
      const preview = finalizeAttempt(structuredCloneAttempt(currentAttempt));
      setText(els.interim, currentAttempt.interimTranscript || "-");
      setText(els.final, currentAttempt.finalTranscript || "-");
      setText(els.alternatives, currentAttempt.alternatives.length ? currentAttempt.alternatives.join(", ") : "-");
      setText(els.evaluation, `${preview.evaluation.status} (${round(preview.evaluation.score, 2)})`);
      setText(els.latency, preview.timing.transcriptLatencyMs === null ? "-" : `${Math.round(preview.timing.transcriptLatencyMs)} ms`);
      setText(els.falseRejection, preview.possibleFalseRejection ? "Posible falso rechazo" : "-");
      els.falseRejection.className = preview.possibleFalseRejection ? "warn" : "";
    }

    function structuredCloneAttempt(attempt) {
      return JSON.parse(JSON.stringify(attempt));
    }

    async function startLab() {
      els.start.disabled = true;
      els.finish.disabled = false;
      els.end.disabled = false;
      beginAttempt();
      await controller.start();
      renderLive();
    }

    function beginAttempt() {
      currentAttempt = createAttempt(TEST_ITEMS[index], selectedGateMs, now());
      setText(els.expected, currentAttempt.expected);
      setText(els.itemProgress, `${index + 1} / ${TEST_ITEMS.length}`);
      setText(els.interim, "-");
      setText(els.final, "-");
      setText(els.alternatives, "-");
      setText(els.evaluation, "-");
      setText(els.latency, "-");
      setText(els.falseRejection, "-");
      els.next.disabled = true;
      els.finish.disabled = false;
    }

    function finishAttempt() {
      if (!currentAttempt) return;
      applyMetrics(currentAttempt, controller.getDebugMetrics(), controller.getState());
      finalizeAttempt(currentAttempt);
      attempts.push(currentAttempt);
      currentAttempt = null;
      controller.stop(false);
      els.finish.disabled = true;
      els.next.disabled = index >= TEST_ITEMS.length - 1;
      els.export.disabled = false;
      renderHistory();
      renderSummary();
    }

    async function nextAttempt() {
      if (index >= TEST_ITEMS.length - 1) return;
      index += 1;
      beginAttempt();
      await controller.start();
    }

    function renderHistory() {
      els.history.innerHTML = attempts.map((attempt) => `
        <tr>
          <td>${attempt.expected}</td>
          <td>${attempt.finalTranscript || attempt.transcript || "sin transcript"}</td>
          <td>${attempt.gate.thresholdMs} ms</td>
          <td>${Math.round(attempt.gate.voiceEvidenceMs)} ms</td>
          <td class="${attempt.gate.passed ? "pass" : "fail"}">${attempt.gate.passed ? "Si" : "No"}</td>
          <td>${attempt.evaluation.status}</td>
          <td>${attempt.timing.transcriptLatencyMs === null ? "-" : `${Math.round(attempt.timing.transcriptLatencyMs)} ms`}</td>
        </tr>
      `).join("");
    }

    function renderSummary() {
      const summary = calculateSummary(attempts);
      els.summary.innerHTML = GATES_MS.map((gate) => {
        const row = summary[gate];
        return `
          <tr>
            <td>${gate} ms</td>
            <td>${row.attempts}</td>
            <td>${row.voiceDetected}</td>
            <td>${row.transcriptReceived}</td>
            <td>${row.correct}</td>
            <td>${row.approximate}</td>
            <td>${row.incorrect}</td>
            <td>${row.falseRejections}</td>
            <td>${Math.round(row.detectionRate * 100)}%</td>
            <td>${Math.round(row.correctRecognitionRate * 100)}%</td>
            <td>${Math.round(row.falseRejectionRate * 100)}%</td>
            <td>${Math.round(row.averageVoiceEvidenceMs)} ms</td>
            <td>${Math.round(row.medianVoiceEvidenceMs)} ms</td>
            <td>${Math.round(row.averageLatencyMs)} ms</td>
          </tr>
        `;
      }).join("");
    }

    function endLab() {
      controller.close(false);
      els.start.disabled = false;
      els.finish.disabled = true;
      els.next.disabled = true;
      els.end.disabled = true;
      currentAttempt = null;
    }

    els.gateButtons.forEach((button) => button.addEventListener("click", () => setGate(button.dataset.gateMs)));
    els.start.addEventListener("click", startLab);
    els.finish.addEventListener("click", finishAttempt);
    els.next.addEventListener("click", nextAttempt);
    els.end.addEventListener("click", endLab);
    els.export.addEventListener("click", () => downloadJson(buildExportPayload(attempts, {
      gatesMs: GATES_MS,
      selectedGateMs,
      warmupMs: WARMUP_MS,
      items: TEST_ITEMS,
    })));
    global.addEventListener?.("pagehide", () => controller.close(false));
    setGate(DEFAULT_GATE_MS);
    beginAttempt();
    renderSummary();
  }

  global.LectoVozMicDiagnostic = {
    TEST_ITEMS,
    GATES_MS,
    DEFAULT_GATE_MS,
    WARMUP_MS,
    normalizeText,
    average,
    median,
    createAttempt,
    applyMetrics,
    applyTranscript,
    finalizeAttempt,
    hasUsefulTranscript,
    detectFalseRejection,
    classifyAttempt,
    summarizeGate,
    calculateSummary,
    buildExportPayload,
  };

  if (global.document) {
    global.document.addEventListener("DOMContentLoaded", bootDiagnosticUI);
  }
})(typeof window !== "undefined" ? window : globalThis);
