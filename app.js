const promptEl = document.querySelector("#prompt");
const statusEl = document.querySelector("#mic-status");
const feedbackEl = document.querySelector("#feedback");
const heardEl = document.querySelector("#heard-text");
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
const Evaluation = window.LectoVozEvaluation;
const Storage = window.LectoVozStorage;
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

function setFeedbackState(state, message) {
  feedbackEl.textContent = message;
  feedbackEl.classList.remove("feedback-correct", "feedback-approximate", "feedback-incorrect");
  if (state !== "neutral") feedbackEl.classList.add(`feedback-${state}`);
}

function setMicrophoneLabel(value) {
  const normalized = value.toLowerCase();
  const isListeningLabel = normalized.includes("escuchando");
  const isPermissionLabel = normalized.includes("permitir") || normalized.includes("solicitando");
  startBtn.innerHTML = `
    <span aria-hidden="true">&#127908;</span>
    <span>${isListeningLabel ? "Escuchando..." : isPermissionLabel ? value : "Continuar lectura"}</span>
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
  lastTranscript = "";
  pendingErrorCount = 0;
  lessonStartedAt = Date.now();
  lessonCorrect = 0;
  lessonErrors = 0;
  heardEl.textContent = "-";
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
  el.classList.remove("current", "correct", "approximate", "error");
  el.classList.add(state);
}

function setCurrent(index) {
  promptEl.querySelectorAll(".chunk").forEach((el) => el.classList.remove("current", "approximate", "error"));
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
  const candidates = candidateTranscripts.flatMap((candidate) => buildSpokenCandidates(candidate));
  return candidates
    .map((candidate) => evaluateReading(candidate, expected))
    .sort((left, right) => right.score - left.score)[0];
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

function processTranscript(transcript, confidence = 1, isFinal = false, alternatives = []) {
  const clean = normalizeText(transcript);
  if (!clean || clean === lastTranscript) return;
  if (advancingToNextLesson) return;
  if (!isFinal && confidence > 0 && confidence < minConfidence) return;

  lastTranscript = clean;
  heardEl.textContent = clean;
  confidenceLevelEl.textContent = confidence > 0 ? `${Math.round(confidence * 100)}%` : "-";

  const spokenWords = clean.split(" ").filter(Boolean);
  const candidateTranscripts = [clean, ...alternatives.map(normalizeText)].filter(Boolean);
  let advanced = 0;

  while (
    currentIndex < chunks.length
    && candidateTranscripts.some((candidate) => canAdvanceWithTranscript(candidate, chunks[currentIndex]))
  ) {
    pendingErrorCount = 0;
    markChunk(currentIndex, "correct");
    correctCount += 1;
    lessonCorrect += 1;
    correctCountEl.textContent = correctCount;
    updateScore(10);
    streakCount += 1;
    updateStreak();
    currentIndex += 1;
    advanced += 1;
    updateMeter();
  }

  if (currentIndex >= chunks.length) {
    advancingToNextLesson = true;
    setFeedbackState("correct", "¡Muy bien!");
    savePracticeRecord("completed");
    completedInSession += 1;
    updateMeter();
    continueAfterCompletedLesson();
    return;
  }

  if (advanced > 0) {
    setCurrent(currentIndex);
    setFeedbackState("correct", `¡Excelente! Sigue con: ${chunks[currentIndex]}`);
    return;
  }

  const expected = chunks[currentIndex];
  const bestEvaluation = getBestReadingEvaluation(candidateTranscripts, expected);
  if (bestEvaluation?.status === "approximate") {
    pendingErrorCount = 0;
    streakCount = 0;
    updateStreak();
    markCurrentApproximate();
    setFeedbackState("approximate", "¡Casi! Intentalo otra vez");
    window.setTimeout(() => setCurrent(currentIndex), 700);
    return;
  }

  if (findError(spokenWords, expected)) {
    pendingErrorCount += isFinal ? 2 : 1;
    if (pendingErrorCount < 2) return;

    markChunk(currentIndex, "error");
    errorCount += 1;
    lessonErrors += 1;
    errorCountEl.textContent = errorCount;
    updateScore(-2);
    streakCount = 0;
    updateStreak();
    setFeedbackState("incorrect", "Vamos otra vez");
    pendingErrorCount = 0;
    window.setTimeout(() => setCurrent(currentIndex), 650);
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
    student: currentSession.student,
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
    accuracy,
    transcript: lastTranscript || "-",
    durationSeconds: Math.max(1, Math.round((Date.now() - lessonStartedAt) / 1000)),
    createdAt: new Date().toISOString(),
  };

  Storage.addPracticeRecord(record);
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
  setFeedbackState("correct", "¡Misión completada!");
}

function hideMissionComplete() {
  missionCard.hidden = true;
}

function goToNextLesson() {
  hideMissionComplete();
  lessonIndex += 1;
  loadCurrentLesson();
}

function restoreSession() {
  currentSession = Storage.getSession();

  if (!currentSession) return;
  const registeredStudent = findRegisteredStudent(currentSession.student, currentSession.group);
  currentGameConfig = normalizeGameConfig(registeredStudent?.config || currentSession.config);
  currentSession = {
    ...currentSession,
    studentId: registeredStudent?.id || currentSession.studentId || "",
    config: currentGameConfig,
  };
  Storage.saveSession(currentSession);
  applyGameConfig();
  loginScreen.classList.add("hidden");
  currentStudentEl.textContent = currentSession.student;
}

function createSession(student, group) {
  const registeredStudent = findRegisteredStudent(student, group);
  const config = normalizeGameConfig(registeredStudent?.config);
  currentSession = {
    studentId: registeredStudent?.id || "",
    student,
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

function normalizeGameConfig(config) {
  return {
    ...defaultGameConfig,
    ...(config || {}),
    consonants: Array.isArray(config?.consonants) && config.consonants.length
      ? config.consonants
      : defaultGameConfig.consonants,
    sessionGoal: Number(config?.sessionGoal || defaultGameConfig.sessionGoal),
    shuffleSyllables: Boolean(config?.shuffleSyllables),
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

continueBtn.addEventListener("click", goToNextLesson);
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
