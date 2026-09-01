const Storage = window.LectoVozStorage;
const TeacherControl = window.LectoVozTeacherControl;
const JsonBackup = window.LectoVozJsonBackup;
const Content = window.LectoVozContent;
const Academic = window.LectoVozAcademic;
const defaultConsonants = TeacherControl.getDefaultConsonants();

const tabs = document.querySelectorAll(".tab-button");
const panels = document.querySelectorAll(".control-panel");
const tabLinks = document.querySelectorAll("[data-tab-link]");
const settingsToggle = document.querySelector("#settings-toggle");
const settingsPanel = document.querySelector("#settings-panel");
const classroomContext = document.querySelector("#classroom-context");
const studentForm = document.querySelector("#student-form");
const newPlayerToggle = document.querySelector("#new-player-toggle");
const studentNameInput = document.querySelector("#new-student-name");
const studentGroupInput = document.querySelector("#new-student-group");
const studentSearch = document.querySelector("#student-search");
const studentList = document.querySelector("#student-list");
const studentsEmpty = document.querySelector("#students-empty");
const studentCount = document.querySelector("#student-count");
const selectedStudentName = document.querySelector("#selected-student-name");
const selectedStudentMeta = document.querySelector("#selected-student-meta");
const deleteStudentBtn = document.querySelector("#delete-student-btn");
const categoryStart = document.querySelector("#category-start");
const categoryCards = document.querySelectorAll(".category-card");
const sublevelGrid = document.querySelector("#sublevel-grid");
const levelStart = document.querySelector("#level-start");
const consonantsSection = document.querySelector("#consonants-section");
const consonantGrid = document.querySelector("#consonant-grid");
const selectAllConsonantsBtn = document.querySelector("#select-all-consonants");
const sessionGoal = document.querySelector("#session-goal");
const goalButtons = document.querySelector("#goal-buttons");
const maxAttemptsPerChunk = document.querySelector("#max-attempts-per-chunk");
const attemptButtons = document.querySelector("#attempt-buttons");
const shuffleSyllables = document.querySelector("#shuffle-syllables");
const customNotes = document.querySelector("#custom-notes");
const saveConfigBtn = document.querySelector("#save-config-btn");
const saveFeedback = document.querySelector("#save-feedback");
const missionPreviewTitle = document.querySelector("#mission-preview-title");
const missionPreview = document.querySelector("#mission-preview");
const summaryStudents = document.querySelector("#summary-students");
const summaryReady = document.querySelector("#summary-ready");
const summaryProgress = document.querySelector("#summary-progress");
const summaryUnconfigured = document.querySelector("#summary-unconfigured");
const progressTotalStudents = document.querySelector("#progress-total-students");
const progressReady = document.querySelector("#progress-ready");
const progressInProgress = document.querySelector("#progress-in-progress");
const progressUnconfigured = document.querySelector("#progress-unconfigured");
const progressStudentName = document.querySelector("#progress-student-name");
const progressSummary = document.querySelector("#progress-summary");
const bulkStudentList = document.querySelector("#bulk-student-list");
const bulkCount = document.querySelector("#bulk-count");
const applyBulkConfigBtn = document.querySelector("#apply-bulk-config-btn");
const backupStatus = document.querySelector("#backup-status");
const backupImportMode = document.querySelector("#backup-import-mode");
const backupAutosave = document.querySelector("#backup-autosave");
const exportBackupBtn = document.querySelector("#export-backup-btn");
const importBackupBtn = document.querySelector("#import-backup-btn");
const openBackupFileBtn = document.querySelector("#open-backup-file-btn");
const saveOpenBackupBtn = document.querySelector("#save-open-backup-btn");
const backupFileInput = document.querySelector("#backup-file-input");

const sublevelsByCategory = {
  syllables: [
    { id: "syllables", label: "Silabas" },
    { id: "segmentedWords", label: "Palabras silabeadas" },
  ],
  words: [
    { id: "simpleWords", label: "Simples" },
    { id: "complexWords", label: "Complejas" },
  ],
  sentences: [
    { id: "shortSentences", label: "Cortas" },
    { id: "longSentences", label: "Amplias" },
  ],
};

