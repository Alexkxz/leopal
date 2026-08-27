const Storage = window.LectoVozStorage;
const TeacherControl = window.LectoVozTeacherControl;
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

render();
