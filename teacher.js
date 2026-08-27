const Storage = window.LectoVozStorage;
const Dashboard = window.LectoVozTeacherDashboard;

const totalRecordsEl = document.querySelector("#total-records");
const averageAccuracyEl = document.querySelector("#average-accuracy");
const totalErrorsEl = document.querySelector("#total-errors");
const groupFilter = document.querySelector("#group-filter");
const recordsBody = document.querySelector("#records-body");
const emptyState = document.querySelector("#empty-state");
const exportBtn = document.querySelector("#export-btn");
const clearBtn = document.querySelector("#clear-btn");

function getRecords() {
  return Storage.getRecords();
}

function saveRecords(records) {
  Storage.saveRecords(records);
}

function formatDate(value) {
  return Dashboard.formatDate(value);
}

function renderGroupOptions(records) {
  const groups = Dashboard.getGroups(records);
  const current = groupFilter.value;
  groupFilter.innerHTML = '<option value="all">Todos</option>';

  groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group;
    option.textContent = group;
    groupFilter.appendChild(option);
  });

  if (groups.includes(current)) groupFilter.value = current;
}

function getFilteredRecords() {
  const records = getRecords();
  return Dashboard.filterRecords(records, groupFilter.value);
}

function render() {
  const allRecords = getRecords();
  renderGroupOptions(allRecords);
  const records = getFilteredRecords();
  const summary = Dashboard.calculateSummary(records);

  totalRecordsEl.textContent = summary.totalRecords;
  averageAccuracyEl.textContent = `${summary.averageAccuracy}%`;
  totalErrorsEl.textContent = summary.totalErrors;
  emptyState.hidden = records.length > 0;
  recordsBody.innerHTML = "";

  records.forEach((record) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatDate(record.createdAt)}</td>
      <td>${escapeHtml(record.student)}</td>
      <td>${escapeHtml(record.group)}</td>
      <td>${escapeHtml(record.level)}</td>
      <td>${escapeHtml(record.text)}</td>
      <td>${record.correct}</td>
      <td>${record.errors}</td>
      <td>${record.accuracy}%</td>
      <td>${record.durationSeconds}s</td>
    `;
    recordsBody.appendChild(row);
  });
}

function escapeHtml(value) {
  return Dashboard.escapeHtml(value);
}

function exportCsv() {
  const records = getFilteredRecords();
  const csv = Dashboard.buildCsv(records);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "lectovoz-registros.csv";
  link.click();
  URL.revokeObjectURL(url);
}

groupFilter.addEventListener("change", render);
exportBtn.addEventListener("click", exportCsv);
clearBtn.addEventListener("click", () => {
  if (!confirm("Borrar todos los registros locales?")) return;
  saveRecords([]);
  render();
});

render();
