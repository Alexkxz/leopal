(function initTeacherControlModule(global) {
  const Academic = global.LectoVozAcademic;

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
    return Academic?.normalizeMaxAttemptsPerChunk
      ? Academic.normalizeMaxAttemptsPerChunk(value)
      : [1, 2, 3].includes(Number(value)) ? Number(value) : 3;
  }

  function normalizeStudentConfig(config) {
    if (Academic?.normalizeConfig) return Academic.normalizeConfig(config);
    return {
      ...makeDefaultConfig(),
      ...(config || {}),
      maxAttemptsPerChunk: normalizeMaxAttemptsPerChunk(config?.maxAttemptsPerChunk),
    };
  }

  function createStudentRecord(name, group) {
    const schools = global.LectoVozStorage.getSchools?.() || [];
    const defaultSchool = Academic?.ensureDefaultSchool?.(schools).school;
    const timestamp = new Date().toISOString();
    return {
      id: global.LectoVozStorage.createId(),
      name: Academic?.normalizeStudentName ? Academic.normalizeStudentName(name) : name,
      schoolId: defaultSchool?.id || Academic?.defaultSchoolId || "school-unassigned",
      grade: Academic?.defaultGrade || "Sin especificar",
      group: Academic?.normalizeGroup ? Academic.normalizeGroup(group) : group,
      config: makeDefaultConfig(),
      createdAt: timestamp,
      updatedAt: timestamp,
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