let selectedStudentId = "";
let studentFilter = "";
let selectedBulkIds = new Set();

function getStudents() {
  return Storage.getStudents();
}

function getRecords() {
  return Storage.getRecords();
}

function saveStudents(students) {
  Storage.saveStudents(students);
  autoSaveOpenedBackup();
}

function getSelectedStudent() {
  return TeacherControl.getSelectedStudent(getStudents(), selectedStudentId);
}

function makeDefaultConfig() {
  return TeacherControl.makeDefaultConfig();
}

function escapeHtml(value) {
  return TeacherControl.escapeHtml(value);
}

function normalizeComparable(value) {
  return Academic?.normalizeComparable ? Academic.normalizeComparable(value) : String(value ?? "").toLowerCase().trim();
}

function formatStudentMeta(student) {
  if (!student) return "";
  const grade = student.grade && student.grade !== "Sin especificar" ? `${student.grade}°` : "Grado sin definir";
  return `${grade} • Grupo ${student.group || "sin definir"}`;
}

function getSchoolContext(students) {
  const schools = Storage.getSchools?.() || [];
  const selected = getSelectedStudent() || students[0];
  const school = schools.find((item) => item.id === selected?.schoolId) || schools.find((item) => item.id !== Academic?.defaultSchoolId) || schools[0];
  const schoolName = school?.name && school.name !== Academic?.defaultSchoolName ? school.name : "Sin escuela asignada";
  const meta = selected ? formatStudentMeta(selected) : "";
  return meta ? `${schoolName} · ${meta}` : schoolName;
}

