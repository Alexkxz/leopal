const promptEl = document.querySelector("#prompt");
const statusEl = document.querySelector("#mic-status");
const feedbackEl = document.querySelector("#feedback");
const heardEl = document.querySelector("#heard-text");
const heardFeedbackEl = document.querySelector("#heard-feedback");
const meterFill = document.querySelector("#meter-fill");
const startBtn = document.querySelector("#start-btn");
const nextBtn = document.querySelector("#next-btn");
const levelSelect = document.querySelector("#level-select");
const correctCountEl = document.querySelector("#correct-count");
const errorCountEl = document.querySelector("#error-count");
const customText = document.querySelector("#custom-text");
const useCustom = document.querySelector("#use-custom");
const noiseLevelEl = document.querySelector("#noise-level");
const voiceLevelEl = document.querySelector("#voice-level");
const confidenceLevelEl = document.querySelector("#confidence-level");
const loginScreen = document.querySelector("#login-screen");
const loginForm = document.querySelector("#login-form");
const studentNameInput = document.querySelector("#student-name");
const studentGroupInput = document.querySelector("#student-group");
const currentStudentEl = document.querySelector("#current-student");
const scoreCountEl = document.querySelector("#score-count");
const logoutBtn = document.querySelector("#logout-btn");
const activeConsonantsEl = document.querySelector("#active-consonants");
const sessionGoalCountEl = document.querySelector("#session-goal-count");
const currentActivityEl = document.querySelector("#current-activity");
const sessionProgressText = document.querySelector("#session-progress-text");
const streakCountEl = document.querySelector("#streak-count");
const missionCard = document.querySelector("#mission-card");
const missionCountEl = document.querySelector("#mission-count");
const missionScoreEl = document.querySelector("#mission-score");
const continueBtn = document.querySelector("#continue-btn");
const missionLogoutBtn = document.querySelector("#mission-logout-btn");

const Content = window.LectoVozContent;
const Academic = window.LectoVozAcademic;
const Evaluation = window.LectoVozEvaluation;
const Storage = window.LectoVozStorage;
const JsonBackup = window.LectoVozJsonBackup;
const lessons = Content.lessons;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const defaultGameConfig = Content.defaultGameConfig;

let activeText = "";
let chunks = [];
let currentIndex = 0;
let lessonIndex = 0;
let correctCount = 0;
let errorCount = 0;
let lastTranscript = "";
let pendingErrorCount = 0;
let currentSession = null;
let score = 0;
let lessonStartedAt = Date.now();
let lessonCorrect = 0;
let lessonErrors = 0;
let shuffledLessons = {};
let currentGameConfig = Content.getDefaultGameConfig();
let completedInSession = 0;
let streakCount = 0;
let advancingToNextLesson = false;
let attemptCount = 0;
let chunkAttemptRecords = [];
let notMasteredChunks = [];
let pendingTranscript = null;
let pendingTranscriptTimer = null;
let lastReadingDebug = null;
let listeningGeneration = 0;
let isTransitioning = false;
let listeningWindowStartedAt = 0;

const defaultMaxAttemptsPerChunk = 3;
const minVoiceMsForAttempt = 180;
const recognitionWarmupMs = 250;
const transcriptBufferMs = 450;

const minConfidence = 0;
const speechController = window.LectoVozSpeech.createSpeechController({
  window,
  navigator,
  recognitionCtor: SpeechRecognition,
  getCurrentSession: () => currentSession,
  getCurrentChunk: () => chunks[currentIndex],
  processTranscript,
  onMissingSession: () => {
    loginScreen.classList.remove("hidden");
    setFeedbackState("neutral", "Entra con nombre y grupo para guardar tu avance.");
  },
  setFeedback: (value) => {
    setFeedbackState("neutral", value);
  },
  setStatus: (value, isListening) => {
    statusEl.textContent = value;
    statusEl.classList.toggle("listening", isListening);
    startBtn.classList.toggle("is-listening", isListening);
  },
  setStartLabel: (value) => {
    setMicrophoneLabel(value);
  },
  setNoiseLevel: (percent) => {
    noiseLevelEl.style.width = `${percent}%`;
  },
  setVoiceLevel: (percent) => {
    voiceLevelEl.style.width = `${percent}%`;
  },
  onVoiceActivityChange: () => {
    flushPendingTranscript();
  },
  onUncertain: (reason, context) => {
    handleUncertain(reason, "", context);
  },
  getListeningContext: () => getActiveListeningContext(),
});

