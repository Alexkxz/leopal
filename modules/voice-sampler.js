(function initVoiceSampler(global) {
  const MIME_CANDIDATES = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];

  const PRIORITY_SYLLABLES = [
    "ma", "me", "mi", "mo", "mu",
    "pa", "pe", "pi", "po", "pu",
    "ba", "be", "bi", "bo", "bu",
    "la", "le", "li", "lo", "lu",
    "sa", "se", "si", "so", "su",
    "ta", "te", "ti", "to", "tu",
    "da", "de", "di", "do", "du",
    "na", "ne", "ni", "no", "nu",
    "ra", "re", "ri", "ro", "ru",
    "ca", "co", "cu",
    "ga", "go", "gu",
    "fa", "fe", "fi", "fo", "fu",
    "ja", "je", "ji", "jo", "ju",
    "ña", "ñe", "ñi", "ño", "ñu",
    "cha", "che", "chi", "cho", "chu",
  ];

  const CONTRAST_SYLLABLES = [
    "ma", "pa", "ba", "ta", "da", "ca", "ga", "fa", "sa", "za", "ra", "la",
  ];

  const FALLBACK_SHORT_WORDS = [
    "sol", "pan", "mar", "mes", "pez", "sal", "luz", "dos", "fin", "hoy",
    "ojo", "oso", "ala", "casa", "mesa", "pato", "gato", "mano", "pala", "mapa",
    "luna", "nube", "rosa", "lago", "flor", "nido", "sopa", "miel", "boca", "dedo",
    "pelo", "cara", "ropa", "sala", "tela", "vela", "bola", "bota", "jugo", "vaca",
  ];

  const FALLBACK_MEDIUM_WORDS = [
    "pelota", "camino", "amigos", "escuela", "puerta", "cocina", "regalo", "jardin",
    "campo", "tiempo", "playa", "cielo", "elefante", "viento", "tierra", "verano",
    "bosque", "ciudad", "flores", "tambor", "cohete", "noche", "tarde", "cerro",
    "perro", "pajaro", "raton", "caballo", "conejo", "tortuga", "abuelo", "familia",
    "lapiz", "papel", "maestra", "alumno", "recreo", "mochila", "ventana", "palmera",
  ];

  const FALLBACK_LONG_WORDS = [
    "mariposa", "dinosaurio", "fotografia", "cumpleaños", "electricidad",
    "refrigerador", "funcionamiento", "responsabilidad", "cocodrilo", "guacamole",
    "computadora", "calculadora", "television", "pizarron", "telescopio",
    "temperatura", "universidad", "biblioteca", "supermercado", "diccionario",
  ];

  const FALLBACK_PHRASES = [
    "La casa es grande", "Mi perro corre rapido", "El sol sale hoy",
    "Mi mama me quiere", "El pato nada bien", "Voy a la escuela",
    "Tengo un libro rojo", "La pelota bota", "El cielo esta azul",
    "La maestra habla", "El alumno escucha", "Quiero jugar hoy",
  ];

  function unique(items) {
    return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
  }

  function wordsFromLessons(lessons, key, fallback, limit) {
    const source = Array.isArray(lessons?.[key]) ? lessons[key] : fallback;
    const words = unique(source.flatMap((line) => String(line).split(/\s+/)));
    return words.slice(0, limit);
  }

  function phrasesFromLessons(lessons, fallback, limit) {
    const source = Array.isArray(lessons?.frases_cortas) ? lessons.frases_cortas : fallback;
    return unique(source).slice(0, limit);
  }

  function getSamplerDataset(content = global.LectoVozContent) {
    const lessons = content?.lessons || {};
    const lessonSyllables = unique((lessons.silabas || []).flatMap((line) => String(line).split(/\s+/)));
    const syllables = unique([...PRIORITY_SYLLABLES, ...CONTRAST_SYLLABLES, ...lessonSyllables]);
    return {
      syllables,
      prioritySyllables: unique([...PRIORITY_SYLLABLES, ...CONTRAST_SYLLABLES]),
      shortWords: wordsFromLessons(lessons, "palabras_cortas", FALLBACK_SHORT_WORDS, 45),
      mediumWords: wordsFromLessons(lessons, "palabras_medianas", FALLBACK_MEDIUM_WORDS, 36),
      longWords: wordsFromLessons(lessons, "palabras_largas", FALLBACK_LONG_WORDS, 22),
      phrases: phrasesFromLessons(lessons, FALLBACK_PHRASES, 12),
    };
  }

  function makeDatasetItems(dataset = getSamplerDataset()) {
    return {
      syllables: dataset.syllables.map((target) => ({ target, category: "syllable", subcategory: "short" })),
      prioritySyllables: dataset.prioritySyllables.map((target) => ({ target, category: "syllable", subcategory: "priority" })),
      shortWords: dataset.shortWords.map((target) => ({ target, category: "word", subcategory: "short" })),
      mediumWords: dataset.mediumWords.map((target) => ({ target, category: "word", subcategory: "medium" })),
      longWords: dataset.longWords.map((target) => ({ target, category: "word", subcategory: "long" })),
      phrases: dataset.phrases.map((target) => ({ target, category: "phrase", subcategory: "short" })),
    };
  }

  function shuffle(items, random = Math.random) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function getModeItems(mode, dataset = getSamplerDataset()) {
    const items = makeDatasetItems(dataset);
    if (mode === "priority-syllables") return items.prioritySyllables;
    if (mode === "syllables") return items.syllables;
    if (mode === "short-words") return items.shortWords;
    if (mode === "medium-words") return items.mediumWords;
    if (mode === "long-words") return items.longWords;
    if (mode === "phrases") return items.phrases;
    if (mode === "quick") {
      return [
        ...items.prioritySyllables.slice(0, 24),
        ...items.shortWords.slice(0, 12),
        ...items.mediumWords.slice(0, 6),
        ...items.phrases.slice(0, 4),
      ];
    }
    return [...items.syllables, ...items.shortWords, ...items.mediumWords, ...items.longWords, ...items.phrases];
  }

  function normalizeRepetitions(value, fallback) {
    const numeric = Number(value);
    return [1, 2, 3].includes(numeric) ? numeric : fallback;
  }

  function repetitionsForItem(item, config) {
    if (item.category === "syllable") return normalizeRepetitions(config.syllableRepetitions, 3);
    if (item.category === "phrase") return normalizeRepetitions(config.phraseRepetitions, 2);
    return normalizeRepetitions(config.wordRepetitions, 2);
  }

  function buildRecordingSequence(config = {}, dataset = getSamplerDataset(), random = Math.random) {
    const mode = config.mode || "quick";
    const baseItems = getModeItems(mode, dataset);
    const sequence = [];
    baseItems.forEach((item) => {
      const repetitions = repetitionsForItem(item, config);
      for (let repetition = 1; repetition <= repetitions; repetition += 1) {
        sequence.push({ ...item, repetition, repetitions });
      }
    });
    const ordered = config.randomOrder ? shuffle(sequence, random) : sequence;
    return ordered.map((item, index) => ({ ...item, order: index + 1 }));
  }

  function sanitizeIdentifier(value) {
    const clean = String(value || "ALUMNO")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48);
    return clean || "ALUMNO";
  }

  function slugTarget(value) {
    return sanitizeIdentifier(String(value || "muestra").toLowerCase()).slice(0, 32) || "muestra";
  }

  function getAudioExtension(mimeType) {
    if (/ogg/i.test(mimeType)) return "ogg";
    if (/mp4|m4a/i.test(mimeType)) return "m4a";
    return "webm";
  }

  function makeRecordingFileName(index, target, repetition, mimeType = "audio/webm") {
    const number = String(index).padStart(3, "0");
    return `${number}_${slugTarget(target)}_rep${repetition}.${getAudioExtension(mimeType)}`;
  }

  function pickSupportedMimeType(MediaRecorderCtor = global.MediaRecorder) {
    if (!MediaRecorderCtor) return "";
    return MIME_CANDIDATES.find((type) => MediaRecorderCtor.isTypeSupported?.(type)) || "";
  }

  function validateAudioMetrics(metrics = {}) {
    const warnings = [];
    if (Number(metrics.durationMs || 0) < 250) warnings.push("recording_too_short");
    if (Number(metrics.rms || 0) > 0 && Number(metrics.rms) < 0.008) warnings.push("volume_very_low");
    if (Number(metrics.peak || 0) >= 0.98) warnings.push("possible_saturation");
    if (Number(metrics.sizeBytes || 0) <= 0) warnings.push("empty_audio");
    return warnings;
  }

  async function calculateBlobMetrics(blob, audioContext) {
    const result = {
      sizeBytes: blob?.size || 0,
      durationMs: 0,
      rms: 0,
      peak: 0,
    };
    if (!blob || !audioContext) return result;
    try {
      const buffer = await blob.arrayBuffer();
      const decoded = await audioContext.decodeAudioData(buffer.slice(0));
      const samples = decoded.getChannelData(0);
      let sum = 0;
      let peak = 0;
      for (let index = 0; index < samples.length; index += 1) {
        const value = samples[index];
        sum += value * value;
        peak = Math.max(peak, Math.abs(value));
      }
      result.durationMs = (decoded.length / decoded.sampleRate) * 1000;
      result.rms = Math.sqrt(sum / Math.max(samples.length, 1));
      result.peak = peak;
    } catch {
      result.durationMs = 0;
    }
    return result;
  }

  function buildMetadata({ participant, session, sequence, acceptedRecordings, skippedItems, repeatedTakes }) {
    const recordings = acceptedRecordings.map((item) => ({
      file: item.file,
      archivo: item.file,
      target: item.target,
      palabra_objetivo: item.target,
      palabra: item.target,
      category: item.category,
      categoria: item.category,
      subcategory: item.subcategory,
      repetition: item.repetition,
      repeticion: item.repetition,
      order: item.order,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      durationMs: Math.round(item.durationMs || 0),
      recordedAt: item.recordedAt,
      warnings: item.warnings || [],
    }));
    return {
      format: "lectovoz-voice-samples",
      version: 2,
      createdAt: new Date().toISOString(),
      participant: {
        id: sanitizeIdentifier(participant.id),
        grade: String(participant.grade || ""),
        age: participant.age ? Number(participant.age) : null,
        group: String(participant.group || ""),
        region: String(participant.region || ""),
        notes: String(participant.notes || ""),
      },
      alumno: {
        nombre: sanitizeIdentifier(participant.id),
        grado: String(participant.grade || ""),
        edad: participant.age ? Number(participant.age) : null,
        grupo: String(participant.group || ""),
        region: String(participant.region || ""),
      },
      session: {
        mode: session.mode,
        repetitionsConfigured: session.repetitionsConfigured,
        syllableRepetitions: session.syllableRepetitions,
        wordRepetitions: session.wordRepetitions,
        phraseRepetitions: session.phraseRepetitions,
        randomOrder: Boolean(session.randomOrder),
        totalExpected: sequence.length,
        totalAccepted: acceptedRecordings.length,
        totalSkipped: skippedItems.length,
        repeatedTakes,
        order: sequence.map(({ target, category, subcategory, repetition, order }) => ({
          target,
          category,
          subcategory,
          repetition,
          order,
        })),
      },
      recordings,
      grabaciones: recordings,
      skipped: skippedItems,
    };
  }

  function crc32(bytes) {
    let crc = -1;
    for (let index = 0; index < bytes.length; index += 1) {
      crc ^= bytes[index];
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ -1) >>> 0;
  }

  function dosDateTime(date = new Date()) {
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time, date: dosDate };
  }

  function writeUint32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
  }

  function writeUint16(view, offset, value) {
    view.setUint16(offset, value & 0xffff, true);
  }

  async function createZipBlob(files) {
    const encoder = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    const stamp = dosDateTime();

    for (const file of files) {
      const nameBytes = encoder.encode(file.name);
      const data = new Uint8Array(await file.blob.arrayBuffer());
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(local.buffer);
      writeUint32(localView, 0, 0x04034b50);
      writeUint16(localView, 4, 20);
      writeUint16(localView, 6, 0x0800);
      writeUint16(localView, 8, 0);
      writeUint16(localView, 10, stamp.time);
      writeUint16(localView, 12, stamp.date);
      writeUint32(localView, 14, crc);
      writeUint32(localView, 18, data.length);
      writeUint32(localView, 22, data.length);
      writeUint16(localView, 26, nameBytes.length);
      local.set(nameBytes, 30);
      chunks.push(local, data);

      const header = new Uint8Array(46 + nameBytes.length);
      const view = new DataView(header.buffer);
      writeUint32(view, 0, 0x02014b50);
      writeUint16(view, 4, 20);
      writeUint16(view, 6, 20);
      writeUint16(view, 8, 0x0800);
      writeUint16(view, 10, 0);
      writeUint16(view, 12, stamp.time);
      writeUint16(view, 14, stamp.date);
      writeUint32(view, 16, crc);
      writeUint32(view, 20, data.length);
      writeUint32(view, 24, data.length);
      writeUint16(view, 28, nameBytes.length);
      writeUint32(view, 42, offset);
      header.set(nameBytes, 46);
      central.push(header);
      offset += local.length + data.length;
    }

    const centralOffset = offset;
    central.forEach((entry) => {
      chunks.push(entry);
      offset += entry.length;
    });
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    writeUint32(eocdView, 0, 0x06054b50);
    writeUint16(eocdView, 8, files.length);
    writeUint16(eocdView, 10, files.length);
    writeUint32(eocdView, 12, offset - centralOffset);
    writeUint32(eocdView, 16, centralOffset);
    chunks.push(eocd);
    return new Blob(chunks, { type: "application/zip" });
  }

  function makeZipName(participantId, date = new Date()) {
    return `lectovoz_muestras_${sanitizeIdentifier(participantId)}_${date.toISOString().slice(0, 10)}.zip`;
  }

  function bootUI() {
    const doc = global.document;
    if (!doc) return;

    const setupPanel = doc.getElementById("setup-panel");
    const setupFeedback = doc.getElementById("setup-feedback");
    const capturePanel = doc.getElementById("capture-panel");
    const summaryPanel = doc.getElementById("summary-panel");
    const form = doc.getElementById("sampler-form");
    const progress = doc.getElementById("sample-progress");
    const detail = doc.getElementById("sample-detail");
    const micState = doc.getElementById("mic-state");
    const targetText = doc.getElementById("target-text");
    const feedback = doc.getElementById("sampler-feedback");
    const audio = doc.getElementById("sample-audio");
    const technical = doc.getElementById("technical-output");
    const summary = doc.getElementById("summary-output");

    const recordBtn = doc.getElementById("record-btn");
    const stopBtn = doc.getElementById("stop-btn");
    const playBtn = doc.getElementById("play-btn");
    const retryBtn = doc.getElementById("retry-btn");
    const acceptBtn = doc.getElementById("accept-btn");
    const skipBtn = doc.getElementById("skip-btn");
    const pauseBtn = doc.getElementById("pause-btn");
    const finishBtn = doc.getElementById("finish-btn");
    const downloadBtn = doc.getElementById("download-btn");

    let state = "idle";
    let stream = null;
    let recorder = null;
    let chunks = [];
    let sequence = [];
    let participant = {};
    let session = {};
    let currentBlob = null;
    let currentMetrics = null;
    let currentStartedAt = 0;
    let currentObjectUrl = "";
    let index = 0;
    let acceptedRecordings = [];
    let skippedItems = [];
    let repeatedTakes = 0;
    let zipBlob = null;

    function setState(next) {
      state = next;
      const hasRecording = Boolean(currentBlob);
      recordBtn.disabled = !["ready", "recorded"].includes(state);
      stopBtn.disabled = state !== "recording";
      playBtn.disabled = !hasRecording || state === "recording";
      retryBtn.disabled = !hasRecording || state === "recording";
      acceptBtn.disabled = !hasRecording || state === "recording";
      skipBtn.disabled = state === "recording" || state === "finished";
      pauseBtn.disabled = state === "recording" || state === "finished";
      finishBtn.disabled = state === "recording" || state === "finished";
    }

    function currentItem() {
      return sequence[index];
    }

    function maxDurationForItem(item) {
      return item?.category === "syllable" || item?.subcategory === "short" ? 3000 : 5000;
    }

    function renderCurrent() {
      const item = currentItem();
      if (!item) {
        finishSession();
        return;
      }
      progress.textContent = `Muestra ${index + 1} de ${sequence.length}`;
      detail.textContent = `${item.target.toUpperCase()} · repeticion ${item.repetition} de ${item.repetitions}`;
      targetText.textContent = item.target.toUpperCase();
      feedback.textContent = index > 0 && index % 30 === 0
        ? `Llevamos ${index} muestras. Puedes hacer una pausa.`
        : "Listo para grabar.";
      technical.textContent = "Sin grabacion.";
      clearCurrentRecording();
      setState("ready");
    }

    function clearCurrentRecording() {
      currentBlob = null;
      currentMetrics = null;
      chunks = [];
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = "";
      audio.hidden = true;
      audio.removeAttribute("src");
    }

    async function ensureStream() {
      if (stream?.active) return stream;
      if (!global.MediaRecorder) throw new Error("MediaRecorder no esta disponible en este navegador.");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no permite acceder al microfono.");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micState.textContent = "Microfono activo";
      return stream;
    }

    async function startRecording() {
      try {
        const mediaStream = await ensureStream();
        const mimeType = pickSupportedMimeType(global.MediaRecorder);
        recorder = new global.MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
        chunks = [];
        recorder.ondataavailable = (event) => {
          if (event.data?.size) chunks.push(event.data);
        };
        recorder.onstop = finalizeRecording;
        currentStartedAt = performance.now();
        recorder.start();
        feedback.textContent = "Grabando...";
        setState("recording");
        global.setTimeout(() => {
          if (state === "recording" && recorder?.state === "recording") recorder.stop();
        }, maxDurationForItem(currentItem()));
      } catch (error) {
        feedback.textContent = error.message || "No se pudo iniciar el microfono.";
      }
    }

    async function finalizeRecording() {
      const mimeType = recorder?.mimeType || pickSupportedMimeType(global.MediaRecorder) || "audio/webm";
      currentBlob = new Blob(chunks, { type: mimeType });
      const AudioContextCtor = global.AudioContext || global.webkitAudioContext;
      const audioContext = AudioContextCtor ? new AudioContextCtor() : null;
      currentMetrics = await calculateBlobMetrics(currentBlob, audioContext);
      await audioContext?.close?.();
      currentMetrics.durationMs = currentMetrics.durationMs || Math.max(0, performance.now() - currentStartedAt);
      currentMetrics.sizeBytes = currentBlob.size;
      currentMetrics.warnings = validateAudioMetrics(currentMetrics);
      currentObjectUrl = URL.createObjectURL(currentBlob);
      audio.src = currentObjectUrl;
      audio.hidden = false;
      technical.textContent = JSON.stringify(currentMetrics, null, 2);
      feedback.textContent = currentMetrics.warnings.length
        ? "⚠ Esta grabacion podria ser baja o corta. Puedes repetirla o aceptarla manualmente."
        : "Grabacion lista para escuchar.";
      setState("recorded");
    }

    function acceptCurrent() {
      if (!currentBlob) {
        feedback.textContent = "Primero graba una muestra.";
        return;
      }
      const item = currentItem();
      const file = makeRecordingFileName(index + 1, item.target, item.repetition, currentBlob.type);
      acceptedRecordings.push({
        ...item,
        file,
        blob: currentBlob,
        mimeType: currentBlob.type || "audio/webm",
        sizeBytes: currentBlob.size,
        durationMs: currentMetrics?.durationMs || 0,
        warnings: currentMetrics?.warnings || [],
        recordedAt: new Date().toISOString(),
      });
      index += 1;
      renderCurrent();
    }

    function skipCurrent() {
      const item = currentItem();
      skippedItems.push({ ...item, skippedAt: new Date().toISOString() });
      index += 1;
      renderCurrent();
    }

    function retryCurrent() {
      if (!currentBlob) return;
      repeatedTakes += 1;
      clearCurrentRecording();
      feedback.textContent = "Toma descartada. Graba nuevamente el mismo objetivo.";
      setState("ready");
    }

    async function finishSession() {
      setState("finished");
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      micState.textContent = "Microfono liberado";
      const metadata = buildMetadata({ participant, session, sequence, acceptedRecordings, skippedItems, repeatedTakes });
      const files = [
        { name: "metadata.json", blob: new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" }) },
        ...acceptedRecordings.map((recording) => ({ name: recording.file, blob: recording.blob })),
      ];
      try {
        zipBlob = await createZipBlob(files);
        const categories = [...new Set(acceptedRecordings.map((item) => `${item.category}:${item.subcategory}`))];
        const totalDuration = acceptedRecordings.reduce((sum, item) => sum + Number(item.durationMs || 0), 0);
        summary.textContent = JSON.stringify({
          muestrasPlaneadas: sequence.length,
          grabacionesAceptadas: acceptedRecordings.length,
          omitidas: skippedItems.length,
          repetidas: repeatedTakes,
          duracionTotalAproximadaMs: Math.round(totalDuration),
          categoriasCompletadas: categories,
          archivoZip: makeZipName(participant.id),
        }, null, 2);
        capturePanel.hidden = true;
        summaryPanel.hidden = false;
      } catch (error) {
        feedback.textContent = `Error al crear ZIP: ${error.message || error}`;
        setState("ready");
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      participant = {
        id: doc.getElementById("participant-id").value,
        grade: doc.getElementById("participant-grade").value,
        age: doc.getElementById("participant-age").value,
        group: doc.getElementById("participant-group").value,
        region: doc.getElementById("participant-region").value,
        notes: doc.getElementById("participant-notes").value,
      };
      session = {
        mode: doc.getElementById("session-mode").value,
        syllableRepetitions: normalizeRepetitions(doc.getElementById("syllable-repetitions").value, 3),
        wordRepetitions: normalizeRepetitions(doc.getElementById("word-repetitions").value, 2),
        phraseRepetitions: normalizeRepetitions(doc.getElementById("phrase-repetitions").value, 2),
        randomOrder: doc.getElementById("random-order").checked,
      };
      session.repetitionsConfigured = {
        syllable: session.syllableRepetitions,
        word: session.wordRepetitions,
        phrase: session.phraseRepetitions,
      };
      try {
        await ensureStream();
        sequence = buildRecordingSequence(session);
        setupPanel.hidden = true;
        capturePanel.hidden = false;
        renderCurrent();
      } catch (error) {
        setupFeedback.textContent = error.message || "No se pudo acceder al microfono.";
      }
    });

    recordBtn.addEventListener("click", startRecording);
    stopBtn.addEventListener("click", () => recorder?.state === "recording" && recorder.stop());
    playBtn.addEventListener("click", () => audio.play());
    retryBtn.addEventListener("click", retryCurrent);
    acceptBtn.addEventListener("click", acceptCurrent);
    skipBtn.addEventListener("click", skipCurrent);
    pauseBtn.addEventListener("click", () => {
      if (state === "paused") {
        feedback.textContent = "Sesion reanudada.";
        pauseBtn.textContent = "Pausar sesion";
        setState(currentBlob ? "recorded" : "ready");
      } else {
        feedback.textContent = "Sesion pausada.";
        pauseBtn.textContent = "Continuar";
        setState("paused");
      }
    });
    finishBtn.addEventListener("click", finishSession);
    downloadBtn.addEventListener("click", () => {
      if (!zipBlob) return;
      const url = URL.createObjectURL(zipBlob);
      const link = doc.createElement("a");
      link.href = url;
      link.download = makeZipName(participant.id);
      link.click();
      URL.revokeObjectURL(url);
    });
    global.addEventListener?.("pagehide", () => stream?.getTracks().forEach((track) => track.stop()));
  }

  global.LectoVozVoiceSampler = {
    PRIORITY_SYLLABLES,
    CONTRAST_SYLLABLES,
    getSamplerDataset,
    makeDatasetItems,
    buildRecordingSequence,
    sanitizeIdentifier,
    makeRecordingFileName,
    pickSupportedMimeType,
    validateAudioMetrics,
    calculateBlobMetrics,
    buildMetadata,
    createZipBlob,
    makeZipName,
  };

  if (global.document) {
    global.document.addEventListener("DOMContentLoaded", bootUI);
  }
})(typeof window !== "undefined" ? window : globalThis);
