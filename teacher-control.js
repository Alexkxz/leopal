const Storage = window.LectoVozStorage;
const TeacherControl = window.LectoVozTeacherControl;
const JsonBackup = window.LectoVozJsonBackup;
const defaultConsonants = TeacherControl.getDefaultConsonants();

const tabs = document.querySelectorAll(".tab-button");
const panels = document.querySelectorAll(".control-panel");
const studentForm = document.querySelector("#student-form");
const studentNameInput = document.querySelector("#new-student-name");
const studentGroupInput = document.querySelector("#new-student-group");
const studentList = document.querySelector("#student-list");
const studentsEmpty = document.querySelector("#students-empty");
const studentCount = document.querySelector("#student-count");
const selectedStudentName = document.querySelector("#selected-student-name");
const selectedStudentMeta = document.querySelector("#selected-student-meta");
const deleteStudentBtn = document.querySelector("#delete-student-btn");
const consonantGrid = document.querySelector("#consonant-grid");
const selectAllConsonantsBtn = document.querySelector("#select-all-consonants");
const levelStart = document.querySelector("#level-start");
const sessionGoal = document.querySelector("#session-goal");
const maxAttemptsPerChunk = document.querySelector("#max-attempts-per-chunk");
const shuffleSyllables = document.querySelector("#shuffle-syllables");
const customNotes = document.querySelector("#custom-notes");
const saveConfigBtn = document.querySelector("#save-config-btn");
const summaryStudents = document.querySelector("#summary-students");
const summaryConfigured = document.querySelector("#summary-configured");
const summaryConsonants = document.querySelector("#summary-consonants");
const backupStatus = document.querySelector("#backup-status");
const backupImportMode = document.querySelector("#backup-import-mode");
const backupAutosave = document.querySelector("#backup-autosave");
const exportBackupBtn = document.querySelector("#export-backup-btn");
const importBackupBtn = document.querySelector("#import-backup-btn");
const openBackupFileBtn = document.querySelector("#open-backup-file-btn");
const saveOpenBackupBtn = document.querySelector("#save-open-backup-btn");
const backupFileInput = document.querySelector("#backup-file-input");

let selectedStudentId = "";

function getStudents() {
  return Storage.getStudents();
}

function saveStudents(students) {
  Storage.saveStudents(students);
}

function getSelectedStudent() {
  return TeacherControl.getSelectedStudent(getStudents(), selectedStudentId);
}

function makeDefaultConfig() {
  return TeacherControl.makeDefaultConfig();
}