function normalizeText(value) {
  return Evaluation.normalizeText(value);
}

function splitIntoChunks(text) {
  return Evaluation.splitIntoChunks(text, {
    level: levelSelect.value,
    shuffleSyllables: currentGameConfig.shuffleSyllables,
  });
}

function syllabifyWord(word) {
  return Evaluation.syllabifyWord(word);
}

function isVowel(letter) {
  return Evaluation.isVowel(letter);
}

function renderPrompt() {
  promptEl.innerHTML = "";
  chunks.forEach((chunk, index) => {
    const span = document.createElement("span");
    span.className = "chunk";
    span.textContent = chunk;
    span.dataset.index = index;
    if (index === currentIndex) span.classList.add("current");
    promptEl.appendChild(span);

    if (levelSelect.value.startsWith("frases") && index < chunks.length - 1) {
      const space = document.createElement("span");
      space.className = "space";
      promptEl.appendChild(space);
    }
  });
  updateMeter();
}

function getActiveListeningContext() {
  return {
    generation: listeningGeneration,
    chunkIndex: currentIndex,
    expectedText: chunks[currentIndex] || "",
    startedAt: listeningWindowStartedAt,
  };
}

function isStaleListeningContext(context) {
  if (!context) return false;
  const eventTimeMs = Number(context.eventTimeMs);
  return (
    context.generation !== listeningGeneration
    || context.chunkIndex !== currentIndex
    || normalizeText(context.expectedText) !== normalizeText(chunks[currentIndex] || "")
    || (Number.isFinite(eventTimeMs) && eventTimeMs < listeningWindowStartedAt)
  );
}

function resetChunkRecognitionState() {
  clearPendingTranscript();
  lastTranscript = "";
  pendingErrorCount = 0;
  clearVisibleHeardTranscript();
  speechController.resetVoiceEvidence?.();
}

function openChunkListeningWindow() {
  listeningGeneration += 1;
  isTransitioning = false;
  listeningWindowStartedAt = performance.now ? performance.now() : Date.now();
  speechController.beginListeningWindow?.();
  resetChunkRecognitionState();
}

function invalidateChunkListeningWindow() {
  listeningGeneration += 1;
  isTransitioning = true;
  listeningWindowStartedAt = performance.now ? performance.now() : Date.now();
  speechController.beginListeningWindow?.();
  resetChunkRecognitionState();
}

function finishChunkTransition() {
  isTransitioning = false;
}

function setFeedbackState(state, message) {
  feedbackEl.textContent = message;
  feedbackEl.classList.remove("feedback-correct", "feedback-uncertain", "feedback-approximate", "feedback-incorrect");
  if (state !== "neutral") feedbackEl.classList.add(`feedback-${state}`);
}

function setVisibleHeardTranscript(value) {
  const transcript = getDisplayTranscript(value);
  if (!heardFeedbackEl || !transcript) {
    clearVisibleHeardTranscript();
    return;
  }
  const strong = heardFeedbackEl.querySelector?.("strong");
  if (strong) strong.textContent = transcript;
  else heardFeedbackEl.textContent = `Escuché: "${transcript}"`;
  heardFeedbackEl.dataset.transcript = transcript;
  heardFeedbackEl.setAttribute?.("aria-label", `Escuché: ${transcript}`);
  heardFeedbackEl.hidden = false;
}

function clearVisibleHeardTranscript() {
  if (!heardFeedbackEl) return;
  const strong = heardFeedbackEl.querySelector?.("strong");
  if (strong) strong.textContent = "";
  else heardFeedbackEl.textContent = "";
  heardFeedbackEl.dataset.transcript = "";
  heardFeedbackEl.removeAttribute?.("aria-label");
  heardFeedbackEl.hidden = true;
}

