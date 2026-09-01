(function initVoiceSampler(global) {
  const MIME_CANDIDATES = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];

  const STRUCTURE = {
    syllables: {
      label: "SILABAS",
      sublevels: {
        syllables: { label: "Silabas" },
        segmentedWords: { label: "Palabras silabeadas" },
      },
    },
    words: {
      label: "PALABRAS",
      sublevels: {
        simpleWords: { label: "Palabras simples" },
        complexWords: { label: "Palabras complejas" },
      },
    },
    sentences: {
      label: "ORACIONES",
      sublevels: {
        shortSentences: { label: "Oraciones cortas" },
        longSentences: { label: "Oraciones amplias" },
      },
    },
  };

  const SUBLEVEL_CATEGORY = {
    syllables: "syllables",
    segmentedWords: "syllables",
    simpleWords: "words",
    complexWords: "words",
    shortSentences: "sentences",
    longSentences: "sentences",
  };

  const CONTENT_SUBLEVEL = {
    syllables: "syllables",
    segmentedWords: "segmentedWords",
    simpleWords: "simple",
    complexWords: "complex",
    shortSentences: "short",
    longSentences: "long",
  };

  const QUICK_LIMITS = {
    syllables: 24,
    segmentedWords: 24,
    simpleWords: 24,
    complexWords: 24,
    shortSentences: 12,
    longSentences: 12,
  };

  const GENERAL_LIMITS = {
    syllables: 12,
    segmentedWords: 8,
    simpleWords: 10,
    complexWords: 10,
    shortSentences: 6,
    longSentences: 6,
  };

  const CONTRAST_SYLLABLES = ["ma", "pa", "ba", "ta", "da", "ca", "ga", "fa", "sa", "za", "ra", "la"];

  function uniqueBy(items, keyFn) {
    const seen = new Set();
    return items.filter((item) => {
      const key = keyFn(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normalizeSamplerItem(value, category, sublevel, index = 0) {
    const source = typeof value === "string" ? { displayText: value, expectedText: value } : value || {};
    return {
      category,
      sublevel,
      displayText: source.displayText || source.expectedText || "",
      expectedText: source.expectedText || source.displayText || "",
      consonant: source.consonant || "",
      itemIndex: index + 1,
    };
  }

  function getOfficialItems(content, category, sublevel) {
    if (content?.getItems) {
      return content.getItems(category, CONTENT_SUBLEVEL[sublevel] || sublevel).map((item, index) => normalizeSamplerItem(item, category, sublevel, index));
    }
    const lessons = content?.lessons || {};
    const keyMap = {
      syllables: "silabas",
      segmentedWords: "segmentedWords",
      simpleWords: "palabras_cortas",
      complexWords: "palabras_largas",
      shortSentences: "frases_cortas",
      longSentences: "frases_largas",
    };
    const raw = lessons[keyMap[sublevel]] || [];
    const flattened = sublevel === "syllables"
      ? raw.flatMap((line) => String(line).split(/\s+/).filter(Boolean))
      : raw;
    return flattened.map((item, index) => normalizeSamplerItem(item, category, sublevel, index));
  }

  function getSamplerDataset(content = global.LectoVozContent) {
    const dataset = {};
    Object.entries(SUBLEVEL_CATEGORY).forEach(([sublevel, category]) => {
      dataset[sublevel] = uniqueBy(
        getOfficialItems(content, category, sublevel),
        (item) => `${item.category}:${item.sublevel}:${item.expectedText}`,
      );
    });
    dataset.structure = STRUCTURE;
    dataset.syllables = dataset.syllables || [];
    dataset.segmentedWords = dataset.segmentedWords || [];
    dataset.simpleWords = dataset.simpleWords || [];
    dataset.complexWords = dataset.complexWords || [];
    dataset.shortSentences = dataset.shortSentences || [];
    dataset.longSentences = dataset.longSentences || [];
    dataset.prioritySyllables = uniqueBy([
      ...CONTRAST_SYLLABLES.map((text) => normalizeSamplerItem(text, "syllables", "syllables")),
      ...dataset.syllables,
    ], (item) => item.expectedText).slice(0, 30);

    dataset.shortWords = dataset.simpleWords.slice(0, 45).map((item) => item.expectedText);
    dataset.mediumWords = dataset.simpleWords.slice(45, 81).map((item) => item.expectedText);
    dataset.longWords = dataset.complexWords.slice(0, 22).map((item) => item.expectedText);
    dataset.phrases = dataset.shortSentences.slice(0, 12).map((item) => item.expectedText);
    return dataset;
  }

  function shuffle(items, random = Math.random) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function normalizeRepetitions(value, fallback) {
    const numeric = Number(value);
    return [1, 2, 3].includes(numeric) ? numeric : fallback;
  }

  function getSublevelItems(config = {}, dataset = getSamplerDataset()) {
    const sublevel = config.sublevel || "syllables";
    const mode = config.mode || "quick";
    if (mode === "general") {
      return Object.entries(GENERAL_LIMITS).flatMap(([key, limit]) => (dataset[key] || []).slice(0, limit));
    }
    const items = dataset[sublevel] || [];
    if (mode === "complete") return items;
    return items.slice(0, QUICK_LIMITS[sublevel] || 24);
  }

  function repetitionsForItem(item, config = {}) {
    if (config.mode === "general") return 1;
    if (item.sublevel === "syllables") return normalizeRepetitions(config.syllableRepetitions, 3);
    return normalizeRepetitions(config.itemRepetitions, 1);
  }

  function buildRecordingSequence(config = {}, dataset = getSamplerDataset(), random = Math.random) {
    const baseItems = getSublevelItems(config, dataset);
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
    return sanitizeIdentifier(String(value || "muestra").toLowerCase().replace(/-/g, "")).slice(0, 32) || "muestra";
  }

  function getAudioExtension(mimeType) {
    if (/ogg/i.test(mimeType)) return "ogg";
    if (/mp4|m4a/i.test(mimeType)) return "m4a";
    return "webm";
  }

  function makeRecordingFileName(index, itemOrTarget, repetition = 1, mimeType = "audio/webm") {
    const item = typeof itemOrTarget === "object" ? itemOrTarget : { expectedText: itemOrTarget, sublevel: "" };
    const number = String(index).padStart(3, "0");
    const extension = getAudioExtension(mimeType);
    if (item.sublevel === "shortSentences" || item.sublevel === "longSentences") {
      return `${number}_oracion_${String(item.itemIndex || index).padStart(3, "0")}_rep${repetition}.${extension}`;
    }
    return `${number}_${slugTarget(item.expectedText || item.displayText)}_rep${repetition}.${extension}`;
  }

  function makeZipName(participantId, session = {}, date = new Date()) {
    const category = sanitizeIdentifier(session.category || SUBLEVEL_CATEGORY[session.sublevel] || "general").toLowerCase();
    const sublevel = sanitizeIdentifier(session.sublevel || session.mode || "muestra").toLowerCase();
    return `lectovoz_muestras_${sanitizeIdentifier(participantId)}_${category}_${sublevel}_${date.toISOString().slice(0, 10)}.zip`;
  }

  function pickSupportedMimeType(MediaRecorderCtor = global.MediaRecorder) {
    if (!MediaRecorderCtor) return "";
    return MIME_CANDIDATES.find((type) => MediaRecorderCtor.isTypeSupported?.(type)) || "";
  }

  function minimumDurationForItem(item = {}) {
    if (item.sublevel === "shortSentences" || item.sublevel === "longSentences") return 700;
    if (item.sublevel === "segmentedWords" || item.sublevel === "simpleWords" || item.sublevel === "complexWords") return 300;
    return 250;
  }

  function validateAudioMetrics(metrics = {}, item = {}) {
    const warnings = [];
    if (Number(metrics.durationMs || 0) < minimumDurationForItem(item)) warnings.push("recording_too_short");
    if (Number(metrics.rms || 0) > 0 && Number(metrics.rms) < 0.008) warnings.push("volume_very_low");
    if (Number(metrics.peak || 0) >= 0.98) warnings.push("possible_saturation");
    if (Number(metrics.sizeBytes || 0) <= 0) warnings.push("empty_audio");
    return warnings;
  }

  function validateRecordingBlob(blob, mimeType = "", metrics = {}, item = {}) {
    const supportedMime = MIME_CANDIDATES.some((candidate) => candidate.split(";")[0] === String(mimeType || blob?.type || "").split(";")[0]);
    if (!blob || blob.size <= 0) return { valid: false, reason: "empty_blob", warnings: ["empty_audio"] };
    if (!supportedMime) return { valid: false, reason: "invalid_mime_type", warnings: [] };
    const warnings = validateAudioMetrics({ ...metrics, sizeBytes: blob.size }, item);
    if (warnings.includes("empty_audio")) return { valid: false, reason: "empty_audio", warnings };
    return { valid: true, reason: "", warnings };
  }

  function canAcceptRecording(state, blob, validation) {
    return state === "recorded" && Boolean(blob) && validation?.valid === true;
  }

  function isStreamUsable(stream) {
    return Boolean(stream?.active && stream.getTracks?.().some((track) => track.readyState !== "ended"));
  }

  function stopSessionStream(stream) {
    if (!stream?.getTracks) return 0;
    const tracks = stream.getTracks();
    tracks.forEach((track) => track.stop?.());
    return tracks.length;
  }

  function getMicrophoneStatus(stream) {
    return isStreamUsable(stream) ? "connected" : "disconnected";
  }

  async function requestSessionStream(sessionState, getUserMedia, options = {}) {
    if (isStreamUsable(sessionState.stream)) {
      return { stream: sessionState.stream, requested: false, status: "connected" };
    }
    if (sessionState.stream && !options.forceReconnect) {
      sessionState.status = "disconnected";
      return { stream: null, requested: false, status: "disconnected" };
    }
    if (sessionState.stream && options.forceReconnect) stopSessionStream(sessionState.stream);
    sessionState.stream = await getUserMedia({ audio: true });
    sessionState.status = "connected";
    return { stream: sessionState.stream, requested: true, status: "connected" };
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

  function buildRecordingMetadata(item, recording) {
    return {
      file: recording.file,
      archivo: recording.file,
      category: item.category,
      categoria: item.category,
      sublevel: item.sublevel,
      subcategory: item.sublevel,
      subcategoria: item.sublevel,
      displayText: item.displayText,
      expectedText: item.expectedText,
      target: item.expectedText,
      palabra_objetivo: item.expectedText,
      palabra: item.expectedText,
      repetition: item.repetition,
      repeticion: item.repetition,
      repetitions: item.repetitions,
      order: item.order,
      mimeType: recording.mimeType,
      sizeBytes: recording.sizeBytes,
      durationMs: Math.round(recording.durationMs || 0),
      validation: recording.validation || { tooShort: false, tooQuiet: false, clipping: false },
      warnings: recording.warnings || [],
      recordedAt: recording.recordedAt,
    };
  }

  function buildMetadata({ participant, session, sequence, acceptedRecordings, skippedItems, repeatedTakes }) {
    const recordings = acceptedRecordings.map((recording) => buildRecordingMetadata(recording, recording));
    return {
      format: "lectovoz-voice-samples",
      version: 3,
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
        category: session.category || SUBLEVEL_CATEGORY[session.sublevel] || "general",
        sublevel: session.sublevel || "general",
        mode: session.mode || "quick",
        repetitionsConfigured: Number(session.syllableRepetitions || 3),
        syllableRepetitions: Number(session.syllableRepetitions || 3),
        itemRepetitions: Number(session.itemRepetitions || 1),
        randomOrder: Boolean(session.randomOrder),
        totalExpected: sequence.length,
        totalAccepted: acceptedRecordings.length,
        totalSkipped: skippedItems.length,
        repeatedTakes,
        order: sequence.map((item) => ({
          category: item.category,
          sublevel: item.sublevel,
          displayText: item.displayText,
          expectedText: item.expectedText,
          repetition: item.repetition,
          order: item.order,
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
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
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

  function formatWarningMessage(validation) {
    if (!validation?.valid) return "No fue posible generar correctamente la grabacion. Por favor, repitela.";
    if (validation.warnings.includes("volume_very_low")) return "Se detecto muy poco sonido. Acercate al microfono y vuelve a intentarlo, o acepta manualmente.";
    if (validation.warnings.includes("recording_too_short")) return "La grabacion es demasiado corta. Es posible que no se haya registrado correctamente la voz.";
    if (validation.warnings.includes("possible_saturation")) return "El volumen parece demasiado alto. Puedes repetir o aceptar manualmente.";
    return "Grabacion lista para escuchar.";
  }

  function bootUI() {
    const doc = global.document;
    if (!doc) return;

    const setupPanel = doc.getElementById("setup-panel");
    const setupFeedback = doc.getElementById("setup-feedback");
    const capturePanel = doc.getElementById("capture-panel");
    const summaryPanel = doc.getElementById("summary-panel");
    const form = doc.getElementById("sampler-form");
    const categoryInput = doc.getElementById("sampler-category");
    const sublevelInput = doc.getElementById("sampler-sublevel");
    const modeInput = doc.getElementById("session-mode");
    const sublevelChoices = doc.getElementById("sublevel-choices");
    const categoryButtons = [...doc.querySelectorAll("[data-sampler-category]")];
    const progress = doc.getElementById("sample-progress");
    const detail = doc.getElementById("sample-detail");
    const micState = doc.getElementById("mic-state");
    const targetText = doc.getElementById("target-text");
    const categoryLabel = doc.getElementById("capture-category");
    const sublevelLabel = doc.getElementById("capture-sublevel");
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
    const reconnectBtn = doc.getElementById("reconnect-btn");
    const cancelBtn = doc.getElementById("cancel-btn");
    const finishBtn = doc.getElementById("finish-btn");
    const downloadBtn = doc.getElementById("download-btn");

    let state = "idle";
    let sessionStream = null;
    let recorder = null;
    let recordedChunks = [];
    let stopPromise = null;
    let sequence = [];
    let participant = {};
    let session = {};
    let currentBlob = null;
    let currentMetrics = null;
    let currentValidation = null;
    let currentStartedAt = 0;
    let currentObjectUrl = "";
    let index = 0;
    let acceptedRecordings = [];
    let skippedItems = [];
    let repeatedTakes = 0;
    let zipBlob = null;

    function setState(next) {
      state = next;
      const canUseRecording = Boolean(currentBlob) && state !== "recording" && state !== "stopping";
      recordBtn.disabled = !["ready", "recorded"].includes(state);
      stopBtn.disabled = state !== "recording";
      playBtn.disabled = !canUseRecording;
      retryBtn.disabled = !canUseRecording;
      acceptBtn.disabled = !canAcceptRecording(state, currentBlob, currentValidation);
      skipBtn.disabled = state === "recording" || state === "stopping" || state === "finished";
      pauseBtn.disabled = state === "recording" || state === "stopping" || state === "finished";
      cancelBtn.disabled = state === "recording" || state === "stopping" || state === "finished";
      finishBtn.disabled = state === "recording" || state === "stopping" || state === "finished";
      micState.textContent = state === "stopping" ? "Cerrando grabacion" : micState.textContent;
    }

    function setMicrophoneConnected() {
      micState.textContent = "🎙 Microfono conectado";
      reconnectBtn.hidden = true;
      if (state === "mic-disconnected") setState(currentBlob ? "recorded" : "ready");
    }

    function setMicrophoneDisconnected() {
      micState.textContent = "⚠ Microfono desconectado";
      reconnectBtn.hidden = false;
      recordBtn.disabled = true;
      setState("mic-disconnected");
      recordBtn.disabled = true;
      feedback.textContent = "El microfono se desconecto. Conservamos las muestras aceptadas; reconecta manualmente para continuar.";
    }

    function watchSessionStream(stream) {
      stream?.getTracks?.().forEach((track) => {
        track.onended = () => {
          if (sessionStream === stream) setMicrophoneDisconnected();
        };
      });
    }

    function currentItem() {
      return sequence[index];
    }

    function maxDurationForItem(item) {
      if (item?.sublevel === "shortSentences" || item?.sublevel === "longSentences") return 10000;
      if (item?.sublevel === "segmentedWords" || item?.sublevel === "simpleWords" || item?.sublevel === "complexWords") return 5000;
      return 3000;
    }

    function renderSublevels(category) {
      const options = STRUCTURE[category]?.sublevels || {};
      sublevelChoices.innerHTML = "";
      Object.entries(options).forEach(([sublevel, info], optionIndex) => {
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "sampler-sublevel-card";
        button.dataset.samplerSublevel = sublevel;
        button.textContent = info.label;
        button.addEventListener("click", () => selectSublevel(sublevel));
        sublevelChoices.appendChild(button);
        if (optionIndex === 0) selectSublevel(sublevel);
      });
    }

    function selectSublevel(sublevel) {
      sublevelInput.value = sublevel;
      [...sublevelChoices.querySelectorAll("[data-sampler-sublevel]")].forEach((button) => {
        button.classList.toggle("active", button.dataset.samplerSublevel === sublevel);
      });
    }

    function selectCategory(category) {
      categoryInput.value = category;
      categoryButtons.forEach((button) => button.classList.toggle("active", button.dataset.samplerCategory === category));
      renderSublevels(category);
    }

    function clearCurrentRecording() {
      currentBlob = null;
      currentMetrics = null;
      currentValidation = null;
      recordedChunks = [];
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = "";
      audio.hidden = true;
      audio.removeAttribute("src");
    }

    function renderCurrent() {
      const item = currentItem();
      if (!item) {
        finishSession();
        return;
      }
      const category = STRUCTURE[item.category];
      categoryLabel.textContent = category?.label || item.category;
      sublevelLabel.textContent = category?.sublevels?.[item.sublevel]?.label || item.sublevel;
      progress.textContent = `Muestra ${index + 1} de ${sequence.length}`;
      detail.textContent = `Repeticion ${item.repetition} de ${item.repetitions}`;
      targetText.textContent = item.displayText.toUpperCase();
      targetText.classList.toggle("sentence-target", item.category === "sentences");
      feedback.textContent = index > 0 && index % 30 === 0
        ? `Buen trabajo. Ya llevas ${index} grabaciones; puedes tomar un pequeno descanso.`
        : "Listo para grabar.";
      technical.textContent = "Sin grabacion.";
      clearCurrentRecording();
      setState("ready");
    }

    async function connectSessionMicrophone(forceReconnect = false) {
      if (!global.MediaRecorder) throw new Error("MediaRecorder no esta disponible en este navegador.");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no permite acceder al microfono.");
      if (isStreamUsable(sessionStream)) return sessionStream;
      if (sessionStream && !forceReconnect) throw new Error("Microfono desconectado. Usa Reconectar microfono para continuar.");
      if (sessionStream && forceReconnect) stopSessionStream(sessionStream);
      sessionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      watchSessionStream(sessionStream);
      setMicrophoneConnected();
      return sessionStream;
    }

    async function ensureSessionStream() {
      if (isStreamUsable(sessionStream)) return sessionStream;
      setMicrophoneDisconnected();
      throw new Error("Microfono desconectado. Usa Reconectar microfono para continuar.");
    }

    function waitForRecorderStop(activeRecorder) {
      return new Promise((resolve, reject) => {
        activeRecorder.ondataavailable = (event) => {
          if (event.data?.size) recordedChunks.push(event.data);
        };
        activeRecorder.onerror = (event) => reject(event.error || new Error("Error de MediaRecorder."));
        activeRecorder.onstop = () => resolve();
      });
    }

    async function startRecording() {
      try {
        const mediaStream = await ensureSessionStream();
        const mimeType = pickSupportedMimeType(global.MediaRecorder);
        recorder = new global.MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
        recordedChunks = [];
        stopPromise = waitForRecorderStop(recorder);
        currentStartedAt = performance.now();
        recorder.start();
        feedback.textContent = "Grabando...";
        setState("recording");
        global.setTimeout(() => {
          if (state === "recording" && recorder?.state === "recording") stopRecording();
        }, maxDurationForItem(currentItem()));
      } catch (error) {
        feedback.textContent = error.message || "No se pudo iniciar el microfono.";
      }
    }

    async function stopRecording() {
      if (!recorder || recorder.state !== "recording") return;
      setState("stopping");
      recorder.stop();
      try {
        await stopPromise;
        await finalizeRecording();
      } catch {
        currentValidation = { valid: false, reason: "recorder_failed", warnings: [] };
        feedback.textContent = "No fue posible generar correctamente la grabacion. Por favor, repitela.";
        setState("ready");
      }
    }

    async function finalizeRecording() {
      const mimeType = recorder?.mimeType || pickSupportedMimeType(global.MediaRecorder) || "audio/webm";
      currentBlob = new Blob(recordedChunks, { type: mimeType });
      const AudioContextCtor = global.AudioContext || global.webkitAudioContext;
      const audioContext = AudioContextCtor ? new AudioContextCtor() : null;
      currentMetrics = await calculateBlobMetrics(currentBlob, audioContext);
      await audioContext?.close?.();
      currentMetrics.durationMs = currentMetrics.durationMs || Math.max(0, performance.now() - currentStartedAt);
      currentMetrics.sizeBytes = currentBlob.size;
      currentValidation = validateRecordingBlob(currentBlob, mimeType, currentMetrics, currentItem());
      currentMetrics.warnings = currentValidation.warnings;
      if (currentValidation.valid) {
        currentObjectUrl = URL.createObjectURL(currentBlob);
        audio.src = currentObjectUrl;
        audio.hidden = false;
      }
      technical.textContent = JSON.stringify({ ...currentMetrics, validation: currentValidation }, null, 2);
      feedback.textContent = formatWarningMessage(currentValidation);
      setState(currentValidation.valid ? "recorded" : "ready");
    }

    function acceptCurrent() {
      if (!canAcceptRecording(state, currentBlob, currentValidation)) {
        feedback.textContent = "Primero graba una muestra valida.";
        return;
      }
      const item = currentItem();
      const file = makeRecordingFileName(index + 1, item, item.repetition, currentBlob.type);
      const warnings = currentValidation.warnings || [];
      acceptedRecordings.push({
        ...item,
        file,
        blob: currentBlob,
        mimeType: currentBlob.type || "audio/webm",
        sizeBytes: currentBlob.size,
        durationMs: currentMetrics?.durationMs || 0,
        warnings,
        validation: {
          tooShort: warnings.includes("recording_too_short"),
          tooQuiet: warnings.includes("volume_very_low"),
          clipping: warnings.includes("possible_saturation"),
        },
        recordedAt: new Date().toISOString(),
      });
      setState("accepted");
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
      if (state === "stopping") return;
      if (currentBlob) repeatedTakes += 1;
      clearCurrentRecording();
      feedback.textContent = "Toma descartada. Graba nuevamente el mismo objetivo.";
      setState("ready");
    }

    function summarizeWarnings() {
      const allWarnings = acceptedRecordings.flatMap((item) => item.warnings || []);
      return {
        tooQuiet: allWarnings.filter((warning) => warning === "volume_very_low").length,
        tooShort: allWarnings.filter((warning) => warning === "recording_too_short").length,
        clipping: allWarnings.filter((warning) => warning === "possible_saturation").length,
      };
    }

    async function finishSession() {
      setState("finished");
      stopSessionStream(sessionStream);
      sessionStream = null;
      micState.textContent = "Microfono liberado";
      reconnectBtn.hidden = true;
      const metadata = buildMetadata({ participant, session, sequence, acceptedRecordings, skippedItems, repeatedTakes });
      const files = [
        { name: "metadata.json", blob: new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" }) },
        ...acceptedRecordings.map((recording) => ({ name: recording.file, blob: recording.blob })),
      ];
      try {
        zipBlob = await createZipBlob(files);
        summary.textContent = JSON.stringify({
          sesion: "completada",
          categoria: STRUCTURE[metadata.session.category]?.label || metadata.session.category,
          subnivel: STRUCTURE[metadata.session.category]?.sublevels?.[metadata.session.sublevel]?.label || metadata.session.sublevel,
          planeadas: sequence.length,
          aceptadas: acceptedRecordings.length,
          omitidas: skippedItems.length,
          repetidas: repeatedTakes,
          advertencias: summarizeWarnings(),
          archivoZip: makeZipName(participant.id, session),
        }, null, 2);
        capturePanel.hidden = true;
        summaryPanel.hidden = false;
      } catch (error) {
        feedback.textContent = `Error al crear ZIP: ${error.message || error}`;
        setState("ready");
      }
    }

    categoryButtons.forEach((button) => {
      button.addEventListener("click", () => selectCategory(button.dataset.samplerCategory));
    });

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
        category: categoryInput.value,
        sublevel: sublevelInput.value,
        mode: modeInput.value,
        syllableRepetitions: normalizeRepetitions(doc.getElementById("syllable-repetitions").value, 3),
        itemRepetitions: 1,
        randomOrder: doc.getElementById("random-order").checked,
      };
      if (session.mode === "general") {
        session.category = "general";
        session.sublevel = "general";
      }
      try {
        await connectSessionMicrophone(false);
        sequence = buildRecordingSequence(session);
        setupPanel.hidden = true;
        capturePanel.hidden = false;
        index = 0;
        acceptedRecordings = [];
        skippedItems = [];
        repeatedTakes = 0;
        renderCurrent();
      } catch (error) {
        setupFeedback.textContent = error.message || "No se pudo acceder al microfono.";
      }
    });

    recordBtn.addEventListener("click", startRecording);
    stopBtn.addEventListener("click", stopRecording);
    playBtn.addEventListener("click", () => audio.play());
    retryBtn.addEventListener("click", retryCurrent);
    acceptBtn.addEventListener("click", acceptCurrent);
    skipBtn.addEventListener("click", skipCurrent);
    reconnectBtn.addEventListener("click", async () => {
      try {
        await connectSessionMicrophone(true);
        feedback.textContent = "Microfono reconectado. Puedes continuar.";
      } catch (error) {
        feedback.textContent = error.message || "No se pudo reconectar el microfono.";
      }
    });
    cancelBtn.addEventListener("click", () => {
      stopSessionStream(sessionStream);
      sessionStream = null;
      clearCurrentRecording();
      setupPanel.hidden = false;
      capturePanel.hidden = true;
      summaryPanel.hidden = true;
      micState.textContent = "Microfono liberado";
      reconnectBtn.hidden = true;
      setState("idle");
    });
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
      link.download = makeZipName(participant.id, session);
      link.click();
      URL.revokeObjectURL(url);
    });
    global.addEventListener?.("pagehide", () => {
      stopSessionStream(sessionStream);
      sessionStream = null;
    });
    selectCategory("syllables");
  }

  global.LectoVozVoiceSampler = {
    MIME_CANDIDATES,
    STRUCTURE,
    SUBLEVEL_CATEGORY,
    CONTENT_SUBLEVEL,
    CONTRAST_SYLLABLES,
    QUICK_LIMITS,
    GENERAL_LIMITS,
    getSamplerDataset,
    getOfficialItems,
    normalizeSamplerItem,
    buildRecordingSequence,
    sanitizeIdentifier,
    makeRecordingFileName,
    makeZipName,
    pickSupportedMimeType,
    minimumDurationForItem,
    validateAudioMetrics,
    validateRecordingBlob,
    canAcceptRecording,
    isStreamUsable,
    stopSessionStream,
    getMicrophoneStatus,
    requestSessionStream,
    calculateBlobMetrics,
    buildMetadata,
    createZipBlob,
  };

  if (global.document) {
    global.document.addEventListener("DOMContentLoaded", bootUI);
  }
})(typeof window !== "undefined" ? window : globalThis);