function setActiveTab(tabName) {
  tabs.forEach((tab) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  panels.forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${tabName}`));
}

function renderStudents() {
  const students = getStudents();
  const records = getRecords();
  const filtered = students.filter((student) => normalizeComparable(student.name).includes(studentFilter));
  studentList.innerHTML = "";
  studentCount.textContent = students.length;
  studentsEmpty.hidden = filtered.length > 0;
  studentsEmpty.textContent = students.length ? "No hay alumnos con esa busqueda." : "Todavia no hay alumnos registrados.";

  filtered.forEach((student) => {
    const status = TeacherControl.getStudentStatus(student, records);
    const progress = TeacherControl.summarizeStudentProgress(student, records);
    const config = TeacherControl.normalizeStudentConfig(student.config);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `student-row ${status.key}${student.id === selectedStudentId ? " active" : ""}`;
    button.setAttribute("aria-pressed", String(student.id === selectedStudentId));
    button.innerHTML = `
      <span class="student-status-line">
        <i class="status-dot ${status.key}" aria-hidden="true"></i>
        <strong>${escapeHtml(student.name)}</strong>
        <em>${status.label}${student.id === selectedStudentId ? " · SELECCIONADO" : ""}</em>
      </span>
      <small>${escapeHtml(formatStudentMeta(student))}</small>
      <span class="student-mission">
        <b>${TeacherControl.getCategoryLabel(config.category)}</b>
        <small>${TeacherControl.getLevelLabel(config.levelStart)}</small>
      </span>
      <small>Precision reciente: ${progress.accuracy ?? "--"}%</small>
    `;
    button.addEventListener("click", () => {
      selectedStudentId = student.id;
      saveFeedback.textContent = "";
      render();
      setActiveTab("missions");
    });
    studentList.appendChild(button);
  });
}

function renderConsonants(student) {
  const selected = new Set(student?.config?.consonants || defaultConsonants);
  consonantGrid.innerHTML = "";

  defaultConsonants.forEach((letter, index) => {
    const id = `consonant-${index}`;
    const label = document.createElement("label");
    label.className = "consonant-option";
    label.htmlFor = id;
    label.innerHTML = `
      <input id="${id}" type="checkbox" value="${letter}" ${selected.has(letter) ? "checked" : ""} ${student ? "" : "disabled"} />
      <span><b>${escapeHtml(String(letter).toUpperCase())}</b><i aria-hidden="true">✓</i></span>
    `;
    consonantGrid.appendChild(label);
  });
}

function renderCategoryCards(category) {
  categoryCards.forEach((card) => {
    const active = card.dataset.category === category;
    card.classList.toggle("active", active);
    card.setAttribute("aria-checked", String(active));
  });
}

function renderSublevelOptions(category) {
  [...levelStart.options].forEach((option) => {
    option.hidden = option.dataset.category !== category;
  });
  const currentOption = levelStart.selectedOptions[0];
  if (!currentOption || currentOption.dataset.category !== category) {
    levelStart.value = sublevelsByCategory[category][0].id;
  }

  sublevelGrid.innerHTML = "";
  sublevelsByCategory[category].forEach((sublevel) => {
    const button = document.createElement("button");
    const active = levelStart.value === sublevel.id;
    button.type = "button";
    button.className = `sublevel-button${active ? " active" : ""}`;
    button.dataset.level = sublevel.id;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(active));
    button.textContent = sublevel.label;
    button.addEventListener("click", () => {
      levelStart.value = sublevel.id;
      updateCategorySpecificSettings();
      renderSublevelOptions(categoryStart.value);
      renderMissionPreview();
    });
    sublevelGrid.appendChild(button);
  });
}

function updateQuickButtons() {
  goalButtons.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.goal) === Number(sessionGoal.value));
  });
  attemptButtons.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.attempts) === Number(maxAttemptsPerChunk.value));
  });
}

function shouldShowConsonants() {
  return categoryStart.value === "syllables" && ["syllables", "segmentedWords"].includes(levelStart.value);
}

function updateCategorySpecificSettings() {
  const enabled = shouldShowConsonants();
  consonantsSection.hidden = !enabled;
  consonantGrid.querySelectorAll("input").forEach((input) => {
    input.disabled = !enabled || !getSelectedStudent();
  });
  selectAllConsonantsBtn.disabled = !enabled || !getSelectedStudent();
}

function setFormDisabled(disabled) {
  saveConfigBtn.disabled = disabled;
  categoryCards.forEach((card) => { card.disabled = disabled; });
  levelStart.disabled = disabled;
  sessionGoal.disabled = disabled;
  maxAttemptsPerChunk.disabled = disabled;
  shuffleSyllables.disabled = disabled;
  customNotes.disabled = disabled;
  selectAllConsonantsBtn.disabled = disabled || !shouldShowConsonants();
}

function renderSelectedStudent() {
  const student = getSelectedStudent();
  const hasStudent = Boolean(student);
  const config = TeacherControl.normalizeStudentConfig(student?.config || makeDefaultConfig());

  selectedStudentName.textContent = student?.name || "Selecciona un alumno";
  selectedStudentMeta.textContent = student ? formatStudentMeta(student) : "Desde JUGADORES puedes escoger a quien configurar.";
  deleteStudentBtn.disabled = !hasStudent;
  categoryStart.value = config.category;
  renderCategoryCards(config.category);
  renderSublevelOptions(config.category);
  levelStart.value = config.levelStart;
  renderSublevelOptions(config.category);
  sessionGoal.value = config.sessionGoal;
  maxAttemptsPerChunk.value = TeacherControl.normalizeMaxAttemptsPerChunk(config.maxAttemptsPerChunk);
  shuffleSyllables.checked = Boolean(config.shuffleSyllables);
  customNotes.value = config.notes || "";
  renderConsonants(student);
  setFormDisabled(!hasStudent);
  updateCategorySpecificSettings();
  updateQuickButtons();
  renderMissionPreview();
}

function readConfigFromForm() {
  const consonants = [...consonantGrid.querySelectorAll("input:checked")].map((input) => input.value);
  return {
    consonants,
    levelStart: levelStart.value,
    category: categoryStart.value,
    sublevel: levelStart.value,
    sessionGoal: Number(sessionGoal.value || 10),
    maxAttemptsPerChunk: TeacherControl.normalizeMaxAttemptsPerChunk(maxAttemptsPerChunk.value),
    shuffleSyllables: shuffleSyllables.checked,
    notes: customNotes.value.trim(),
  };
}

function renderMissionPreview() {
  const student = getSelectedStudent();
  const config = readConfigFromForm();
  const consonants = config.consonants.map((letter) => String(letter).toUpperCase()).join(" • ");
  missionPreviewTitle.textContent = student ? `MISION DE ${student.name.toUpperCase()}` : "MISION";
  missionPreview.innerHTML = `
    <p><strong>${TeacherControl.getCategoryLabel(config.category)}</strong><br />${TeacherControl.getLevelLabel(config.levelStart)}</p>
    <p>Meta: ${config.sessionGoal} ejercicios<br />Intentos: ${config.maxAttemptsPerChunk}<br />Orden: ${config.shuffleSyllables ? "Aleatorio" : "Secuencial"}</p>
    ${shouldShowConsonants() ? `<p>Consonantes:<br />${escapeHtml(consonants || "Ninguna seleccionada")}</p>` : ""}
  `;
}

function renderGroupSummary() {
  const students = getStudents();
  const summary = TeacherControl.summarizeGroup(students, getRecords());
  const totalText = `${summary.total} jugadores`;
  summaryStudents.textContent = totalText;
  summaryReady.textContent = `${summary.ready} listos`;
  summaryProgress.textContent = `${summary.progress} en progreso`;
  summaryUnconfigured.textContent = `${summary.unconfigured} sin configurar`;
  progressTotalStudents.textContent = totalText;
  progressReady.textContent = `${summary.ready} listos`;
  progressInProgress.textContent = `${summary.progress} en progreso`;
  progressUnconfigured.textContent = `${summary.unconfigured} sin configurar`;
  classroomContext.textContent = getSchoolContext(students);
}

function renderProgress() {
  const student = getSelectedStudent();
  if (!student) {
    progressStudentName.textContent = "Selecciona un alumno";
    progressSummary.innerHTML = `<p class="empty-state">Elige un jugador para ver su progreso real.</p>`;
    return;
  }
  const progress = TeacherControl.summarizeStudentProgress(student, getRecords());
  const latest = progress.latest;
  progressStudentName.textContent = student.name;
  progressSummary.innerHTML = `
    <p>${escapeHtml(formatStudentMeta(student))}</p>
    <div class="progress-stats">
      <span>Ultima mision<strong>${latest ? `${TeacherControl.getCategoryLabel(Content.getLevelDefinition?.(latest.level)?.category)} • ${TeacherControl.getLevelLabel(latest.level)}` : "--"}</strong></span>
      <span>Precision<strong>${progress.accuracy ?? "--"}%</strong></span>
      <span>Correctas<strong>${progress.correct}</strong></span>
      <span>Aproximadas<strong>${progress.approximate}</strong></span>
      <span>Incorrectas<strong>${progress.incorrect}</strong></span>
      <span>Sin evaluar<strong>${progress.unevaluated}</strong></span>
    </div>
    ${progress.weakChunks.length ? `<h3>Requiere practica</h3><p class="weak-list">${progress.weakChunks.map(escapeHtml).join(" • ")}</p>` : ""}
  `;
}

function renderBulkStudents() {
  const students = getStudents();
  bulkStudentList.innerHTML = "";
  students.forEach((student) => {
    const checked = selectedBulkIds.has(student.id);
    const label = document.createElement("label");
    label.className = "bulk-student-option";
    label.innerHTML = `
      <input type="checkbox" value="${escapeHtml(student.id)}" ${checked ? "checked" : ""} />
      <span>${escapeHtml(student.name)}</span>
    `;
    label.querySelector("input").addEventListener("change", (event) => {
      if (event.target.checked) selectedBulkIds.add(student.id);
      else selectedBulkIds.delete(student.id);
      renderBulkState();
    });
    bulkStudentList.appendChild(label);
  });
  renderBulkState();
}

function renderBulkState() {
  bulkCount.textContent = selectedBulkIds.size;
  applyBulkConfigBtn.disabled = selectedBulkIds.size === 0 || !getSelectedStudent();
}

function renderBackupState(message) {
  if (!JsonBackup || !backupStatus || !saveOpenBackupBtn) return;
  const state = JsonBackup.getBackupStatus();
  saveOpenBackupBtn.disabled = !state.canWrite;
  if (backupAutosave) backupAutosave.value = state.autoSaveEnabled ? "enabled" : "disabled";
  if (message) {
    backupStatus.textContent = message;
    return;
  }
  if (state.lastError) {
    backupStatus.textContent = "No se pudo actualizar el respaldo";
  } else if (state.saving) {
    backupStatus.textContent = "Pendiente de guardar";
  } else if (state.lastSavedAt) {
    backupStatus.textContent = `Guardado automaticamente: ${new Date(state.lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } else {
    backupStatus.textContent = state.hasOpenedFile ? `Archivo conectado: ${state.fileName}` : "Ningun archivo abierto";
  }
}

function render() {
  renderStudents();
  renderSelectedStudent();
  renderGroupSummary();
  renderProgress();
  renderBulkStudents();
  renderBackupState();
}

function getBackupMode() {
  return backupImportMode?.value === "replace" ? "replace" : "merge";
}

function confirmReplaceIfNeeded() {
  if (getBackupMode() !== "replace") return true;
  return confirm("Reemplazar datos sobrescribira escuelas, alumnos y registros locales. Deseas continuar?");
}

function describeBackupError(reason) {
  const labels = {
    invalid_backup_file: "El archivo no es un respaldo valido de LectoVoz.",
    invalid_backup_format: "El archivo no pertenece a LectoVoz.",
    unsupported_backup_version: "La version del respaldo no es compatible.",
    invalid_schools: "El respaldo tiene escuelas invalidas.",
    invalid_students: "El respaldo tiene alumnos invalidos.",
    invalid_records: "El respaldo tiene registros invalidos.",
    file_system_access_unavailable: "Tu navegador no permite abrir archivos directos. Usa Importar respaldo.",
    no_open_file: "No hay un archivo abierto para guardar.",
  };
  return labels[reason] || "No se pudo procesar el respaldo.";
}

function applyBackupResult(result, successMessage = "Datos importados correctamente") {
  if (!result.success) {
    renderBackupState(describeBackupError(result.reason));
    return;
  }
  render();
  renderBackupState(successMessage);
}

function autoSaveOpenedBackup() {
  JsonBackup?.autoSaveOpenedBackup?.().then(() => renderBackupState()).catch(() => {});
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

tabLinks.forEach((link) => {
  link.addEventListener("click", () => setActiveTab(link.dataset.tabLink));
});

settingsToggle?.addEventListener("click", () => {
  const open = settingsPanel.hidden;
  settingsPanel.hidden = !open;
  settingsToggle.setAttribute("aria-expanded", String(open));
});

newPlayerToggle?.addEventListener("click", () => {
  studentForm.hidden = !studentForm.hidden;
  if (!studentForm.hidden) studentNameInput.focus();
});

studentSearch?.addEventListener("input", () => {
  studentFilter = normalizeComparable(studentSearch.value);
  renderStudents();
});

studentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = studentNameInput.value.trim();
  const group = studentGroupInput.value.trim();
  if (!name || !group) return;

  const students = getStudents();
  const student = TeacherControl.createStudentRecord(name, group);
  students.unshift(student);
  saveStudents(students);
  selectedStudentId = student.id;
  studentForm.reset();
  studentForm.hidden = true;
  render();
  setActiveTab("missions");
});

categoryCards.forEach((card) => {
  card.addEventListener("click", () => {
    categoryStart.value = card.dataset.category;
    renderCategoryCards(categoryStart.value);
    renderSublevelOptions(categoryStart.value);
    updateCategorySpecificSettings();
    renderMissionPreview();
  });
});

levelStart.addEventListener("change", () => {
  renderSublevelOptions(categoryStart.value);
  updateCategorySpecificSettings();
  renderMissionPreview();
});

goalButtons.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-goal]");
  if (!button) return;
  sessionGoal.value = button.dataset.goal;
  updateQuickButtons();
  renderMissionPreview();
});