function getDisplayTranscript(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function attachTranscriptFeedback(evaluation, rawTranscript) {
  if (!evaluation) return evaluation;
  const heardText = getDisplayTranscript(rawTranscript);
  return {
    ...evaluation,
    expectedRaw: chunks[currentIndex] || evaluation.normalizedExpected,
    spokenRaw: rawTranscript,
    rawTranscript,
    heardText,
  };
}

function buildAttemptFeedback(evaluation, fallbackMessage) {
  const expected = evaluation.normalizedExpected || chunks[currentIndex] || "";
  if (evaluation.status === "approximate") {
    return `\u26a0 Casi.\nIntenta nuevamente: "${expected}"`;
  }
  if (evaluation.status === "incorrect") {
    return `\u2715 Otra palabra.\n${fallbackMessage || `Intenta nuevamente: "${expected}"`}`;
  }
  return fallbackMessage || "";
}

function createUncertainEvaluation(reason, rawTranscript = "") {
  return {
    status: "uncertain",
    score: 0,
    reason,
    spoken: "",
    expected: normalizeText(chunks[currentIndex] || ""),
    normalizedSpoken: "",
    normalizedExpected: normalizeText(chunks[currentIndex] || ""),
    rawTranscript,
    heardText: "",
  };
}

function handleUncertain(reason, rawTranscript = "", listeningContext = getActiveListeningContext()) {
  if (isTransitioning || isStaleListeningContext(listeningContext)) return null;
  const metrics = speechController.getDebugMetrics?.();
  const evaluation = createUncertainEvaluation(reason, rawTranscript);
  lastReadingDebug = {
    expected: chunks[currentIndex] || "",
    rawTranscript: "",
    normalizedTranscript: normalizeText(rawTranscript),
    evaluationStatus: evaluation.status,
    uncertaintyReason: reason,
    voiceEvidenceMs: Number(metrics?.voiceEvidenceDuration || 0),
    listeningGeneration,
  };
  confidenceLevelEl.textContent = "-";
  if (rawTranscript) setVisibleHeardTranscript(rawTranscript);
  else clearVisibleHeardTranscript();
  setFeedbackState(
    "uncertain",
    rawTranscript
      ? "\u26a0 No estoy seguro.\nIntenta nuevamente."
      : "\u26a0 No pude escucharte con claridad.\nIntenta nuevamente.",
  );
  return evaluation;
}

function setMicrophoneLabel(value) {
  const normalized = value.toLowerCase();
  const isListeningLabel = normalized.includes("escuchando");
  const isPermissionLabel = normalized.includes("permitir") || normalized.includes("solicitando");
  const icon = isListeningLabel ? "&#9208;" : "&#127908;";
  const label = isListeningLabel ? "Pausar" : isPermissionLabel ? value : "Comenzar partida";
  startBtn.innerHTML = `
    <span aria-hidden="true">${icon}</span>
    <span>${label}</span>
  `;
}

function getLevelLabel(level) {
  const labels = {
    silabas: "Silabas",
    palabras_cortas: "Palabras pequenas",
    palabras_medianas: "Palabras medianas",
    palabras_largas: "Palabras grandes",
    frases_cortas: "Frases cortas",
    frases_medianas: "Frases medianas",
    frases_largas: "Frases largas",
  };
  return labels[level] || "Lectura";
}

function setLesson(text) {
  activeText = normalizeText(text);
  chunks = splitIntoChunks(activeText);
  currentIndex = 0;
  advancingToNextLesson = false;
  attemptCount = 0;
  chunkAttemptRecords = [];
  notMasteredChunks = [];
  lastTranscript = "";
  pendingErrorCount = 0;
  clearPendingTranscript();
  lessonStartedAt = Date.now();
  lessonCorrect = 0;
  lessonErrors = 0;
  heardEl.textContent = "-";
  openChunkListeningWindow();
  hideMissionComplete();
  setFeedbackState("neutral", "Lee en voz alta. El microfono ira siguiendo tu lectura.");
  renderPrompt();
}

function loadCurrentLesson() {
  const list = getLessonList(levelSelect.value);
  if (!list.length) {
    setLesson("ma me mi mo mu");
    setFeedbackState("neutral", "No hay ejercicios para esas consonantes en este nivel.");
    return;
  }
  setLesson(list[lessonIndex % list.length]);
}

function getLessonList(level) {
  const allowedKey = getAllowedConsonants().join("-");
  const shuffleKey = `${level}:${allowedKey}`;
  const baseLessons = getConfiguredLessons(level);

  if (!shuffledLessons[shuffleKey] || shuffledLessons[shuffleKey].length !== baseLessons.length) {
    shuffledLessons[shuffleKey] = shuffleList(baseLessons);
  }
  return shuffledLessons[shuffleKey];
}

function getConfiguredLessons(level) {
  const list = lessons[level] || [];
  const allowed = getAllowedConsonants();
  if (!allowed.length) return list;

  const filtered = list.filter((text) => usesOnlyAllowedConsonants(text, allowed));
  return filtered.length ? filtered : list;
}

function getAllowedConsonants() {
  return [...new Set(currentGameConfig.consonants || defaultGameConfig.consonants)].map(normalizeConsonant);
}

function normalizeConsonant(value) {
  return Evaluation.normalizeConsonant(value);
}

function usesOnlyAllowedConsonants(text, allowedConsonants) {
  return Evaluation.usesOnlyAllowedConsonants(text, allowedConsonants);
}

function getTextConsonants(text) {
  return Evaluation.getTextConsonants(text);
}

function shuffleList(list) {
  return Evaluation.shuffleList(list);
}

function updateMeter() {
  const goal = Number(currentGameConfig.sessionGoal || 10);
  const progress = Math.min(completedInSession, goal);
  meterFill.style.width = goal ? `${Math.round((progress / goal) * 100)}%` : "0%";
  sessionProgressText.textContent = `${progress} / ${goal}`;
}

function markChunk(index, state) {
  const el = promptEl.querySelector(`[data-index="${index}"]`);
  if (!el) return;
  el.classList.remove("current", "correct", "approximate", "error", "not-mastered");
  el.classList.add(state);
}

function setCurrent(index) {
  promptEl.querySelectorAll(".chunk").forEach((el) => el.classList.remove("current", "approximate", "error", "not-mastered"));
  const el = promptEl.querySelector(`[data-index="${index}"]`);
  if (el) el.classList.add("current");
}

function markCurrentApproximate() {
  const el = promptEl.querySelector(`[data-index="${currentIndex}"]`);
  if (!el) return;
  el.classList.remove("current", "error");
  el.classList.add("approximate");
}

function chunkMatches(spoken, expected) {
  return Evaluation.chunkMatches(spoken, expected);
}

function evaluateReading(spoken, expected) {
  return Evaluation.evaluateReading(spoken, expected);
}

function scoreMatch(spoken, expected) {
  return Evaluation.scoreMatch(spoken, expected);
}

function getMatchThreshold(expected) {
  return Evaluation.getMatchThreshold(expected);
}

function phoneticKey(value) {
  return Evaluation.phoneticKey(value);
}

function buildSpokenCandidates(transcript) {
  return Evaluation.buildSpokenCandidates(transcript);
}

function canAdvanceWithTranscript(transcript, expected) {
  return Evaluation.canAdvanceWithTranscript(transcript, expected);
}

function findError(spokenWords, expected) {
  return Evaluation.findError(spokenWords, expected);
}

function getBestReadingEvaluation(candidateTranscripts, expected) {
  const candidates = candidateTranscripts.flatMap((transcript) => (
    buildSpokenCandidates(transcript).map((candidate) => ({ candidate, transcript }))
  ));
  return candidates
    .map(({ candidate, transcript }) => attachTranscriptFeedback(evaluateReading(candidate, expected), transcript))
    .sort((left, right) => right.score - left.score)[0];
}

function hasVoiceAttemptReady() {
  const overrideMs = window.__lectovozVoiceGateOverrideMs;
  const voiceMs = Number.isFinite(overrideMs)
    ? overrideMs
    : Number(speechController.getVoiceEvidenceDuration?.() || speechController.getVoiceActiveDuration?.() || 0);
  const listeningOverrideMs = window.__lectovozListeningGateOverrideMs;
  const listeningMs = Number.isFinite(listeningOverrideMs)
    ? listeningOverrideMs
    : Number(speechController.getListeningDuration?.() || 0);
  return voiceMs >= minVoiceMsForAttempt && listeningMs >= recognitionWarmupMs;
}

function shouldBufferTranscript() {
  const overrideMs = window.__lectovozVoiceGateOverrideMs;
  if (Number.isFinite(overrideMs)) {
    return overrideMs >= 60 && overrideMs < minVoiceMsForAttempt;
  }
  const metrics = speechController.getDebugMetrics?.();
  const voiceEvidence = Number(metrics?.voiceEvidenceDuration || 0);
  return voiceEvidence >= 60 && voiceEvidence < minVoiceMsForAttempt;
}

function clearPendingTranscript() {
  if (pendingTranscriptTimer) {
    window.clearTimeout?.(pendingTranscriptTimer);
    pendingTranscriptTimer = null;
  }
  pendingTranscript = null;
}

function queuePendingTranscript(transcript, confidence, isFinal, alternatives, context) {
  pendingTranscript = {
    transcript,
    confidence,
    isFinal,
    alternatives,
    context,
    receivedAt: Date.now(),
  };
  if (pendingTranscriptTimer) return;
  pendingTranscriptTimer = window.setTimeout(() => {
    pendingTranscriptTimer = null;
    flushPendingTranscript(true);
  }, transcriptBufferMs);
}

function flushPendingTranscript(expire = false) {
  if (!pendingTranscript) return;
  if (isTransitioning || isStaleListeningContext(pendingTranscript.context)) {
    clearPendingTranscript();
    return;
  }
  if (!hasVoiceAttemptReady()) {
    if (expire || Date.now() - pendingTranscript.receivedAt > transcriptBufferMs) {
      clearPendingTranscript();
    }
    return;
  }

  const nextTranscript = pendingTranscript;
  clearPendingTranscript();
  processTranscript(
    nextTranscript.transcript,
    nextTranscript.confidence,
    nextTranscript.isFinal,
    nextTranscript.alternatives,
    nextTranscript.context,
  );
}

function normalizeMaxAttemptsPerChunk(value) {
  const attempts = Number(value);
  return [1, 2, 3].includes(attempts) ? attempts : defaultMaxAttemptsPerChunk;
}

function getMaxAttemptsPerChunk() {
  return normalizeMaxAttemptsPerChunk(currentGameConfig.maxAttemptsPerChunk);
}

function describeObservedDifference(expected, spoken) {
  const expectedSyllables = syllabifyWord(expected);
  const spokenSyllables = syllabifyWord(spoken);
  if (expectedSyllables.length === spokenSyllables.length) {
    const index = expectedSyllables.findIndex((part, partIndex) => part !== spokenSyllables[partIndex]);
    if (index >= 0) {
      return {
        expectedPart: expectedSyllables[index],
        recognizedPart: spokenSyllables[index],
      };
    }
  }

  const limit = Math.min(expected.length, spoken.length);
  for (let index = 0; index < limit; index += 1) {
    if (expected[index] !== spoken[index]) {
      return {
        expectedPart: expected[index],
        recognizedPart: spoken[index],
      };
    }
  }

  if (expected.length !== spoken.length) {
    return {
      expectedPart: expected.slice(limit) || "",
      recognizedPart: spoken.slice(limit) || "",
    };
  }

  return undefined;
}

function registerChunkAttempt(evaluation) {
  attemptCount += 1;
  const attempt = {
    expected: evaluation.normalizedExpected,
    spoken: evaluation.normalizedSpoken,
    heardText: evaluation.heardText || "",
    rawTranscript: evaluation.rawTranscript || evaluation.spokenRaw || "",
    status: "attempt",
    attempts: attemptCount,
    evaluationStatus: evaluation.status,
    evaluationScore: evaluation.score,
    observedDifference: describeObservedDifference(evaluation.normalizedExpected, evaluation.normalizedSpoken),
  };
  chunkAttemptRecords.push(attempt);
  return attempt;
}

function handleUnmasteredChunk(evaluation) {
  const record = {
    expected: evaluation.normalizedExpected,
    spoken: evaluation.normalizedSpoken,
    heardText: evaluation.heardText || "",
    rawTranscript: evaluation.rawTranscript || evaluation.spokenRaw || "",
    status: "not_mastered",
    attempts: attemptCount,
    evaluationStatus: evaluation.status,
    evaluationScore: evaluation.score,
    observedDifference: describeObservedDifference(evaluation.normalizedExpected, evaluation.normalizedSpoken),
  };
  notMasteredChunks.push(record);
  markChunk(currentIndex, "not-mastered");
  errorCount += 1;
  lessonErrors += 1;
  errorCountEl.textContent = errorCount;
  streakCount = 0;
  updateStreak();
  invalidateChunkListeningWindow();
  currentIndex += 1;
  attemptCount = 0;
  setFeedbackState(
    evaluation.status === "approximate" ? "approximate" : "incorrect",
    buildAttemptFeedback(evaluation, "Seguiremos practicando esta palabra."),
  );

  if (currentIndex >= chunks.length) {
    speechController.markEvaluationComplete?.();
    advancingToNextLesson = true;
    savePracticeRecord("completed");
    completedInSession += 1;
    updateMeter();
    continueAfterCompletedLesson();
    return;
  }

  setCurrent(currentIndex);
  finishChunkTransition();
}

function handleChunkAttempt(evaluation) {
  registerChunkAttempt(evaluation);
  lastTranscript = "";

  if (attemptCount >= getMaxAttemptsPerChunk()) {
    handleUnmasteredChunk(evaluation);
    return;
  }

  if (evaluation.status === "approximate") {
    markCurrentApproximate();
  } else {
    markChunk(currentIndex, "error");
  }

  const message = `Intenta nuevamente: "${evaluation.normalizedExpected}"`;
  setVisibleHeardTranscript(evaluation.heardText || evaluation.rawTranscript);
  setFeedbackState(
    evaluation.status === "approximate" ? "approximate" : "incorrect",
    buildAttemptFeedback(evaluation, message),
  );
  window.setTimeout(() => setCurrent(currentIndex), 700);
}

function continueAfterCompletedLesson() {
  if (completedInSession >= Number(currentGameConfig.sessionGoal || 10)) {
    showMissionComplete();
    stopListening(false);
    return;
  }

  window.setTimeout(() => {
    lessonIndex += 1;
    loadCurrentLesson();
    if (speechController.isListening()) {
      setFeedbackState("neutral", `Lee ahora: ${chunks[currentIndex]}`);
    }
  }, 900);
}

function processTranscript(transcript, confidence = 1, isFinal = false, alternatives = [], listeningContext = getActiveListeningContext()) {
  if (isTransitioning || isStaleListeningContext(listeningContext)) return;
  const rawTranscript = getDisplayTranscript(transcript);
  const clean = normalizeText(transcript);
  const metrics = speechController.getDebugMetrics?.();
  lastReadingDebug = {
    expected: chunks[currentIndex] || "",
    rawTranscript,
    normalizedTranscript: clean,
    evaluationStatus: clean ? "pending" : "no_transcript",
    voiceEvidenceMs: Number(metrics?.voiceEvidenceDuration || 0),
  };
  if (advancingToNextLesson) return;
  if (!clean) {
    if (isFinal) handleUncertain("empty_transcript", rawTranscript, listeningContext);
    return;
  }
  if (clean === lastTranscript) return;
  if (!isFinal && confidence > 0 && confidence < minConfidence) return;
  if (!hasVoiceAttemptReady()) {
    if (shouldBufferTranscript()) queuePendingTranscript(transcript, confidence, isFinal, alternatives, listeningContext);
    else if (isFinal) handleUncertain("insufficient_voice_evidence", rawTranscript, listeningContext);
    return;
  }
  if (pendingTranscript && normalizeText(pendingTranscript.transcript) === clean) {
    clearPendingTranscript();
  }

  lastTranscript = clean;
  heardEl.textContent = rawTranscript || clean;
  setVisibleHeardTranscript(rawTranscript || transcript);
  confidenceLevelEl.textContent = confidence > 0 ? `${Math.round(confidence * 100)}%` : "-";

  const candidateTranscripts = [rawTranscript || transcript, ...alternatives].filter((candidate) => normalizeText(candidate));
  let advanced = 0;

  if (
    currentIndex < chunks.length
    && candidateTranscripts.some((candidate) => canAdvanceWithTranscript(candidate, chunks[currentIndex]))
  ) {
    pendingErrorCount = 0;
    markChunk(currentIndex, "correct");
    correctCount += 1;
    lessonCorrect += 1;
    correctCountEl.textContent = correctCount;
    updateScore(10);
    attemptCount = 0;
    streakCount += 1;
    updateStreak();
    invalidateChunkListeningWindow();
    currentIndex += 1;
    advanced += 1;
    updateMeter();
  }

  if (currentIndex >= chunks.length) {
    advancingToNextLesson = true;
    setFeedbackState("correct", "\u2713 ¡Muy bien!");
    savePracticeRecord("completed");
    completedInSession += 1;
    updateMeter();
    continueAfterCompletedLesson();
    return;
  }

  if (advanced > 0) {
    speechController.markEvaluationComplete?.();
    setCurrent(currentIndex);
    setFeedbackState("correct", `\u2713 ¡Excelente! Sigue con: ${chunks[currentIndex]}`);
    finishChunkTransition();
    return;
  }

  const expected = chunks[currentIndex];
  const bestEvaluation = getBestReadingEvaluation(candidateTranscripts, expected);
  if (bestEvaluation) lastReadingDebug.evaluationStatus = bestEvaluation.status;
  if (bestEvaluation?.status === "approximate" && isFinal) {
    speechController.markEvaluationComplete?.();
    pendingErrorCount = 0;
    streakCount = 0;
    updateStreak();
    handleChunkAttempt(bestEvaluation);
    return;
  }

  if (bestEvaluation?.status === "incorrect" && isFinal) {
    speechController.markEvaluationComplete?.();
    pendingErrorCount = 0;
    handleChunkAttempt(bestEvaluation);
  }
}

async function startListening() {
  await speechController.start();
}

function stopListening(updateText = true) {
  speechController.stop(updateText);
}

function closeListening(updateText = true) {
  speechController.close(updateText);
}

function getRecords() {
  return Storage.getRecords();
}

function savePracticeRecord(status) {
  if (!currentSession || !chunks.length) return;

  const total = chunks.length;
  const accuracy = Math.max(0, Math.round((lessonCorrect / Math.max(lessonCorrect + lessonErrors, 1)) * 100));
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    status,
    studentId: currentSession.studentId || "",
    student: currentSession.student,
    schoolId: currentSession.schoolId || "",
    grade: currentSession.grade || "Sin especificar",
    group: currentSession.group,
    level: levelSelect.value,
    text: activeText,
    correct: lessonCorrect,
    errors: lessonErrors,
    total,
    score,
    sessionGoal: currentGameConfig.sessionGoal,
    consonants: currentGameConfig.consonants,
    shuffleSyllables: currentGameConfig.shuffleSyllables,
    chunkAttempts: chunkAttemptRecords,
    notMasteredChunks,
    accuracy,
    transcript: lastTranscript || "-",
    durationSeconds: Math.max(1, Math.round((Date.now() - lessonStartedAt) / 1000)),
    createdAt: new Date().toISOString(),
  };

  Storage.addPracticeRecord(record);
  autoSaveOpenedBackup();
}

