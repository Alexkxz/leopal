(function initTeacherDashboardModule(global) {
  function formatDate(value) {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getGroups(records) {
    return [...new Set(records.map((record) => record.group).filter(Boolean))].sort();
  }

  function filterRecords(records, group) {
    if (group === "all") return records;
    return records.filter((record) => record.group === group);
  }

  function calculateSummary(records) {
    const totalErrors = records.reduce((sum, record) => sum + Number(record.errors || 0), 0);
    const averageAccuracy = records.length
      ? Math.round(records.reduce((sum, record) => sum + Number(record.accuracy || 0), 0) / records.length)
      : 0;

    return {
      totalRecords: records.length,
      averageAccuracy,
      totalErrors,
    };
  }

  function buildCsv(records) {
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

    return [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
  }

  global.LectoVozTeacherDashboard = {
    formatDate,
    escapeHtml,
    getGroups,
    filterRecords,
    calculateSummary,
    buildCsv,
  };
})(typeof window !== "undefined" ? window : globalThis);
