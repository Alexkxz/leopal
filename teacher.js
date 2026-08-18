const storageKey = "lectovoz_records";

const totalRecordsEl = document.querySelector("#total-records");
const averageAccuracyEl = document.querySelector("#average-accuracy");
const totalErrorsEl = document.querySelector("#total-errors");
const groupFilter = document.querySelector("#group-filter");
const recordsBody = document.querySelector("#records-body");
const emptyState = document.querySelector("#empty-state");
const exportBtn = document.querySelector("#export-btn");
const clearBtn = document.querySelector("#clear-btn");

function getRecords() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(storageKey, JSON.stringify(records));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function renderGroupOptions(records) {
  const groups = [...new Set(records.map((record) => record.group).filter(Boolean))].sort();
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
  if (groupFilter.value === "all") return records;
  return records.filter((record) => record.group === groupFilter.value);
}

function render() {
  const allRecords = getRecords();
  renderGroupOptions(allRecords);
  const records = getFilteredRecords();
  const totalErrors = records.reduce((sum, record) => sum + Number(record.errors || 0), 0);
  const average = records.length
    ? Math.round(records.reduce((sum, record) => sum + Number(record.accuracy || 0), 0) / records.length)
    : 0;

  totalRecordsEl.textContent = records.length;
  averageAccuracyEl.textContent = `${average}%`;
  totalErrorsEl.textContent = totalErrors;
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
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function exportCsv() {
  const records = getFilteredRecords();
  const headers = ["fecha", "alumno", "grupo", "nivel", "texto", "aciertos", "errores", "precision", "tiempo_segundos", "escuchado"];
  const rows = records.map((record) => [
    record.createdAt,
    record.student,
    record.group,
    record.level,
    record.text,
    record.correct,
    record.errors,
    record.accuracy,
    record.durationSeconds,
    record.transcript,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
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