function updateScore(points) {
  score = Math.max(0, score + points);
  scoreCountEl.textContent = score;
  missionScoreEl.textContent = score;
}

function updateStreak() {
  streakCountEl.textContent = streakCount;
}

function showMissionComplete() {
  missionCountEl.textContent = completedInSession;
  missionScoreEl.textContent = score;
  missionCard.hidden = false;
  autoSaveOpenedBackup();
  setFeedbackState("correct", "¡Misión completada!");
}

function autoSaveOpenedBackup() {
  JsonBackup?.autoSaveOpenedBackup?.().catch(() => {});
}

function hideMissionComplete() {
  missionCard.hidden = true;
}

async function goToNextLesson(options = {}) {
  hideMissionComplete();
  lessonIndex += 1;
  loadCurrentLesson();
  if (options.resumeListening) {
    await startListening();
  }
}

function restoreSession() {
  currentSession = Storage.getSession();

  if (!currentSession) return;
  const registeredStudent = findRegisteredStudent(currentSession.student, currentSession.group);
  const fallbackSchool = getDefaultSchoolForSession();
  currentGameConfig = normalizeGameConfig(registeredStudent?.config || currentSession.config);
  currentSession = {
    ...currentSession,
    studentId: registeredStudent?.id || currentSession.studentId || "",
    schoolId: registeredStudent?.schoolId || currentSession.schoolId || fallbackSchool?.id || "",
    grade: registeredStudent?.grade || currentSession.grade || Academic?.defaultGrade || "Sin especificar",
    config: currentGameConfig,
  };
  Storage.saveSession(currentSession);
  applyGameConfig();
  loginScreen.classList.add("hidden");
  currentStudentEl.textContent = currentSession.student;
}

