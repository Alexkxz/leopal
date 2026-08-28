(function initMicDiagnostic(global) {
  const Evaluation = global.LectoVozEvaluation || global;
  const TEST_ITEMS = [
    "ma", "me", "mi", "mo", "mu",
    "pa", "pe", "pi", "po", "pu",
    "ba", "be", "bi", "bo", "bu",
    "la", "le", "li", "lo", "lu",
    "sa", "se", "si", "so", "su",
    "mam\u00e1", "mesa", "pato", "boca", "luna",
  ];

  const CURRENT_GATE = {
    voiceEvidenceWindowMs: 600,
    minVoiceEvidenceMs: 180,
    warmupMs: 250,
  };
  const SIMULATED_GATES_MS = [100, 120, 150, 180];

  function now() {
    return global.performance?.now ? global.performance.now() : Date.now();
  }

  function round(value, digits = 3) {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function normalizeText(value) {
    if (Evaluation.normalizeText) return Evaluation.normalizeText(value);
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\u00f1/g, "n")
      .replace(/[^a-z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function createEmptyAttempt(expected) {
    return {
      expected,
      rawTranscript: "",
      normalizedTranscript: "",
      transcript: "",
      alternatives: [],
      recognitionEvents: [],
      confidence: 0,
      isFinal: false,
      noiseFloor: 0,
      maxVolume: 0,
      averageVolume: 0,
      volumeSamples: 0,
      voiceEvidenceDuration: 0,
      voiceActiveDuration: 0,
      recognitionStartedAt: 0,
      recognitionEndedAt: 0,
      listeningDuration: 0,
      firstVoiceDetectedAt: 0,
      firstTranscriptAt: 0,
      finalTranscriptAt: 0,
      voiceToInterimLatency: null,
      voiceToFinalLatency: null,
      voiceGateAccepted: false,
      rejectionReason: "not_started",
      gateComparisons: {},
      evaluationStatus: "not_evaluated",
      evaluationScore: 0,
      itemType: expected.length <= 2 ? "syllable" : "word",
    };
  }

  function compareGateDurations(voiceEvidenceDuration, listeningDuration, thresholds = SIMULATED_GATES_MS, warmupMs = CURRENT_GATE.warmupMs) {
    return thresholds.reduce((result, threshold) => {
      result[threshold] = voiceEvidenceDuration >= threshold && listeningDuration >= warmupMs;
      return result;
    }, {});
  }

  function getGateRejectionReason(attempt, listeningDuration = 0, gate = CURRENT_GATE) {
    if (attempt.voiceEvidenceDuration < gate.minVoiceEvidenceMs) return "voice_evidence_below_180ms";
    if (listeningDuration < gate.warmupMs) return "recognition_warmup_below_250ms";
    if (!attempt.normalizedTranscript) return "no_transcript";
    return "";
  }

  function evaluateAttemptText(attempt) {
    if (!attempt.isFinal) {
      return {
        status: attempt.normalizedTranscript ? "interim_only" : "no_transcript",
        score: 0,
      };
    }

    const expected = normalizeText(attempt.expected);
    const candidates = [attempt.normalizedTranscript, ...attempt.alternatives.map(normalizeText)].filter(Boolean);
    const advanced = candidates.some((candidate) => Evaluation.canAdvanceWithTranscript
      ? Evaluation.canAdvanceWithTranscript(candidate, expected)
      : candidate === expected);
    const best = candidates
      .map((candidate) => Evaluation.evaluateReading
        ? Evaluation.evaluateReading(candidate, expected)
        : { status: candidate === expected ? "correct" : "incorrect", score: candidate === expected ? 1 : 0 })
      .sort((left, right) => (right.score || 0) - (left.score || 0))[0];

    if (advanced) {
      return { status: "correct", score: best?.score ?? 1 };
    }
    return {
      status: best?.status || (attempt.normalizedTranscript ? "incorrect" : "no_transcript"),
      score: best?.score || 0,
    };
  }

  function finalizeAttemptMetrics(attempt, finishedAt = now(), gate = CURRENT_GATE) {
    const listeningDuration = Math.max(0, finishedAt - attempt.recognitionStartedAt);
    attempt.recognitionEndedAt = finishedAt;
    attempt.listeningDuration = listeningDuration;
    attempt.averageVolume = attempt.volumeSamples ? attempt.averageVolume / attempt.volumeSamples : 0;
    attempt.voiceGateAccepted = attempt.voiceEvidenceDuration >= gate.minVoiceEvidenceMs && listeningDuration >= gate.warmupMs;
    attempt.rejectionReason = attempt.voiceGateAccepted ? "" : getGateRejectionReason(attempt, listeningDuration, gate);
    attempt.gateComparisons = compareGateDurations(attempt.voiceEvidenceDuration, listeningDuration);
    const evaluation = evaluateAttemptText(attempt);
    attempt.evaluationStatus = evaluation.status;
    attempt.evaluationScore = evaluation.score;
    return attempt;
  }

  function splitAttempts(attempts) {
    return {
      syllables: attempts.filter((attempt) => attempt.itemType === "syllable"),
      words: attempts.filter((attempt) => attempt.itemType === "word"),
    };
  }

  function average(values) {
    const numeric = values.filter((value) => Number.isFinite(value));
    if (!numeric.length) return 0;
    return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  }

  function calculateGroupMetrics(attempts) {
    const total = attempts.length;
    const withVoice = attempts.filter((attempt) => attempt.voiceEvidenceDuration > 0).length;
    const gatePass = attempts.filter((attempt) => attempt.voiceGateAccepted).length;
    const correct = attempts.filter((attempt) => attempt.evaluationStatus === "correct").length;
    return {
      total,
      microphoneDetectedPercent: total ? Math.round((withVoice / total) * 100) : 0,
      voiceGatePassPercent: total ? Math.round((gatePass / total) * 100) : 0,
      speechRecognitionCorrectPercent: total ? Math.round((correct / total) * 100) : 0,
      voiceGatePass: gatePass,
      speechRecognitionCorrect: correct,
      averageInterimLatency: Math.round(average(attempts.map((attempt) => attempt.voiceToInterimLatency).filter((value) => value !== null))),
      averageFinalLatency: Math.round(average(attempts.map((attempt) => attempt.voiceToFinalLatency).filter((value) => value !== null))),
      averageVoiceEvidence: Math.round(average(attempts.map((attempt) => attempt.voiceEvidenceDuration))),
    };
  }

  function calculateSummary(attempts) {
    const groups = splitAttempts(attempts);
    return {
      total: calculateGroupMetrics(attempts),
      syllables: calculateGroupMetrics(groups.syllables),
      words: calculateGroupMetrics(groups.words),
      problematicSyllables: groups.syllables.filter((attempt) => (
        attempt.evaluationStatus !== "correct" || !attempt.voiceGateAccepted || !attempt.normalizedTranscript
      )),
    };
  }

  function getBrowserLabel(nav = global.navigator || {}) {
    return nav.userAgentData?.brands?.map((brand) => `${brand.brand} ${brand.version}`).join(", ")
      || nav.userAgent
      || "No disponible";
  }

  function formatSummaryText(attempts, nav = global.navigator || {}) {
    const summary = calculateSummary(attempts);
    const syllables = summary.syllables;
    const words = summary.words;
    const problematic = summary.problematicSyllables
      .map((attempt) => `${attempt.expected} -> ${attempt.rawTranscript ? `"${attempt.rawTranscript}"` : "sin transcript"}`)
      .join("\n") || "Ninguna";

    return [
      "Dispositivo: no incluido",
      `Navegador: ${getBrowserLabel(nav)}`,
      "",
      `Silabas evaluadas: ${syllables.total}`,
      `Voice Gate PASS: ${syllables.voiceGatePass}/${syllables.total}`,
      `SpeechRecognition correcto: ${syllables.speechRecognitionCorrect}/${syllables.total}`,
      "",
      `Evidencia media silabas: ${syllables.averageVoiceEvidence} ms`,
      `Evidencia media palabras: ${words.averageVoiceEvidence} ms`,
      "",
      `Latencia interim media: ${summary.total.averageInterimLatency} ms`,
      `Latencia final media: ${summary.total.averageFinalLatency} ms`,
      "",
      "Silabas problematicas:",
      problematic,
    ].join("\n");
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function bootDiagnosticUI() {
    if (!global.document) return;

    const Recognition = global.SpeechRecognition || global.webkitSpeechRecognition;
    const AudioContextCtor = global.AudioContext || global.webkitAudioContext;
    const $ = (id) => document.getElementById(id);
    const els = {
      start: $("start-test"),
      finish: $("finish-attempt"),
      next: $("next-attempt"),
      expected: $("expected-text"),
      state: $("live-state"),
      volumeBar: $("volume-bar"),
      volumeValue: $("volume-value"),
      noiseBar: $("noise-bar"),
      noiseValue: $("noise-value"),
      startThresholdBar: $("start-threshold-bar"),
      startThresholdValue: $("start-threshold-value"),
      stopThresholdBar: $("stop-threshold-bar"),
      stopThresholdValue: $("stop-threshold-value"),
      evidenceBar: $("evidence-bar"),
      evidenceValue: $("evidence-value"),
      transcript: $("current-transcript"),
      gate: $("current-gate"),
      evaluation: $("current-evaluation"),
      finalLatency: $("current-final-latency"),
      gateComparison: $("gate-comparison"),
      liveLog: $("live-log"),
      resultsBody: $("results-body"),
      summary: $("summary-output"),
      export: $("export-diagnostic"),
      copy: $("copy-summary"),
    };

    let stream;
    let audioContext;
    let analyser;
    let source;
    let recognition;
    let rafId;
    let index = 0;
    let noiseFloor = 0.025;
    let voiceCurrentlyActive = false;
    let voiceStartedAt = 0;
    let lastVoiceSampleAt = 0;
    let evidence = [];
    let currentAttempt;
    let attempts = [];
    let attemptOpen = false;

    function log(message) {
      els.liveLog.textContent = `${new Date().toLocaleTimeString("es-MX")}  ${message}\n${els.liveLog.textContent}`.slice(0, 5000);
    }

    function setState(label, className) {
      els.state.textContent = label;
      els.state.className = `state ${className}`;
    }

    function setPercent(el, value) {
      el.style.width = `${Math.max(0, Math.min(100, value))}%`;
    }

    function startThreshold() {
      return noiseFloor + Math.max(0.0035, noiseFloor * 0.5);
    }

    function stopThreshold() {
      return noiseFloor + Math.max(0.0018, noiseFloor * 0.24);
    }

    function pruneEvidence(at = now()) {
      evidence = evidence.filter((sample) => at - sample.at <= CURRENT_GATE.voiceEvidenceWindowMs);
    }

    function evidenceDuration(at = now()) {
      pruneEvidence(at);
      return evidence.reduce((sum, sample) => sum + sample.duration, 0);
    }

    function readVolume() {
      if (!analyser) return 0;
      const data = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const centered = (value - 128) / 128;
        sum += centered * centered;
      }
      return Math.sqrt(sum / data.length);
    }

    function updateVoice(volume, at = now()) {
      voiceCurrentlyActive = voiceCurrentlyActive ? volume >= stopThreshold() : volume > startThreshold();
      const elapsed = lastVoiceSampleAt ? at - lastVoiceSampleAt : 0;
      const sampleDuration = Math.max(0, Math.min(elapsed || 16, 120));
      lastVoiceSampleAt = at;
      pruneEvidence(at);

      if (voiceCurrentlyActive) {
        if (!voiceStartedAt) voiceStartedAt = at;
        if (currentAttempt && !currentAttempt.firstVoiceDetectedAt) {
          currentAttempt.firstVoiceDetectedAt = at;
          log("VOZ DETECTADA");
        }
        evidence.push({ at, duration: sampleDuration });
        setState("VOZ DETECTADA", "voice");
      } else {
        voiceStartedAt = 0;
        if (attemptOpen) setState("SILENCIO", "silence");
      }
    }

    function updateLiveMetrics(volume) {
      if (!currentAttempt) return;
      currentAttempt.noiseFloor = noiseFloor;
      currentAttempt.maxVolume = Math.max(currentAttempt.maxVolume, volume);
      currentAttempt.averageVolume += volume;
      currentAttempt.volumeSamples += 1;
      currentAttempt.voiceEvidenceDuration = evidenceDuration();
      currentAttempt.voiceActiveDuration = voiceStartedAt ? now() - voiceStartedAt : 0;

      setPercent(els.volumeBar, volume * 650);
      setPercent(els.noiseBar, noiseFloor * 650);
      setPercent(els.startThresholdBar, startThreshold() * 650);
      setPercent(els.stopThresholdBar, stopThreshold() * 650);
      setPercent(els.evidenceBar, (currentAttempt.voiceEvidenceDuration / CURRENT_GATE.minVoiceEvidenceMs) * 100);
      els.volumeValue.textContent = round(volume).toFixed(3);
      els.noiseValue.textContent = round(noiseFloor).toFixed(3);
      els.startThresholdValue.textContent = round(startThreshold()).toFixed(3);
      els.stopThresholdValue.textContent = round(stopThreshold()).toFixed(3);
      els.evidenceValue.textContent = `${Math.round(currentAttempt.voiceEvidenceDuration)} ms`;
      renderGateComparison(currentAttempt);
    }

    function tick() {
      const volume = readVolume();
      updateVoice(volume);
      updateLiveMetrics(volume);
      rafId = global.requestAnimationFrame(tick);
    }

    async function calibrateNoise() {
      const samples = [];
      const startedAt = now();
      while (now() - startedAt < 1100) {
        samples.push(readVolume());
        await new Promise((resolve) => global.setTimeout(resolve, 70));
      }
      const sorted = samples.slice().sort((left, right) => left - right);
      const median = sorted[Math.floor(sorted.length / 2)] || 0;
      const percentile75 = sorted[Math.floor(sorted.length * 0.75)] || median;
      noiseFloor = Math.max(0.006, Math.min(percentile75, median * 1.8) * 1.25);
    }

    async function prepareAudio() {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia no disponible");
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });

      audioContext = new AudioContextCtor();
      if (audioContext.state === "suspended") await audioContext.resume();

      const makeFilter = (type, frequency, q, gain) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        filter.Q.value = q;
        if (gain !== undefined) filter.gain.value = gain;
        return filter;
      };

      const highPass = makeFilter("highpass", 80, 0.7);
      const lowPass = makeFilter("lowpass", 8000, 0.7);
      const presenceBoost = makeFilter("peaking", 2500, 1, 5);
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -28;
      compressor.knee.value = 14;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.14;
      const gain = audioContext.createGain();
      gain.gain.value = 2.2;
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.58;
      source = audioContext.createMediaStreamSource(stream);
      source.connect(highPass);
      highPass.connect(lowPass);
      lowPass.connect(presenceBoost);
      presenceBoost.connect(compressor);
      compressor.connect(gain);
      gain.connect(analyser);

      log("Calibrando ruido durante 1100 ms");
      await calibrateNoise();
      log(`Noise floor calibrado: ${round(noiseFloor)}`);
      tick();
    }

    function resetAttemptUi() {
      els.transcript.textContent = "-";
      els.gate.textContent = "-";
      els.evaluation.textContent = "-";
      els.finalLatency.textContent = "-";
      renderGateComparison(createEmptyAttempt(TEST_ITEMS[index]));
    }

    function beginAttempt() {
      if (!Recognition) {
        setState("SpeechRecognition no disponible", "error");
        log("SpeechRecognition no esta disponible. Usa Chrome o Edge.");
        return;
      }
      currentAttempt = createEmptyAttempt(TEST_ITEMS[index]);
      currentAttempt.noiseFloor = noiseFloor;
      currentAttempt.recognitionStartedAt = now();
      evidence = [];
      voiceStartedAt = 0;
      lastVoiceSampleAt = 0;
      attemptOpen = true;
      resetAttemptUi();
      els.expected.textContent = currentAttempt.expected.toUpperCase();
      els.finish.disabled = false;
      els.next.disabled = true;
      els.start.disabled = true;
      setState("SILENCIO", "silence");

      recognition = new Recognition();
      recognition.lang = "es-MX";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;
      recognition.onresult = handleRecognitionResult;
      recognition.onerror = (event) => {
        if (event.error === "aborted") return;
        log(`ERROR SpeechRecognition: ${event.error}`);
      };
      recognition.onend = () => {
        if (attemptOpen) log("SpeechRecognition termino antes de cerrar el intento");
      };
      recognition.start();
      log(`Di: ${currentAttempt.expected.toUpperCase()}`);
    }

    function handleRecognitionResult(event) {
      if (!currentAttempt || !attemptOpen) return;
      let rawTranscript = "";
      let confidence = 0;
      let isFinal = false;
      const alternatives = [];

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        rawTranscript += result[0].transcript;
        confidence = Math.max(confidence, result[0].confidence || 0);
        isFinal = isFinal || result.isFinal;
        for (let altIndex = 0; altIndex < result.length; altIndex += 1) {
          alternatives.push(result[altIndex].transcript);
        }
      }

      const receivedAt = now();
      if (!currentAttempt.firstTranscriptAt) currentAttempt.firstTranscriptAt = receivedAt;
      if (!currentAttempt.voiceToInterimLatency && currentAttempt.firstVoiceDetectedAt) {
        currentAttempt.voiceToInterimLatency = Math.max(0, receivedAt - currentAttempt.firstVoiceDetectedAt);
      }
      if (isFinal) {
        currentAttempt.isFinal = true;
        currentAttempt.finalTranscriptAt = receivedAt;
        if (currentAttempt.firstVoiceDetectedAt) {
          currentAttempt.voiceToFinalLatency = Math.max(0, receivedAt - currentAttempt.firstVoiceDetectedAt);
        }
      }

      currentAttempt.rawTranscript = rawTranscript.trim();
      currentAttempt.normalizedTranscript = normalizeText(rawTranscript);
      currentAttempt.transcript = currentAttempt.normalizedTranscript;
      currentAttempt.confidence = confidence;
      currentAttempt.alternatives = [...new Set([...currentAttempt.alternatives, ...alternatives].filter(Boolean))];
      currentAttempt.recognitionEvents.push({
        rawTranscript: currentAttempt.rawTranscript,
        normalizedTranscript: currentAttempt.normalizedTranscript,
        confidence,
        isFinal,
        receivedAt,
      });

      setState("TRANSCRIPCION RECIBIDA", "transcript");
      els.transcript.textContent = currentAttempt.rawTranscript || "-";
      log(`${isFinal ? "FINAL" : "INTERIM"}: "${currentAttempt.rawTranscript}" (${Math.round(confidence * 100)}%)`);
      updateAttemptPreview();
      if (isFinal) finishAttempt();
    }

    function updateAttemptPreview() {
      if (!currentAttempt) return;
      const finishedAt = now();
      const clone = finalizeAttemptMetrics({ ...currentAttempt, alternatives: [...currentAttempt.alternatives] }, finishedAt);
      els.gate.textContent = clone.voiceGateAccepted ? "PASS" : "FAIL";
      els.gate.className = `value ${clone.voiceGateAccepted ? "pass" : "fail"}`;
      els.evaluation.textContent = `${clone.evaluationStatus} (${round(clone.evaluationScore, 2)})`;
      els.finalLatency.textContent = clone.voiceToFinalLatency === null ? "-" : `${Math.round(clone.voiceToFinalLatency)} ms`;
      renderGateComparison(clone);
    }

    function finishAttempt() {
      if (!currentAttempt || !attemptOpen) return;
      attemptOpen = false;
      try {
        recognition?.stop();
      } catch {}
      finalizeAttemptMetrics(currentAttempt, now());
      attempts.push(currentAttempt);
      updateAttemptPreview();
      renderResults();
      renderSummary();
      els.finish.disabled = true;
      els.next.disabled = index >= TEST_ITEMS.length - 1;
      els.export.disabled = false;
      els.copy.disabled = false;
      log(`Intento guardado: ${currentAttempt.expected}`);
    }

    function renderGateComparison(attempt) {
      const listeningDuration = attempt.listeningDuration
        || (attempt.recognitionStartedAt ? Math.max(0, now() - attempt.recognitionStartedAt) : 0);
      const comparisons = compareGateDurations(attempt.voiceEvidenceDuration || 0, listeningDuration);
      els.gateComparison.textContent = SIMULATED_GATES_MS
        .map((threshold) => `Gate ${threshold}: ${comparisons[threshold] ? "PASS" : "FAIL"}`)
        .join("\n");
    }

    function renderResults() {
      els.resultsBody.innerHTML = attempts.map((attempt) => `
        <tr>
          <td>${attempt.expected}</td>
          <td>${attempt.rawTranscript || "sin transcript"}</td>
          <td class="${attempt.voiceGateAccepted ? "pass" : "fail"}">${attempt.voiceGateAccepted ? "PASS" : "FAIL"}</td>
          <td>${attempt.evaluationStatus} (${round(attempt.evaluationScore, 2)})</td>
          <td>${Math.round(attempt.voiceEvidenceDuration)} ms</td>
          <td>${attempt.voiceToFinalLatency === null ? "-" : `${Math.round(attempt.voiceToFinalLatency)} ms`}</td>
        </tr>
      `).join("");
    }

    function renderSummary() {
      els.summary.textContent = formatSummaryText(attempts);
    }

    async function startTest() {
      try {
        els.start.disabled = true;
        els.start.textContent = "Solicitando permiso...";
        await prepareAudio();
        beginAttempt();
      } catch (error) {
        els.start.disabled = false;
        els.start.textContent = "Iniciar prueba de microfono";
        setState("ERROR", "error");
        log(`No se pudo iniciar: ${error.message || error.name || error}`);
      }
    }

    function nextAttempt() {
      if (attemptOpen) return;
      index += 1;
      if (index >= TEST_ITEMS.length) {
        els.next.disabled = true;
        els.start.disabled = true;
        log("Prueba completa");
        return;
      }
      beginAttempt();
    }

    els.start.addEventListener("click", startTest);
    els.finish.addEventListener("click", finishAttempt);
    els.next.addEventListener("click", nextAttempt);
    els.export.addEventListener("click", () => {
      downloadJson("lectovoz-mic-diagnostic.json", {
        createdAt: new Date().toISOString(),
        browser: getBrowserLabel(),
        gate: CURRENT_GATE,
        simulatedGatesMs: SIMULATED_GATES_MS,
        attempts,
        summary: calculateSummary(attempts),
      });
    });
    els.copy.addEventListener("click", async () => {
      const text = formatSummaryText(attempts);
      try {
        await navigator.clipboard.writeText(text);
        log("Resumen copiado");
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        log("Resumen copiado");
      }
    });

    global.addEventListener?.("pagehide", () => {
      if (rafId) global.cancelAnimationFrame(rafId);
      try { recognition?.abort(); } catch {}
      try { source?.disconnect(); } catch {}
      try { audioContext?.close(); } catch {}
      stream?.getTracks?.().forEach((track) => track.stop());
    });
  }

  global.LectoVozMicDiagnostic = {
    TEST_ITEMS,
    CURRENT_GATE,
    SIMULATED_GATES_MS,
    normalizeText,
    createEmptyAttempt,
    compareGateDurations,
    getGateRejectionReason,
    evaluateAttemptText,
    finalizeAttemptMetrics,
    calculateGroupMetrics,
    calculateSummary,
    formatSummaryText,
  };

  if (global.document) {
    global.document.addEventListener("DOMContentLoaded", bootDiagnosticUI);
  }
})(typeof window !== "undefined" ? window : globalThis);
