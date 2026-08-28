(function initJsonBackupModule(global) {
  const backupFormat = "lectovoz-backup";
  const backupVersion = 1;
  const autoSavePreferenceKey = "lectovoz_backup_autosave_enabled";
  let openedFileHandle = null;
  let openedFileName = "";
  let lastWriteAt = "";
  let lastError = null;
  let saveInProgress = false;
  let savePending = false;
  let activeSavePromise = null;

  function getStorage() {
    return global.LectoVozStorage;
  }

  function getAcademic() {
    return global.LectoVozAcademic;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function parseDate(value) {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? time : 0;
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function chooseNewest(current, incoming) {
    const currentTime = parseDate(current?.updatedAt || current?.createdAt);
    const incomingTime = parseDate(incoming?.updatedAt || incoming?.createdAt);
    if (incomingTime > currentTime) return incoming;
    if (incomingTime < currentTime) return current;
    return String(incoming?.id || "") < String(current?.id || "") ? incoming : current;
  }

  function getCurrentData() {
    const Storage = getStorage();
    return {
      schools: Storage.getSchools(),
      students: Storage.getStudents(),
      records: Storage.getRecords(),
    };
  }

  function buildBackupData() {
    const Storage = getStorage();
    const current = getCurrentData();
    return {
      format: backupFormat,
      version: backupVersion,
      storageSchemaVersion: Storage.getStorageSchemaVersion(),
      exportedAt: new Date().toISOString(),
      schools: clone(current.schools),
      students: clone(current.students),
      records: clone(current.records),
    };
  }

  function validateBackupData(data) {
    if (!isPlainObject(data)) return { valid: false, reason: "invalid_backup_file" };
    if (data.format !== backupFormat) return { valid: false, reason: "invalid_backup_format" };
    if (data.version !== backupVersion) return { valid: false, reason: "unsupported_backup_version" };
    if (!Array.isArray(data.schools)) return { valid: false, reason: "invalid_schools" };
    if (!Array.isArray(data.students)) return { valid: false, reason: "invalid_students" };
    if (!Array.isArray(data.records)) return { valid: false, reason: "invalid_records" };
    if (data.schools.some((school) => !isPlainObject(school) || typeof school.name !== "string")) {
      return { valid: false, reason: "invalid_schools" };
    }
    if (data.students.some((student) => !isPlainObject(student) || typeof student.name !== "string")) {
      return { valid: false, reason: "invalid_students" };
    }
    if (data.records.some((record) => !isPlainObject(record))) {
      return { valid: false, reason: "invalid_records" };
    }
    return { valid: true };
  }

  function parseBackupJson(text) {
    try {
      return { success: true, data: JSON.parse(text) };
    } catch {
      return { success: false, reason: "invalid_backup_file" };
    }
  }

  function normalizeBackupData(data) {
    const Academic = getAcademic();
    const legacyDate = "1970-01-01T00:00:00.000Z";
    const schools = data.schools.map((school) => ({
      ...school,
      createdAt: school.createdAt || school.updatedAt || legacyDate,
      updatedAt: school.updatedAt || school.createdAt || legacyDate,
    }));
    const students = data.students.map((student) => ({
      ...student,
      createdAt: student.createdAt || student.updatedAt || legacyDate,
      updatedAt: student.updatedAt || student.createdAt || legacyDate,
    }));
    const migrated = Academic.migrateAcademicData({
      schools,
      students,
    });
    return {
      schools: migrated.schools,
      students: migrated.students,
      records: clone(data.records),
    };
  }

  function recordKey(record) {
    if (record.id) return `id:${record.id}`;
    return [
      "legacy",
      record.studentId || "",
      record.student || "",
      record.schoolId || "",
      record.grade || "",
      record.group || "",
      record.level || "",
      record.text || "",
      record.createdAt || record.date || record.startedAt || "",
      record.durationSeconds || "",
    ].join("|");
  }

  function mergeSchools(currentSchools, incomingSchools) {
    const Academic = getAcademic();
    const byId = new Map();
    const idMap = {};

    [...currentSchools, ...incomingSchools].forEach((school) => {
      if (!byId.has(school.id)) {
        byId.set(school.id, school);
        return;
      }
      byId.set(school.id, chooseNewest(byId.get(school.id), school));
    });

    const byName = new Map();
    Array.from(byId.values()).forEach((school) => {
      const key = Academic.normalizeComparable(school.name);
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, school);
        return;
      }
      const kept = chooseNewest(existing, school);
      const dropped = kept.id === existing.id ? school : existing;
      idMap[dropped.id] = kept.id;
      byName.set(key, kept);
    });

    return {
      schools: Array.from(byName.values()).sort((left, right) => String(left.name).localeCompare(String(right.name))),
      idMap,
    };
  }

  function mergeStudents(currentStudents, incomingStudents, schoolIdMap) {
    const byId = new Map();
    [...currentStudents, ...incomingStudents].forEach((student) => {
      const remapped = { ...student, schoolId: schoolIdMap[student.schoolId] || student.schoolId };
      if (!byId.has(remapped.id)) {
        byId.set(remapped.id, remapped);
        return;
      }
      byId.set(remapped.id, chooseNewest(byId.get(remapped.id), remapped));
    });
    return Array.from(byId.values());
  }

  function mergeRecords(currentRecords, incomingRecords) {
    const byKey = new Map();
    [...currentRecords, ...incomingRecords].forEach((record) => {
      const key = recordKey(record);
      if (!byKey.has(key)) {
        byKey.set(key, record);
        return;
      }
      byKey.set(key, chooseNewest(byKey.get(key), record));
    });
    return Array.from(byKey.values()).sort((left, right) => parseDate(right.createdAt || right.date) - parseDate(left.createdAt || left.date));
  }

  function saveDataToLocalStorage(data) {
    const Storage = getStorage();
    Storage.replaceLocalData(data);
  }

  function replaceLocalData(data) {
    const validation = validateBackupData(data);
    if (!validation.valid) return { success: false, reason: validation.reason };
    const normalized = normalizeBackupData(data);
    saveDataToLocalStorage(normalized);
    return { success: true, mode: "replace", ...normalized };
  }

  function mergeBackupData(data) {
    const validation = validateBackupData(data);
    if (!validation.valid) return { success: false, reason: validation.reason };
    const current = getCurrentData();
    const incoming = normalizeBackupData(data);
    const Academic = getAcademic();
    const importedDefaultSchool = data.schools.some((school) => (
      Academic.normalizeComparable(school.name) === Academic.normalizeComparable(Academic.defaultSchoolName)
    ));
    if (!importedDefaultSchool && current.schools.some((school) => (
      Academic.normalizeComparable(school.name) === Academic.normalizeComparable(Academic.defaultSchoolName)
    ))) {
      incoming.schools = incoming.schools.filter((school) => (
        Academic.normalizeComparable(school.name) !== Academic.normalizeComparable(Academic.defaultSchoolName)
      ));
    }
    const schoolMerge = mergeSchools(current.schools, incoming.schools);
    const students = mergeStudents(current.students, incoming.students, schoolMerge.idMap);
    const migrated = Academic.migrateAcademicData({
      schools: schoolMerge.schools,
      students,
    });
    const merged = {
      schools: migrated.schools,
      students: migrated.students,
      records: mergeRecords(current.records, incoming.records),
    };
    saveDataToLocalStorage(merged);
    return { success: true, mode: "merge", ...merged };
  }

  function importBackupJson(data, mode = "merge") {
    const payload = typeof data === "string" ? parseBackupJson(data) : { success: true, data };
    if (!payload.success) return payload;
    return mode === "replace" ? replaceLocalData(payload.data) : mergeBackupData(payload.data);
  }

  function stringifyBackup(data = buildBackupData()) {
    return `${JSON.stringify(data, null, 2)}\n`;
  }

  function isAutoSaveEnabled() {
    return global.localStorage?.getItem(autoSavePreferenceKey) !== "false";
  }

  function setAutoSaveEnabled(enabled) {
    global.localStorage?.setItem(autoSavePreferenceKey, enabled ? "true" : "false");
  }

  function exportBackupJson(filename = "lectovoz-datos.json") {
    const json = stringifyBackup();
    if (typeof Blob === "undefined" || !global.document?.createElement) {
      return { success: true, method: "json", filename, json };
    }

    const blob = new Blob([json], { type: "application/json" });
    const url = global.URL?.createObjectURL?.(blob);
    const link = global.document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    global.document.body?.appendChild?.(link);
    link.click();
    link.remove?.();
    if (url) global.URL?.revokeObjectURL?.(url);
    return { success: true, method: "download", filename };
  }

  async function openBackupFile(mode = "merge") {
    if (!global.showOpenFilePicker) {
      return { success: false, reason: "file_system_access_unavailable" };
    }
    const [handle] = await global.showOpenFilePicker({
      types: [{ description: "LectoVoz JSON", accept: { "application/json": [".json"] } }],
      multiple: false,
    });
    const file = await handle.getFile();
    const text = await file.text();
    const result = importBackupJson(text, mode);
    if (!result.success) return result;
    openedFileHandle = handle;
    openedFileName = handle.name || file.name || "lectovoz-datos.json";
    lastError = null;
    return { ...result, fileName: openedFileName, canWrite: Boolean(handle.createWritable) };
  }

  async function writeOpenedFile() {
    if (!openedFileHandle?.createWritable) {
      return { success: false, reason: "no_open_file" };
    }
    try {
      const writable = await openedFileHandle.createWritable();
      await writable.write(stringifyBackup());
      await writable.close();
      lastWriteAt = new Date().toISOString();
      lastError = null;
      return { success: true, fileName: openedFileName, savedAt: lastWriteAt };
    } catch (error) {
      lastError = error?.message || "write_failed";
      return { success: false, reason: "write_failed", error: lastError };
    }
  }

  async function saveToOpenedFile() {
    if (!openedFileHandle?.createWritable) {
      return { success: false, reason: "no_open_file" };
    }
    if (saveInProgress) {
      savePending = true;
      return activeSavePromise;
    }

    saveInProgress = true;
    activeSavePromise = (async () => {
      let result;
      do {
        savePending = false;
        result = await writeOpenedFile();
      } while (savePending);
      return result;
    })();

    try {
      return await activeSavePromise;
    } finally {
      saveInProgress = false;
      activeSavePromise = null;
    }
  }

  async function autoSaveOpenedBackup() {
    if (!isAutoSaveEnabled()) return { success: true, skipped: true, reason: "autosave_disabled" };
    if (!openedFileHandle?.createWritable) return { success: true, skipped: true, reason: "no_open_file" };
    try {
      return await saveToOpenedFile();
    } catch (error) {
      lastError = error?.message || "write_failed";
      return { success: false, reason: "write_failed", error: lastError };
    }
  }

  function hasOpenedWritableFile() {
    return Boolean(openedFileHandle?.createWritable);
  }

  function getBackupStatus() {
    return {
      hasOpenedFile: Boolean(openedFileHandle),
      canWrite: hasOpenedWritableFile(),
      fileName: openedFileName,
      saving: saveInProgress,
      pending: savePending,
      lastSavedAt: lastWriteAt,
      lastError,
      autoSaveEnabled: isAutoSaveEnabled(),
    };
  }

  function getOpenedFileState() {
    const status = getBackupStatus();
    return {
      hasFile: status.hasOpenedFile,
      canWrite: status.canWrite,
      fileName: status.fileName,
      lastWriteAt: status.lastSavedAt,
    };
  }

  async function readFileInput(file, mode = "merge") {
    if (!file?.text) return { success: false, reason: "invalid_backup_file" };
    const text = await file.text();
    return importBackupJson(text, mode);
  }

  global.LectoVozJsonBackup = {
    backupFormat,
    backupVersion,
    autoSavePreferenceKey,
    buildBackupData,
    validateBackupData,
    parseBackupJson,
    exportBackupJson,
    importBackupJson,
    mergeBackupData,
    replaceLocalData,
    stringifyBackup,
    openBackupFile,
    saveToOpenedFile,
    autoSaveOpenedBackup,
    hasOpenedWritableFile,
    getOpenedFileState,
    getBackupStatus,
    isAutoSaveEnabled,
    setAutoSaveEnabled,
    readFileInput,
  };
})(typeof window !== "undefined" ? window : globalThis);