function createSession(student, group) {
  const registeredStudent = findRegisteredStudent(student, group);
  const fallbackSchool = getDefaultSchoolForSession();
  const config = normalizeGameConfig(registeredStudent?.config);
  currentSession = {
    studentId: registeredStudent?.id || "",
    student,
    schoolId: registeredStudent?.schoolId || fallbackSchool?.id || "",
    grade: registeredStudent?.grade || Academic?.defaultGrade || "Sin especificar",
    group,
    config,
    startedAt: new Date().toISOString(),
  };
  currentGameConfig = config;
  completedInSession = 0;
  streakCount = 0;
  updateStreak();
  Storage.saveSession(currentSession);
  applyGameConfig();
  loginScreen.classList.add("hidden");
  currentStudentEl.textContent = student;
}

function getRegisteredStudents() {
  return Storage.getStudents();
}

function findRegisteredStudent(student, group) {
  const cleanStudent = normalizeText(student);
  const cleanGroup = normalizeText(group);
  return getRegisteredStudents().find((item) => (
    normalizeText(item.name) === cleanStudent && normalizeText(item.group) === cleanGroup
  ));
}

function getDefaultSchoolForSession() {
  const schools = Storage.getSchools?.() || [];
  return schools.find((school) => school.id === Academic?.defaultSchoolId) || schools[0];
}