attemptButtons.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-attempts]");
  if (!button) return;
  maxAttemptsPerChunk.value = button.dataset.attempts;
  updateQuickButtons();
  renderMissionPreview();
});

[sessionGoal, maxAttemptsPerChunk, shuffleSyllables, customNotes].forEach((control) => {
  control.addEventListener("input", () => {
    updateQuickButtons();
    renderMissionPreview();
  });
});

consonantGrid.addEventListener("change", renderMissionPreview);

saveConfigBtn.addEventListener("click", () => {
  const student = getSelectedStudent();
  if (!student) return;
  saveStudents(TeacherControl.replaceStudentConfig(getStudents(), selectedStudentId, readConfigFromForm()));
  saveFeedback.textContent = `✓ Mision guardada para ${student.name}`;
  saveFeedback.classList.remove("saved-pulse");
  window.requestAnimationFrame(() => saveFeedback.classList.add("saved-pulse"));
  render();
});

applyBulkConfigBtn.addEventListener("click", () => {
  const students = getStudents();
  const targets = students.filter((student) => selectedBulkIds.has(student.id));
  const hasExisting = targets.some((student) => TeacherControl.getStudentStatus(student, getRecords()).key !== "unconfigured");
  if (hasExisting && !confirm("Esta accion sobrescribira configuraciones existentes. Deseas continuar?")) return;
  saveStudents(TeacherControl.replaceManyStudentConfigs(students, [...selectedBulkIds], readConfigFromForm()));
  saveFeedback.textContent = `✓ Mision aplicada a ${selectedBulkIds.size} jugadores`;
  selectedBulkIds = new Set();
  render();
});

