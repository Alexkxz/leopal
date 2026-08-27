(function initStorageModule(global) {
  const storageKeys = {
    records: "lectovoz_records",
    session: "lectovoz_session",
    students: "lectovoz_students",
  };

  function readJson(key, fallback) {
    try {
      return JSON.parse(global.localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    global.localStorage.setItem(key, JSON.stringify(value));
  }

  function getRecords() {
    return readJson(storageKeys.records, []);
  }

  function saveRecords(records) {
    writeJson(storageKeys.records, records);
  }

  function addPracticeRecord(record, limit = 300) {
    const records = getRecords();
    records.unshift(record);
    saveRecords(records.slice(0, limit));
  }

  function getSession() {
    return readJson(storageKeys.session, null);
  }

  function saveSession(session) {
    writeJson(storageKeys.session, session);
  }

  function clearSession() {
    global.localStorage.removeItem(storageKeys.session);
  }

  function getStudents() {
    return readJson(storageKeys.students, []);
  }

  function saveStudents(students) {
    writeJson(storageKeys.students, students);
  }

  function createId() {
    return global.crypto?.randomUUID ? global.crypto.randomUUID() : String(Date.now());
  }

  global.LectoVozStorage = {
    storageKeys,
    readJson,
    writeJson,
    getRecords,
    saveRecords,
    addPracticeRecord,
    getSession,
    saveSession,
    clearSession,
    getStudents,
    saveStudents,
    createId,
  };
})(typeof window !== "undefined" ? window : globalThis);