function normalizeGameConfig(config) {
  return {
    ...defaultGameConfig,
    ...(config || {}),
    consonants: Array.isArray(config?.consonants) && config.consonants.length
      ? config.consonants
      : defaultGameConfig.consonants,
    sessionGoal: Number(config?.sessionGoal || defaultGameConfig.sessionGoal),
    shuffleSyllables: Boolean(config?.shuffleSyllables),
    maxAttemptsPerChunk: normalizeMaxAttemptsPerChunk(config?.maxAttemptsPerChunk),
  };
}

function applyGameConfig() {
  if (lessons[currentGameConfig.levelStart]) {
    levelSelect.value = currentGameConfig.levelStart;
  }
  lessonIndex = 0;
  shuffledLessons = {};
  updateGameConfigSummary();
  loadCurrentLesson();
}

function updateGameConfigSummary() {
  activeConsonantsEl.textContent = getAllowedConsonants().length;
  sessionGoalCountEl.textContent = currentGameConfig.sessionGoal;
  currentActivityEl.textContent = getLevelLabel(levelSelect.value);
  updateMeter();
}

function readVolume() {
  return speechController.readVolume();
}

function isVoiceActive() {
  return speechController.isVoiceActive();
}

function normalizedDistance(a, b) {
  return Evaluation.normalizedDistance(a, b);
}