function setActiveTab(tabName) {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  panels.forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${tabName}`));
}

function escapeHtml(value) {
  return TeacherControl.escapeHtml(value);
}

function renderStudents() {
  const students = getStudents();
  studentList.innerHTML = "";
  studentCount.textContent = students.length;
  studentsEmpty.hidden = students.length > 0;

  students.forEach((student) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `student-row${student.id === selectedStudentId ? " active" : ""}`;
    button.innerHTML = `
      <span>
        <strong>${escapeHtml(student.name)}</strong>
        <small>${escapeHtml(student.group)}</small>
      </span>
      <i>${student.config?.consonants?.length || 0}</i>
    `;
    button.addEventListener("click", () => {
      selectedStudentId = student.id;
      render();
      setActiveTab("game");
    });
    studentList.appendChild(button);
  });
}

function renderConsonants(student) {
  const selected = new Set(student?.config?.consonants || []);
  consonantGrid.innerHTML = "";

  defaultConsonants.forEach((letter, index) => {
    const id = `consonant-${index}`;
    const label = document.createElement("label");
    label.className = "consonant-option";
    label.htmlFor = id;
    label.innerHTML = `
      <input id="${id}" type="checkbox" value="${letter}" ${selected.has(letter) ? "checked" : ""} ${student ? "" : "disabled"} />
      <span>${letter}</span>
    `;
    consonantGrid.appendChild(label);
  });
}

function renderSelectedStudent() {
  const student = getSelectedStudent();
  const hasStudent = Boolean(student);
  const config = student?.config || makeDefaultConfig();

  selectedStudentName.textContent = student?.name || "Selecciona un alumno";
  selectedStudentMeta.textContent = student
    ? `${student.group} / ${config.consonants.length} consonantes activas`
    : "Desde la pestana Alumnos puedes escoger a quien configurar.";
  deleteStudentBtn.disabled = !hasStudent;
  saveConfigBtn.disabled = !hasStudent;
  levelStart.disabled = !hasStudent;
  sessionGoal.disabled = !hasStudent;
  maxAttemptsPerChunk.disabled = !hasStudent;
  shuffleSyllables.disabled = !hasStudent;
  customNotes.disabled = !hasStudent;
  selectAllConsonantsBtn.disabled = !hasStudent;
  levelStart.value = config.levelStart;
  sessionGoal.value = config.sessionGoal;
  maxAttemptsPerChunk.value = TeacherControl.normalizeMaxAttemptsPerChunk(config.maxAttemptsPerChunk);
  shuffleSyllables.checked = Boolean(config.shuffleSyllables);
  customNotes.value = config.notes;
  renderConsonants(student);
}

function renderSummary() {
  const students = getStudents();
  const selected = getSelectedStudent();
  summaryStudents.textContent = students.length;
  summaryConfigured.textContent = students.filter((student) => student.config).length;
  summaryConsonants.textContent = selected?.config?.consonants?.length || 0;
  renderBackupState();
}

function render() {
  renderStudents();
  renderSelectedStudent();
  renderSummary();
}

function readConfigFromForm() {
  const consonants = [...consonantGrid.querySelectorAll("input:checked")].map((input) => input.value);
  return {
    consonants,
    levelStart: levelStart.value,
    sessionGoal: Number(sessionGoal.value || 10),
    maxAttemptsPerChunk: TeacherControl.normalizeMaxAttemptsPerChunk(maxAttemptsPerChunk.value),
    shuffleSyllables: shuffleSyllables.checked,
    notes: customNotes.value.trim(),
    updatedAt: new Date().toISOString(),
  };
}

function getBackupMode() {
  return backupImportMode?.value === "replace" ? "replace" : "merge";
}

function confirmReplaceIfNeeded() {
  if (getBackupMode() !== "replace") return true;
  return confirm("Reemplazar datos sobrescribira escuelas, alumnos y registros locales. Deseas continuar?");
}

function setBackupStatus(message) {
  if (backupStatus) backupStatus.textContent = message;
}

function renderBackupState(message) {
  if (!JsonBackup || !backupStatus || !saveOpenBackupBtn) return;
  const state = JsonBackup.getBackupStatus();
  saveOpenBackupBtn.disabled = !state.canWrite;
  if (backupAutosave) backupAutosave.value = state.autoSaveEnabled ? "enabled" : "disabled";
  if (message) {
    setBackupStatus(message);
    return;
  }
  if (state.lastError) {
    setBackupStatus("No se pudo actualizar el respaldo");
  } else if (state.saving) {
    setBackupStatus("Pendiente de guardar");
  } else if (state.lastSavedAt) {
    setBackupStatus(`Guardado automaticamente: ${new Date(state.lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
  } else {
    setBackupStatus(state.hasOpenedFile ? `Archivo conectado: ${state.fileName}` : "Ningun archivo abierto");
  }
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

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
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
  render();
  setActiveTab("game");
});

saveConfigBtn.addEventListener("click", () => {
  const students = getStudents();
  const nextStudents = TeacherControl.replaceStudentConfig(students, selectedStudentId, readConfigFromForm());
  saveStudents(nextStudents);
  render();
});

selectAllConsonantsBtn.addEventListener("click", () => {
  const boxes = [...consonantGrid.querySelectorAll("input")];
  const allChecked = boxes.every((box) => box.checked);
  boxes.forEach((box) => {
    box.checked = !allChecked;
  });
});

deleteStudentBtn.addEventListener("click", () => {
  const student = getSelectedStudent();
  if (!student || !confirm(`Eliminar a ${student.name}?`)) return;
  saveStudents(TeacherControl.deleteStudentById(getStudents(), student.id));
  selectedStudentId = "";
  render();
  setActiveTab("students");
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
