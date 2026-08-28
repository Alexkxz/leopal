(function initStorageModule(global) {
  const Academic = global.LectoVozAcademic;

  const storageKeys = {
    schemaVersion: "lectovoz_storage_schema_version",
    schools: "lectovoz_schools",
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

  function hasAcademicModule() {
    return Boolean(Academic);
  }

  function valuesChanged(left, right) {
    return JSON.stringify(left) !== JSON.stringify(right);
  }

  function getStorageSchemaVersion() {
    return Number(global.localStorage.getItem(storageKeys.schemaVersion) || Academic?.storageSchemaVersion || 1);
  }

  function saveStorageSchemaVersion(version = Academic?.storageSchemaVersion || 1) {
    global.localStorage.setItem(storageKeys.schemaVersion, String(version));
  }

  function runAcademicMigration() {
    if (!hasAcademicModule()) {
      return {
        schools: readJson(storageKeys.schools, []),
        students: readJson(storageKeys.students, []),
      };
    }

    const currentSchools = readJson(storageKeys.schools, []);
    const currentStudents = readJson(storageKeys.students, []);
    const migrated = Academic.migrateAcademicData({
      schools: currentSchools,
      students: currentStudents,
    });

    if (valuesChanged(currentSchools, migrated.schools)) {
      writeJson(storageKeys.schools, migrated.schools);
    }
    if (valuesChanged(currentStudents, migrated.students)) {
      writeJson(storageKeys.students, migrated.students);
    }
    if (getStorageSchemaVersion() !== migrated.version) {
      saveStorageSchemaVersion(migrated.version);
    }

    return migrated;
  }

  function getSchools() {
    return runAcademicMigration().schools;
  }

  function saveSchools(schools) {
    if (!hasAcademicModule()) {
      writeJson(storageKeys.schools, schools);
      return;
    }
    const migrated = Academic.migrateAcademicData({
      schools,
      students: readJson(storageKeys.students, []),
    });
    writeJson(storageKeys.schools, migrated.schools);
    writeJson(storageKeys.students, migrated.students);
    saveStorageSchemaVersion(migrated.version);
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
    return runAcademicMigration().students;
  }

  function saveStudents(students) {
    if (!hasAcademicModule()) {
      writeJson(storageKeys.students, students);
      return;
    }
    const migrated = Academic.migrateAcademicData({
      schools: readJson(storageKeys.schools, []),
      students,
    });
    writeJson(storageKeys.schools, migrated.schools);
    writeJson(storageKeys.students, migrated.students);
    saveStorageSchemaVersion(migrated.version);
  }

  function replaceLocalData(data) {
    if (!hasAcademicModule()) {
      writeJson(storageKeys.schools, data.schools || []);
      writeJson(storageKeys.students, data.students || []);
      writeJson(storageKeys.records, data.records || []);
      return {
        schools: data.schools || [],
        students: data.students || [],
        records: data.records || [],
      };
    }
    const migrated = Academic.migrateAcademicData({
      schools: data.schools || [],
      students: data.students || [],
    });
    writeJson(storageKeys.schools, migrated.schools);
    writeJson(storageKeys.students, migrated.students);
    writeJson(storageKeys.records, data.records || []);
    saveStorageSchemaVersion(migrated.version);
    return {
      schools: migrated.schools,
      students: migrated.students,
      records: data.records || [],
    };
  }

  function createId() {
    return global.crypto?.randomUUID ? global.crypto.randomUUID() : String(Date.now());
  }

  function exportLocalData() {
    const schools = getSchools();
    const students = getStudents();
    return {
      version: getStorageSchemaVersion(),
      exportedAt: new Date().toISOString(),
      schools,
      students,
      records: getRecords(),
    };
  }

  global.LectoVozStorage = {
    storageKeys,
    getStorageSchemaVersion,
    saveStorageSchemaVersion,
    runAcademicMigration,
    readJson,
    writeJson,
    getSchools,
    saveSchools,
    getRecords,
    saveRecords,
    addPracticeRecord,
    getSession,
    saveSession,
    clearSession,
    getStudents,
    saveStudents,
    replaceLocalData,
    createId,
    exportLocalData,
  };
})(typeof window !== "undefined" ? window : globalThis);