selectAllConsonantsBtn.addEventListener("click", () => {
  const boxes = [...consonantGrid.querySelectorAll("input")];
  const allChecked = boxes.every((box) => box.checked);
  boxes.forEach((box) => {
    box.checked = !allChecked;
  });
  renderMissionPreview();
});

deleteStudentBtn.addEventListener("click", () => {
  const student = getSelectedStudent();
  if (!student || !confirm(`Eliminar a ${student.name}?`)) return;
  saveStudents(TeacherControl.deleteStudentById(getStudents(), student.id));
  selectedStudentId = "";
  selectedBulkIds.delete(student.id);
  render();
  setActiveTab("players");
});

exportBackupBtn?.addEventListener("click", () => {
  if (!JsonBackup) return;
  const result = JsonBackup.exportBackupJson();
  renderBackupState(result.success ? "Respaldo exportado correctamente" : describeBackupError(result.reason));
});

importBackupBtn?.addEventListener("click", () => {
  if (!JsonBackup || !confirmReplaceIfNeeded()) return;
  backupFileInput?.click();
});

backupFileInput?.addEventListener("change", async () => {
  const file = backupFileInput.files?.[0];
  if (!file) return;
  const result = await JsonBackup.readFileInput(file, getBackupMode());
  backupFileInput.value = "";
  applyBackupResult(result);
});

openBackupFileBtn?.addEventListener("click", async () => {
  if (!JsonBackup || !confirmReplaceIfNeeded()) return;
  try {
    const result = await JsonBackup.openBackupFile(getBackupMode());
    applyBackupResult(result, result.success ? `Archivo: ${result.fileName}` : undefined);
  } catch {
    renderBackupState("No se pudo abrir el archivo.");
  }
});

saveOpenBackupBtn?.addEventListener("click", async () => {
  if (!JsonBackup) return;
  try {
    const result = await JsonBackup.saveToOpenedFile();
    renderBackupState(result.success ? "Guardado correctamente" : describeBackupError(result.reason));
  } catch {
    renderBackupState("No se pudo guardar el archivo.");
  }
});

backupAutosave?.addEventListener("change", () => {
  if (!JsonBackup) return;
  JsonBackup.setAutoSaveEnabled(backupAutosave.value !== "disabled");
  renderBackupState();
});

render();