function diceSimilarity(a, b) {
  return Evaluation.diceSimilarity(a, b);
}

function makePairs(value) {
  return Evaluation.makePairs(value);
}

function levenshtein(a, b) {
  return Evaluation.levenshtein(a, b);
}

function getPedagogicalState() {
  return {
    currentIndex,
    attemptCount,
    chunkAttempts: chunkAttemptRecords,
    notMasteredChunks,
    lastReadingDebug,
    listeningGeneration,
    listeningWindowStartedAt,
    isTransitioning,
    getUserMediaCalls: undefined,
  };
}

startBtn.addEventListener("click", () => {
  if (speechController.isListening()) {
    stopListening();
  } else {
    startListening();
  }
});

nextBtn.addEventListener("click", () => {
  goToNextLesson();
});

levelSelect.addEventListener("change", () => {
  stopListening(false);
  lessonIndex = 0;
  updateGameConfigSummary();
  loadCurrentLesson();
});

useCustom.addEventListener("click", () => {
  const value = customText.value.trim();
  if (!value) return;
  stopListening(false);
  setLesson(value);
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const student = studentNameInput.value.trim();
  const group = studentGroupInput.value.trim();
  if (!student || !group) return;
  createSession(student, group);
});

logoutBtn.addEventListener("click", () => {
  closeListening(false);
  Storage.clearSession();
  currentSession = null;
  currentGameConfig = Content.getDefaultGameConfig();
  completedInSession = 0;
  streakCount = 0;
  updateStreak();
  updateMeter();
  hideMissionComplete();
  loginScreen.classList.remove("hidden");
  currentStudentEl.textContent = "Invitado";
});

continueBtn.addEventListener("click", () => goToNextLesson({ resumeListening: true }));
missionLogoutBtn.addEventListener("click", () => logoutBtn.click());

if (typeof window.addEventListener === "function") {
  window.addEventListener("pagehide", () => {
    closeListening(false);
  });
}

restoreSession();
if (!currentSession) loadCurrentLesson();
updateGameConfigSummary();
updateStreak();
