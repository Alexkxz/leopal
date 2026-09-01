(function initTeacherControlModule(global) {
  const Academic = global.LectoVozAcademic;

  function getDefaultConsonants() {
    return [...global.LectoVozContent.defaultConsonants];
  }

  function makeDefaultConfig() {
    return {
      consonants: getDefaultConsonants(),
      levelStart: "syllables",
      category: "syllables",
      sublevel: "syllables",
      sessionGoal: 10,
      shuffleSyllables: false,
      maxAttemptsPerChunk: 3,
      notes: "",
      isConfigured: false,
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
    const timestamp = new Date().toISOString();
    return students.map((student) => (
      student.id === selectedStudentId
        ? {
          ...student,
          config: { ...normalizeStudentConfig(config), isConfigured: true, updatedAt: timestamp },
          updatedAt: timestamp,
        }
        : student
    ));
  }

  function replaceManyStudentConfigs(students, selectedStudentIds, config) {
    const ids = new Set(selectedStudentIds);
    const timestamp = new Date().toISOString();
    const normalizedConfig = { ...normalizeStudentConfig(config), isConfigured: true, updatedAt: timestamp };
    return students.map((student) => (
      ids.has(student.id)
        ? { ...student, config: { ...normalizedConfig }, updatedAt: timestamp }
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

  function getLevelLabel(level) {
    const labels = {
      syllables: "Silabas",
      segmentedWords: "Palabras silabeadas",
      simpleWords: "Simples",
      complexWords: "Complejas",
      shortSentences: "Cortas",
      longSentences: "Amplias",
      silabas: "Silabas",
      palabras_cortas: "Simples",
      palabras_medianas: "Simples",
      palabras_largas: "Complejas",
      frases_cortas: "Cortas",
      frases_medianas: "Amplias",
      frases_largas: "Amplias",
    };
    return labels[global.LectoVozContent?.normalizeLevelId?.(level) || level] || "Lectura";
  }

  function getCategoryLabel(category) {
    return {
      syllables: "SILABAS",
      words: "PALABRAS",
      sentences: "ORACIONES",
    }[category] || "LECTURA";
  }

  function matchesStudentRecord(student, record) {
    if (student?.id && record?.studentId && student.id === record.studentId) return true;
    if (student?.id && record?.studentId) return false;
    const normalize = Academic?.normalizeComparable || ((value) => String(value ?? "").trim().toLowerCase());
    return normalize(student?.name) === normalize(record?.student)
      && normalize(student?.group) === normalize(record?.group);
  }

  function getStudentRecords(student, records = []) {
    return records.filter((record) => matchesStudentRecord(student, record));
  }

  function isSavedConfig(config) {
    return Boolean(config?.isConfigured || config?.updatedAt);
  }

  function getStudentStatus(student, records = []) {
    const studentRecords = getStudentRecords(student, records);
    if (studentRecords.length) return { key: "progress", label: "EN PROGRESO" };
    if (isSavedConfig(student?.config)) return { key: "ready", label: "LISTO" };
    return { key: "unconfigured", label: "SIN CONFIGURAR" };
  }

  function summarizeStudentProgress(student, records = []) {
    const studentRecords = getStudentRecords(student, records);
    const latest = studentRecords[0] || null;
    const chunkAttempts = studentRecords.flatMap((record) => Array.isArray(record.chunkAttempts) ? record.chunkAttempts : []);
    const notMastered = studentRecords.flatMap((record) => Array.isArray(record.notMasteredChunks) ? record.notMasteredChunks : []);
    const countStatus = (status) => chunkAttempts.filter((attempt) => attempt.evaluation?.status === status || attempt.status === status).length;
    const correct = studentRecords.reduce((sum, record) => sum + Number(record.correct || 0), 0) || countStatus("correct");
    const approximate = countStatus("approximate");
    const incorrect = studentRecords.reduce((sum, record) => sum + Number(record.errors || 0), 0) || countStatus("incorrect");
    const totalAttempts = chunkAttempts.length;
    const evaluated = correct + approximate + incorrect;
    const weakChunks = [...new Set(notMastered.map((chunk) => chunk.expected || chunk.displayText || chunk.text || "").filter(Boolean))].slice(0, 6);
    return {
      records: studentRecords,
      latest,
      accuracy: latest?.accuracy,
      correct,
      approximate,
      incorrect,
      unevaluated: Math.max(0, totalAttempts - evaluated),
      weakChunks,
    };
  }

  function summarizeGroup(students = [], records = []) {
    const counts = { ready: 0, progress: 0, unconfigured: 0 };
    students.forEach((student) => {
      counts[getStudentStatus(student, records).key] += 1;
    });
    return { total: students.length, ...counts };
  }

  global.LectoVozTeacherControl = {
    getDefaultConsonants,
    makeDefaultConfig,
    normalizeMaxAttemptsPerChunk,
    normalizeStudentConfig,
    createStudentRecord,
    getSelectedStudent,
    replaceStudentConfig,
    replaceManyStudentConfigs,
    deleteStudentById,
    escapeHtml,
    getLevelLabel,
    getCategoryLabel,
    getStudentRecords,
    getStudentStatus,
    summarizeStudentProgress,
    summarizeGroup,
  };
})(typeof window !== "undefined" ? window : globalThis);
