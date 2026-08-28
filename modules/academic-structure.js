(function initAcademicStructureModule(global) {
  const storageSchemaVersion = 2;
  const defaultSchoolId = "school-unassigned";
  const defaultSchoolName = "Sin escuela";
  const defaultGrade = "Sin especificar";
  const defaultGroup = "Sin especificar";

  function nowIso() {
    return new Date().toISOString();
  }

  function createId() {
    return global.crypto?.randomUUID ? global.crypto.randomUUID() : String(Date.now());
  }

  function normalizeTextValue(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function normalizeComparable(value) {
    return normalizeTextValue(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function normalizeSchoolName(name) {
    return normalizeTextValue(name);
  }

  function normalizeStudentName(name) {
    return normalizeTextValue(name);
  }

  function normalizeGroup(value) {
    return normalizeTextValue(value) || defaultGroup;
  }

  function normalizeGrade(value) {
    const normalized = normalizeTextValue(value);
    return ["1", "2", "3", "4", "5", "6"].includes(normalized) ? normalized : defaultGrade;
  }

  function normalizeMaxAttemptsPerChunk(value) {
    const attempts = Number(value);
    return [1, 2, 3].includes(attempts) ? attempts : 3;
  }

  function getDefaultConsonants() {
    return [...(global.LectoVozContent?.defaultConsonants || [])];
  }

  function makeDefaultConfig() {
    return {
      consonants: getDefaultConsonants(),
      levelStart: "silabas",
      sessionGoal: 10,
      shuffleSyllables: false,
      maxAttemptsPerChunk: 3,
      notes: "",
    };
  }

  function normalizeConfig(config) {
    const base = makeDefaultConfig();
    const source = config || {};
    return {
      ...base,
      ...source,
      consonants: Array.isArray(source.consonants) && source.consonants.length
        ? source.consonants
        : base.consonants,
      sessionGoal: Number(source.sessionGoal || base.sessionGoal),
      shuffleSyllables: Boolean(source.shuffleSyllables),
      maxAttemptsPerChunk: normalizeMaxAttemptsPerChunk(source.maxAttemptsPerChunk),
    };
  }

  function makeUniqueId(preferredId, usedIds, fallbackId) {
    let candidate = normalizeTextValue(preferredId) || fallbackId || createId();
    let suffix = 1;
    while (usedIds.has(candidate)) {
      candidate = `${fallbackId || createId()}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(candidate);
    return candidate;
  }

  function listSchools(schools) {
    return Array.isArray(schools) ? [...schools] : [];
  }

  function getSchoolById(schools, schoolId) {
    return listSchools(schools).find((school) => school.id === schoolId);
  }

  function findEquivalentSchool(schools, name) {
    const comparable = normalizeComparable(name);
    return listSchools(schools).find((school) => normalizeComparable(school.name) === comparable);
  }

  function hasDuplicateSchoolName(schools, name, ignoredId = "") {
    const comparable = normalizeComparable(name);
    return listSchools(schools).some((school) => (
      school.id !== ignoredId && normalizeComparable(school.name) === comparable
    ));
  }

  function createSchool(schools, name, options = {}) {
    const normalizedName = normalizeSchoolName(name);
    if (!normalizedName) return { success: false, reason: "school_name_required" };
    const currentSchools = listSchools(schools);
    if (hasDuplicateSchoolName(currentSchools, normalizedName)) {
      return { success: false, reason: "duplicate_school_name" };
    }
    const usedIds = new Set(currentSchools.map((school) => school.id));
    const timestamp = nowIso();
    const school = {
      id: makeUniqueId(options.id, usedIds),
      name: normalizedName,
      createdAt: options.createdAt || timestamp,
      updatedAt: options.updatedAt || timestamp,
    };
    return { success: true, school, schools: [...currentSchools, school] };
  }

  function editSchool(schools, schoolId, updates) {
    const currentSchools = listSchools(schools);
    const school = getSchoolById(currentSchools, schoolId);
    if (!school) return { success: false, reason: "school_not_found" };
    const nextName = normalizeSchoolName(updates?.name ?? school.name);
    if (!nextName) return { success: false, reason: "school_name_required" };
    if (hasDuplicateSchoolName(currentSchools, nextName, schoolId)) {
      return { success: false, reason: "duplicate_school_name" };
    }
    const updatedSchool = { ...school, ...updates, id: school.id, name: nextName, updatedAt: nowIso() };
    return {
      success: true,
      school: updatedSchool,
      schools: currentSchools.map((item) => (item.id === schoolId ? updatedSchool : item)),
    };
  }

  function deleteSchool(schools, schoolId, students = []) {
    if (listStudents(students).some((student) => student.schoolId === schoolId)) {
      return { success: false, reason: "school_has_students" };
    }
    const currentSchools = listSchools(schools);
    return {
      success: true,
      schools: currentSchools.filter((school) => school.id !== schoolId),
    };
  }

  function listStudents(students) {
    return Array.isArray(students) ? [...students] : [];
  }

  function getStudentById(students, studentId) {
    return listStudents(students).find((student) => student.id === studentId);
  }

  function filterStudentsBySchool(students, schoolId) {
    return listStudents(students).filter((student) => student.schoolId === schoolId);
  }

  function filterStudentsByGrade(students, grade) {
    const normalizedGrade = normalizeGrade(grade);
    return listStudents(students).filter((student) => normalizeGrade(student.grade) === normalizedGrade);
  }

  function filterStudentsByGroup(students, group) {
    const normalizedGroup = normalizeComparable(group);
    return listStudents(students).filter((student) => normalizeComparable(student.group) === normalizedGroup);
  }

  function validateStudentRelation(student, schools) {
    if (!normalizeStudentName(student?.name)) return { success: false, reason: "student_name_required" };
    if (!getSchoolById(schools, student?.schoolId)) return { success: false, reason: "school_not_found" };
    return { success: true };
  }

  function normalizeStudentRecord(student, schools, usedIds = new Set(), fallbackSchoolId = defaultSchoolId) {
    const currentSchools = listSchools(schools);
    const timestamp = nowIso();
    const schoolId = getSchoolById(currentSchools, student?.schoolId)
      ? student.schoolId
      : fallbackSchoolId;
    return {
      id: makeUniqueId(student?.id, usedIds, "student"),
      name: normalizeStudentName(student?.name),
      schoolId,
      grade: normalizeGrade(student?.grade),
      group: normalizeGroup(student?.group),
      config: normalizeConfig(student?.config),
      createdAt: student?.createdAt || timestamp,
      updatedAt: student?.updatedAt || timestamp,
    };
  }

  function createStudent(students, schools, data) {
    const relation = validateStudentRelation(data, schools);
    if (!relation.success) return relation;
    const currentStudents = listStudents(students);
    const usedIds = new Set(currentStudents.map((student) => student.id));
    const student = normalizeStudentRecord(data, schools, usedIds);
    return { success: true, student, students: [...currentStudents, student] };
  }

  function editStudent(students, schools, studentId, updates) {
    const currentStudents = listStudents(students);
    const student = getStudentById(currentStudents, studentId);
    if (!student) return { success: false, reason: "student_not_found" };
    const nextStudent = {
      ...student,
      ...updates,
      config: normalizeConfig(updates?.config || student.config),
      updatedAt: nowIso(),
    };
    const relation = validateStudentRelation(nextStudent, schools);
    if (!relation.success) return relation;
    const normalizedStudent = normalizeStudentRecord(nextStudent, schools, new Set(currentStudents.filter((item) => item.id !== studentId).map((item) => item.id)));
    normalizedStudent.id = studentId;
    return {
      success: true,
      student: normalizedStudent,
      students: currentStudents.map((item) => (item.id === studentId ? normalizedStudent : item)),
    };
  }

  function deleteStudent(students, studentId) {
    return {
      success: true,
      students: listStudents(students).filter((student) => student.id !== studentId),
    };
  }

  function ensureDefaultSchool(schools) {
    const currentSchools = listSchools(schools);
    const equivalent = findEquivalentSchool(currentSchools, defaultSchoolName);
    if (equivalent) return { school: equivalent, schools: currentSchools };
    const usedIds = new Set(currentSchools.map((school) => school.id));
    const timestamp = nowIso();
    const school = {
      id: makeUniqueId(defaultSchoolId, usedIds, defaultSchoolId),
      name: defaultSchoolName,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return { school, schools: [...currentSchools, school] };
  }

  function normalizeSchools(schools) {
    const usedIds = new Set();
    const seenNames = new Set();
    const idMap = {};
    const normalizedSchools = [];
    listSchools(schools).forEach((school) => {
      const name = normalizeSchoolName(school?.name);
      if (!name) return;
      const comparable = normalizeComparable(name);
      if (seenNames.has(comparable)) {
        const kept = normalizedSchools.find((item) => normalizeComparable(item.name) === comparable);
        if (kept && school?.id) idMap[school.id] = kept.id;
        return;
      }
      const id = makeUniqueId(school?.id, usedIds, comparable === normalizeComparable(defaultSchoolName) ? defaultSchoolId : "school");
      seenNames.add(comparable);
      normalizedSchools.push({
        id,
        name,
        createdAt: school?.createdAt || nowIso(),
        updatedAt: school?.updatedAt || school?.createdAt || nowIso(),
      });
      if (school?.id) idMap[school.id] = id;
    });
    const ensured = ensureDefaultSchool(normalizedSchools);
    return { schools: ensured.schools, defaultSchool: ensured.school, idMap };
  }

  function migrateAcademicData(data = {}) {
    const normalizedSchoolResult = normalizeSchools(data.schools);
    const schools = normalizedSchoolResult.schools;
    const usedStudentIds = new Set();
    const students = listStudents(data.students).map((student) => {
      const remappedSchoolId = normalizedSchoolResult.idMap[student?.schoolId] || student?.schoolId;
      return normalizeStudentRecord(
        { ...student, schoolId: remappedSchoolId },
        schools,
        usedStudentIds,
        normalizedSchoolResult.defaultSchool.id,
      );
    });
    return {
      version: storageSchemaVersion,
      schools,
      students,
    };
  }

  global.LectoVozAcademic = {
    storageSchemaVersion,
    defaultSchoolId,
    defaultSchoolName,
    defaultGrade,
    defaultGroup,
    normalizeTextValue,
    normalizeComparable,
    normalizeSchoolName,
    normalizeStudentName,
    normalizeGroup,
    normalizeGrade,
    normalizeMaxAttemptsPerChunk,
    normalizeConfig,
    makeDefaultConfig,
    createSchool,
    editSchool,
    deleteSchool,
    getSchoolById,
    listSchools,
    createStudent,
    editStudent,
    deleteStudent,
    getStudentById,
    listStudents,
    filterStudentsBySchool,
    filterStudentsByGrade,
    filterStudentsByGroup,
    validateStudentRelation,
    ensureDefaultSchool,
    migrateAcademicData,
  };
})(typeof window !== "undefined" ? window : globalThis);
