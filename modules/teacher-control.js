(function initTeacherControlModule(global) {
  function getDefaultConsonants() {
    return [...global.LectoVozContent.defaultConsonants];
  }

  function makeDefaultConfig() {
    return {
      consonants: getDefaultConsonants(),
      levelStart: "silabas",
      sessionGoal: 10,
      shuffleSyllables: false,
      maxAttemptsPerChunk: 3,
      notes: "",
      updatedAt: new Date().toISOString(),
    };
  }

  function normalizeMaxAttemptsPerChunk(value) {
    const attempts = Number(value);
    return [1, 2, 3].includes(attempts) ? attempts : 3;
  }

  function normalizeStudentConfig(config) {
    return {
      ...makeDefaultConfig(),
      ...(config || {}),
      maxAttemptsPerChunk: normalizeMaxAttemptsPerChunk(config?.maxAttemptsPerChunk),
    };
  }

  function createStudentRecord(name, group) {
    return {
      id: global.LectoVozStorage.createId(),
      name,
      group,
      config: makeDefaultConfig(),
      createdAt: new Date().toISOString(),
    };
  }

  function getSelectedStudent(students, selectedStudentId) {
    return students.find((student) => student.id === selectedStudentId);
  }

  function replaceStudentConfig(students, selectedStudentId, config) {
    return students.map((student) => (
      student.id === selectedStudentId
        ? { ...student, config: normalizeStudentConfig(config) }
        : student
    ));
  }

  function deleteStudentById(students, selectedStudentId) {
    return students.filter((student) => student.id !== selectedStudentId);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  global.LectoVozTeacherControl = {
    getDefaultConsonants,
    makeDefaultConfig,
    normalizeMaxAttemptsPerChunk,
    normalizeStudentConfig,
    createStudentRecord,
    getSelectedStudent,
    replaceStudentConfig,
    deleteStudentById,
    escapeHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
