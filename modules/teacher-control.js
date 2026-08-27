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
      notes: "",
      updatedAt: new Date().toISOString(),
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
        ? { ...student, config }
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
    createStudentRecord,
    getSelectedStudent,
    replaceStudentConfig,
    deleteStudentById,
    escapeHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
