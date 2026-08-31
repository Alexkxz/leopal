(function initOfflineAudioAnalyzer(global) {
  const GATES_MS = [80, 100, 120, 150, 180];
  const AUDIO_EXTENSIONS = [".webm", ".wav", ".mp3", ".m4a", ".ogg"];

  function round(value, digits = 3) {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function average(values) {
    const numeric = values.filter(Number.isFinite);
    return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : 0;
  }

  function percentile(values, pct) {
    const numeric = values.filter(Number.isFinite).sort((left, right) => left - right);
    if (!numeric.length) return 0;
    const rank = (numeric.length - 1) * pct;
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    if (lower === upper) return numeric[lower];
    return numeric[lower] + ((numeric[upper] - numeric[lower]) * (rank - lower));
  }

  function median(values) {
    return percentile(values, 0.5);
  }

  function standardDeviation(values) {
    const numeric = values.filter(Number.isFinite);
    if (numeric.length < 2) return 0;
    const mean = average(numeric);
    return Math.sqrt(average(numeric.map((value) => (value - mean) ** 2)));
  }

  function normalizeComparable(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function getExtension(path) {
    const match = String(path || "").toLowerCase().match(/\.[^.\/\\]+$/);
    return match ? match[0] : "";
  }

  function isAudioPath(path) {
    return AUDIO_EXTENSIONS.includes(getExtension(path));
  }

  function inferStudentFromZipName(zipName) {
    const clean = String(zipName || "").replace(/\.zip$/i, "");
    const parts = clean.split("_").filter(Boolean);
    if (parts.length >= 3 && /^leopal/i.test(parts[0])) return parts[2].replace(/\s*\(\d+\)\s*$/, "");
    return clean;
  }

  function getStudentName(metadata, zipName) {
    return metadata?.alumno?.nombre || metadata?.student?.name || inferStudentFromZipName(zipName);
  }

  function getRecordingMetadata(metadata) {
    return Array.isArray(metadata?.grabaciones) ? metadata.grabaciones : [];
  }

  function matchRecordingMetadata(metadata, entryName) {
    const fileName = String(entryName || "").split(/[\\/]/).pop();
    return getRecordingMetadata(metadata).find((item) => item.archivo === fileName || item.file === fileName) || {};
  }

  function makeDatasetId(zipName, metadata) {
    const student = normalizeComparable(getStudentName(metadata, zipName)).replace(/\s+/g, "-") || "dataset";
    const zipBase = String(zipName || "zip").replace(/\.zip$/i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return `${student}:${zipBase}`;
  }

  function collectDatasetInfo(zipRecords) {
    const students = new Set();
    const expectedWords = new Set();
    const repetitions = new Set();
    let audioFiles = 0;
    let metadataValid = 0;
    let metadataMissing = 0;

    zipRecords.forEach((record) => {
      const metadata = record.metadata || null;
      if (metadata) metadataValid += 1;
      else metadataMissing += 1;
      students.add(makeDatasetId(record.zipName, metadata));
      record.audioEntries.forEach((entry) => {
        audioFiles += 1;
        const meta = matchRecordingMetadata(metadata, entry.name);
        const word = meta.palabra_objetivo || meta.palabra || meta.expected || meta.word;
        if (word) expectedWords.add(normalizeComparable(word));
        const repetition = meta.repeticion || meta.repetition;
        if (repetition !== undefined) repetitions.add(String(repetition));
      });
    });

    return {
      zipFiles: zipRecords.length,
      students: students.size,
      audioFiles,
      validAudioFiles: 0,
      invalidAudioFiles: 0,
      metadataValid,
      metadataMissing,
      repetitions: repetitions.size,
      uniqueExpectedWords: expectedWords.size,
    };
  }

  function flattenAudioBuffer(audioBuffer) {
    const length = audioBuffer.length;
    const channels = audioBuffer.numberOfChannels || 1;
    const samples = new Float32Array(length);
    for (let channel = 0; channel < channels; channel += 1) {
      const data = audioBuffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) samples[index] += data[index] / channels;
    }
    return samples;
  }

  function rms(values, start = 0, end = values.length) {
    if (end <= start) return 0;
    let sum = 0;
    for (let index = start; index < end; index += 1) sum += values[index] * values[index];
    return Math.sqrt(sum / (end - start));
  }

  function analyzeSamples(samples, sampleRate) {
    const frameSize = Math.max(1, Math.round(sampleRate * 0.01));
    const frameMs = (frameSize / sampleRate) * 1000;
    const frames = [];
    let peakVolume = 0;
    for (let index = 0; index < samples.length; index += 1) {
      peakVolume = Math.max(peakVolume, Math.abs(samples[index]));
    }
    for (let start = 0; start < samples.length; start += frameSize) {
      frames.push(rms(samples, start, Math.min(samples.length, start + frameSize)));
    }

    const fullRms = rms(samples);
    const noiseFloor = Math.max(0.000001, percentile(frames, 0.2) * 1.25);
    const voiceStartThreshold = noiseFloor + Math.max(0.0035, noiseFloor * 0.5);
    const voiceStopThreshold = noiseFloor + Math.max(0.0018, noiseFloor * 0.24);
    let active = false;
    let voiceDurationMs = 0;
    let voiceStartedAtMs = null;
    let voiceEnergy = 0;
    let voiceFrames = 0;

    frames.forEach((frameRms, frameIndex) => {
      active = active ? frameRms >= voiceStopThreshold : frameRms > voiceStartThreshold;
      if (active) {
        if (voiceStartedAtMs === null) voiceStartedAtMs = frameIndex * frameMs;
        voiceDurationMs += frameMs;
        voiceEnergy += frameRms;
        voiceFrames += 1;
      }
    });

    const voiceRms = voiceFrames ? voiceEnergy / voiceFrames : 0;
    const snr = noiseFloor > 0 ? voiceRms / noiseFloor : 0;
    const snrDb = snr > 0 ? 20 * Math.log10(snr) : -Infinity;

    return {
      durationMs: (samples.length / sampleRate) * 1000,
      voiceDurationMs,
      rms: fullRms,
      noiseFloor,
      snr,
      snrDb,
      peakVolume,
      voiceAttackMs: voiceStartedAtMs,
      voiceStartThreshold,
      voiceStopThreshold,
    };
  }

  function analyzeAudioBuffer(audioBuffer) {
    const samples = flattenAudioBuffer(audioBuffer);
    const metrics = analyzeSamples(samples, audioBuffer.sampleRate);
    return {
      ...metrics,
      gates: GATES_MS.reduce((result, gate) => {
        result[gate] = metrics.voiceDurationMs >= gate;
        return result;
      }, {}),
    };
  }

  function detectOutlierReasons(metric, context = {}) {
    const reasons = [];
    if (!metric || metric.decodeFailed) reasons.push("possible_empty_or_corrupt_file");
    if (metric?.durationMs !== undefined && metric.durationMs < 120) reasons.push("extremely_short_recording");
    if (metric?.durationMs !== undefined && metric.durationMs > 12000) reasons.push("extremely_long_recording");
    if (metric?.voiceDurationMs !== undefined && metric.voiceDurationMs < 60) reasons.push("extremely_short_voice");
    if (metric?.rms !== undefined && metric.rms < 0.003) reasons.push("too_silent");
    if (metric?.peakVolume !== undefined && metric.peakVolume >= 0.98) reasons.push("saturated");
    if (metric?.snr !== undefined && metric.snr < 1.8) reasons.push("very_low_snr");
    if (metric?.noiseFloor !== undefined && context.noiseP75 && metric.noiseFloor > context.noiseP75 * 2) reasons.push("high_noise_floor");
    if (metric?.voiceDurationMs !== undefined && context.voiceP75 && context.voiceP25) {
      const iqr = context.voiceP75 - context.voiceP25;
      if (iqr > 0 && metric.voiceDurationMs > context.voiceP75 + (iqr * 1.5)) reasons.push("extremely_long_voice");
    }
    return [...new Set(reasons)];
  }

  function attachOutliers(attempts) {
    const context = {
      noiseP75: percentile(attempts.map((item) => item.noiseFloor), 0.75),
      voiceP25: percentile(attempts.map((item) => item.voiceDurationMs), 0.25),
      voiceP75: percentile(attempts.map((item) => item.voiceDurationMs), 0.75),
    };
    return attempts.map((attempt) => {
      const outlierReasons = detectOutlierReasons(attempt, context);
      return {
        ...attempt,
        outlierReasons,
        isTechnicalOutlier: outlierReasons.some((reason) => [
          "possible_empty_or_corrupt_file",
          "too_silent",
          "saturated",
          "very_low_snr",
          "extremely_short_recording",
        ].includes(reason)),
      };
    });
  }

  function gateRates(attempts) {
    return GATES_MS.reduce((result, gate) => {
      const accepted = attempts.filter((attempt) => attempt.voiceDurationMs >= gate).length;
      result[gate] = {
        accepted,
        rejected: attempts.length - accepted,
        acceptanceRate: attempts.length ? accepted / attempts.length : 0,
        rejectionRate: attempts.length ? 1 - (accepted / attempts.length) : 0,
      };
      return result;
    }, {});
  }

  function summarizeAttempts(attempts) {
    const voiceDurations = attempts.map((attempt) => attempt.voiceDurationMs);
    return {
      audioFiles: attempts.length,
      meanVoiceDurationMs: average(voiceDurations),
      medianVoiceDurationMs: median(voiceDurations),
      p10VoiceDurationMs: percentile(voiceDurations, 0.1),
      p25VoiceDurationMs: percentile(voiceDurations, 0.25),
      p50VoiceDurationMs: percentile(voiceDurations, 0.5),
      p75VoiceDurationMs: percentile(voiceDurations, 0.75),
      rms: average(attempts.map((attempt) => attempt.rms)),
      noiseFloor: average(attempts.map((attempt) => attempt.noiseFloor)),
      snr: average(attempts.map((attempt) => attempt.snr)),
      snrDb: average(attempts.map((attempt) => attempt.snrDb).filter(Number.isFinite)),
      voiceAttackMs: average(attempts.map((attempt) => attempt.voiceAttackMs).filter(Number.isFinite)),
      gates: gateRates(attempts),
    };
  }

  function groupByStudent(attempts) {
    return attempts.reduce((groups, attempt) => {
      const key = attempt.datasetId || attempt.studentName || "dataset";
      if (!groups[key]) groups[key] = [];
      groups[key].push(attempt);
      return groups;
    }, {});
  }

  function summarizeByStudent(attempts) {
    const groups = groupByStudent(attempts);
    return Object.fromEntries(Object.entries(groups).map(([datasetId, records]) => [datasetId, {
      datasetId,
      studentName: records[0]?.studentName || datasetId,
      zipName: records[0]?.zipName || "",
      ...summarizeAttempts(records),
    }]));
  }

  function compareStudents(studentSummaries) {
    const rows = Object.values(studentSummaries);
    const sortedByMedian = rows.slice().sort((left, right) => left.medianVoiceDurationMs - right.medianVoiceDurationMs);
    const gateComparison = GATES_MS.reduce((result, gate) => {
      const sorted = rows.slice().sort((left, right) => left.gates[gate].acceptanceRate - right.gates[gate].acceptanceRate);
      result[gate] = {
        worstStudent: sorted[0]?.studentName || "",
        minimumAcceptanceRate: sorted[0]?.gates[gate].acceptanceRate || 0,
        maximumStudentRejectionRate: sorted[0]?.gates[gate].rejectionRate || 0,
        acceptanceP10: percentile(rows.map((row) => row.gates[gate].acceptanceRate), 0.1),
      };
      return result;
    }, {});

    return {
      lowestMedianVoiceStudent: sortedByMedian[0]?.studentName || "",
      highestMedianVoiceStudent: sortedByMedian[sortedByMedian.length - 1]?.studentName || "",
      medianVoiceDurationStdDev: standardDeviation(rows.map((row) => row.medianVoiceDurationMs)),
      volumeDistribution: {
        p10: percentile(rows.map((row) => row.rms), 0.1),
        p50: percentile(rows.map((row) => row.rms), 0.5),
        p90: percentile(rows.map((row) => row.rms), 0.9),
      },
      snrDistribution: {
        p10: percentile(rows.map((row) => row.snr), 0.1),
        p50: percentile(rows.map((row) => row.snr), 0.5),
        p90: percentile(rows.map((row) => row.snr), 0.9),
      },
      gateComparison,
    };
  }

  function summarizeGates(attempts, studentSummaries) {
    return GATES_MS.map((gate) => {
      const globalRate = gateRates(attempts)[gate];
      const comparison = compareStudents(studentSummaries).gateComparison[gate];
      return {
        gate,
        globalAcceptanceRate: globalRate.acceptanceRate,
        globalRejectionRate: globalRate.rejectionRate,
        worstStudent: comparison.worstStudent,
        minimumStudentAcceptanceRate: comparison.minimumAcceptanceRate,
        maximumStudentRejectionRate: comparison.maximumStudentRejectionRate,
        studentAcceptanceP10: comparison.acceptanceP10,
      };
    });
  }

  function recommendGate(gateResults) {
    if (!gateResults.length) return { gate: null, reason: "no_valid_audio" };
    const eligible = gateResults.filter((row) => row.minimumStudentAcceptanceRate >= 0.9 && row.globalAcceptanceRate >= 0.95);
    const candidates = eligible.length ? eligible : gateResults;
    const sorted = candidates.slice().sort((left, right) => (
      right.minimumStudentAcceptanceRate - left.minimumStudentAcceptanceRate
      || right.globalAcceptanceRate - left.globalAcceptanceRate
      || right.gate - left.gate
    ));
    const best = sorted[0];
    return {
      gate: best.gate,
      reason: eligible.length
        ? "best_gate_preserving_high_global_and_worst_student_acceptance"
        : "best_available_gate_by_worst_student_acceptance",
      globalAcceptanceRate: best.globalAcceptanceRate,
      minimumStudentAcceptanceRate: best.minimumStudentAcceptanceRate,
      worstStudent: best.worstStudent,
    };
  }

  function buildAnalysis(attempts, datasetInfo, failedAudioFiles = []) {
    const withOutliers = attachOutliers(attempts);
    const withoutTechnicalOutliers = withOutliers.filter((attempt) => !attempt.isTechnicalOutlier);
    const byStudent = summarizeByStudent(withOutliers);
    const byStudentWithoutOutliers = summarizeByStudent(withoutTechnicalOutliers);
    const gateResults = summarizeGates(withOutliers, byStudent);
    const gateResultsWithoutOutliers = summarizeGates(withoutTechnicalOutliers, byStudentWithoutOutliers);
    const outliers = withOutliers.filter((attempt) => attempt.outlierReasons.length);
    return {
      format: "lectovoz-offline-audio-analysis",
      version: 1,
      createdAt: new Date().toISOString(),
      dataset: {
        ...datasetInfo,
        validAudioFiles: withOutliers.length,
        invalidAudioFiles: failedAudioFiles.length,
      },
      byStudent,
      global: summarizeAttempts(withOutliers),
      betweenStudents: compareStudents(byStudent),
      gates: gateResults,
      outliers,
      failedAudioFiles,
      excludingTechnicalOutliers: {
        dataset: {
          ...datasetInfo,
          validAudioFiles: withoutTechnicalOutliers.length,
          invalidAudioFiles: failedAudioFiles.length,
          excludedTechnicalOutliers: withOutliers.length - withoutTechnicalOutliers.length,
        },
        byStudent: byStudentWithoutOutliers,
        global: summarizeAttempts(withoutTechnicalOutliers),
        betweenStudents: compareStudents(byStudentWithoutOutliers),
        gates: gateResultsWithoutOutliers,
        recommendation: recommendGate(gateResultsWithoutOutliers),
      },
      recommendation: recommendGate(gateResults),
    };
  }

  async function inflateEntry(bytes, compressionMethod) {
    if (compressionMethod === 0) return bytes;
    if (compressionMethod !== 8) throw new Error(`Unsupported ZIP compression method ${compressionMethod}`);
    if (typeof DecompressionStream === "undefined") {
      throw new Error("DecompressionStream is unavailable in this browser");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function decodeName(bytes, utf8) {
    const decoder = new TextDecoder(utf8 ? "utf-8" : "utf-8");
    return decoder.decode(bytes);
  }

  function findEndOfCentralDirectory(view) {
    for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) return offset;
    }
    throw new Error("Invalid ZIP: EOCD not found");
  }

  async function readZipEntries(file) {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const eocd = findEndOfCentralDirectory(view);
    const totalEntries = view.getUint16(eocd + 10, true);
    const centralOffset = view.getUint32(eocd + 16, true);
    let offset = centralOffset;
    const entries = [];

    for (let index = 0; index < totalEntries; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("Invalid ZIP central directory");
      const flags = view.getUint16(offset + 8, true);
      const compressionMethod = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);
      const nameBytes = new Uint8Array(buffer, offset + 46, nameLength);
      const name = decodeName(nameBytes, Boolean(flags & 0x0800));
      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      entries.push({
        name,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        getData: async () => inflateEntry(new Uint8Array(buffer, dataOffset, compressedSize), compressionMethod),
      });
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  function buildAudioRecord(zipName, metadata, entry, metrics) {
    const item = matchRecordingMetadata(metadata, entry.name);
    return {
      zipName,
      datasetId: makeDatasetId(zipName, metadata),
      studentName: getStudentName(metadata, zipName),
      fileName: entry.name,
      expected: item.palabra_objetivo || item.palabra || item.expected || "",
      spokenLabel: item.palabra || "",
      category: item.categoria || item.category || "",
      repetition: item.repeticion || item.repetition || null,
      mode: item.modo || item.mode || "",
      sourceSnr: Number.isFinite(Number(item.snr)) ? Number(item.snr) : null,
      sizeBytes: entry.uncompressedSize,
      ...metrics,
    };
  }

  async function analyzeZipFile(file, audioContext, onProgress, counters) {
    const entries = await readZipEntries(file);
    const metadataEntry = entries.find((entry) => /(^|\/)metadata\.json$/i.test(entry.name));
    let metadata = null;
    let metadataError = "";
    if (metadataEntry) {
      try {
        metadata = JSON.parse(new TextDecoder().decode(await metadataEntry.getData()));
      } catch (error) {
        metadataError = error.message || String(error);
      }
    }
    const audioEntries = entries.filter((entry) => isAudioPath(entry.name));
    const record = { zipName: file.name, metadata, metadataError, audioEntries };
    const attempts = [];
    const failed = [];

    for (const entry of audioEntries) {
      counters.processed += 1;
      onProgress?.({ ...counters, zipName: file.name, fileName: entry.name });
      try {
        const bytes = await entry.getData();
        const audioBuffer = await audioContext.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        const metrics = analyzeAudioBuffer(audioBuffer);
        attempts.push(buildAudioRecord(file.name, metadata, entry, metrics));
      } catch (error) {
        failed.push({
          zipName: file.name,
          fileName: entry.name,
          reason: error.message || String(error),
        });
      }
      await new Promise((resolve) => global.setTimeout(resolve, 0));
    }

    return { record, attempts, failed };
  }

  async function inspectZipFile(file) {
    const entries = await readZipEntries(file);
    const metadataEntry = entries.find((entry) => /(^|\/)metadata\.json$/i.test(entry.name));
    let metadata = null;
    let metadataError = "";
    if (metadataEntry) {
      try {
        metadata = JSON.parse(new TextDecoder().decode(await metadataEntry.getData()));
      } catch (error) {
        metadataError = error.message || String(error);
      }
    }
    return {
      zipName: file.name,
      metadata,
      metadataError,
      audioEntries: entries
        .filter((entry) => isAudioPath(entry.name))
        .map((entry) => ({
          name: entry.name,
          uncompressedSize: entry.uncompressedSize,
          compressedSize: entry.compressedSize,
        })),
    };
  }

  function selectZipFiles(fileList) {
    return Array.from(fileList || []).filter((file) => /\.zip$/i.test(file.name || file.webkitRelativePath || ""));
  }

  async function analyzeZipFiles(files, options = {}) {
    const zipFiles = selectZipFiles(files);
    const AudioContextCtor = global.AudioContext || global.webkitAudioContext;
    if (!AudioContextCtor) throw new Error("AudioContext is unavailable");
    const audioContext = new AudioContextCtor();
    const zipRecords = [];
    const attempts = [];
    const failed = [];
    const counters = {
      processed: 0,
      total: 0,
      zipFiles: zipFiles.length,
    };

    for (const file of zipFiles) {
      const inspected = await inspectZipFile(file);
      counters.total += inspected.audioEntries.length;
      zipRecords.push(inspected);
    }

    const datasetInfo = collectDatasetInfo(zipRecords);
    zipRecords.length = 0;

    for (const file of zipFiles) {
      const result = await analyzeZipFile(file, audioContext, options.onProgress, counters);
      zipRecords.push(result.record);
      attempts.push(...result.attempts);
      failed.push(...result.failed);
      options.onZipComplete?.(result);
    }

    await audioContext.close?.();
    const refreshedDatasetInfo = collectDatasetInfo(zipRecords);
    return buildAnalysis(attempts, refreshedDatasetInfo.audioFiles ? refreshedDatasetInfo : datasetInfo, failed);
  }

  function downloadJson(payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lectovoz-offline-audio-analysis-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function bootUI() {
    if (!global.document) return;
    const doc = global.document;
    const input = doc.getElementById("dataset-input");
    const runButton = doc.getElementById("run-analysis");
    const exportButton = doc.getElementById("export-analysis");
    const progress = doc.getElementById("progress-text");
    const dataset = doc.getElementById("dataset-summary");
    const gatesBody = doc.getElementById("gates-body");
    const studentsBody = doc.getElementById("students-body");
    const outliersBody = doc.getElementById("outliers-body");
    const recommendation = doc.getElementById("recommendation");
    let lastAnalysis = null;

    function pct(value) {
      return `${round(value * 100, 1)}%`;
    }

    function renderAnalysis(analysis) {
      dataset.textContent = JSON.stringify(analysis.dataset, null, 2);
      gatesBody.innerHTML = analysis.gates.map((row) => `
        <tr>
          <td>${row.gate} ms</td>
          <td>${pct(row.globalAcceptanceRate)}</td>
          <td>${pct(row.globalRejectionRate)}</td>
          <td>${row.worstStudent}</td>
          <td>${pct(row.minimumStudentAcceptanceRate)}</td>
        </tr>
      `).join("");
      studentsBody.innerHTML = Object.values(analysis.byStudent).map((row) => `
        <tr>
          <td>${row.studentName}</td>
          <td>${row.audioFiles}</td>
          <td>${Math.round(row.medianVoiceDurationMs)} ms</td>
          <td>${round(row.rms, 4)}</td>
          <td>${round(row.noiseFloor, 4)}</td>
          <td>${round(row.snr, 2)}</td>
          <td>${GATES_MS.map((gate) => `${gate}:${pct(row.gates[gate].acceptanceRate)}`).join(" ")}</td>
        </tr>
      `).join("");
      outliersBody.innerHTML = analysis.outliers.slice(0, 200).map((row) => `
        <tr>
          <td>${row.studentName}</td>
          <td>${row.fileName}</td>
          <td>${Math.round(row.voiceDurationMs)} ms</td>
          <td>${round(row.snr, 2)}</td>
          <td>${row.outlierReasons.join(", ")}</td>
        </tr>
      `).join("");
      recommendation.textContent = JSON.stringify(analysis.recommendation, null, 2);
      exportButton.disabled = false;
    }

    runButton.addEventListener("click", async () => {
      const files = selectZipFiles(input.files);
      if (!files.length) {
        progress.textContent = "Selecciona la carpeta Muestras/ o los ZIP a analizar.";
        return;
      }
      runButton.disabled = true;
      exportButton.disabled = true;
      progress.textContent = `Preparando ${files.length} ZIP...`;
      try {
        lastAnalysis = await analyzeZipFiles(files, {
          onProgress: (state) => {
            progress.textContent = `Procesando ${state.processed} / ${state.total} audios (${state.zipName})`;
          },
        });
        progress.textContent = `Listo: ${lastAnalysis.dataset.validAudioFiles} audios analizados, ${lastAnalysis.dataset.invalidAudioFiles} fallidos.`;
        renderAnalysis(lastAnalysis);
      } catch (error) {
        progress.textContent = `Error: ${error.message || error}`;
      } finally {
        runButton.disabled = false;
      }
    });

    exportButton.addEventListener("click", () => {
      if (lastAnalysis) downloadJson(lastAnalysis);
    });
  }

  global.LectoVozOfflineAudioAnalyzer = {
    GATES_MS,
    AUDIO_EXTENSIONS,
    round,
    average,
    percentile,
    median,
    standardDeviation,
    normalizeComparable,
    isAudioPath,
    inferStudentFromZipName,
    getStudentName,
    matchRecordingMetadata,
    makeDatasetId,
    collectDatasetInfo,
    analyzeSamples,
    analyzeAudioBuffer,
    detectOutlierReasons,
    attachOutliers,
    gateRates,
    summarizeAttempts,
    summarizeByStudent,
    compareStudents,
    summarizeGates,
    recommendGate,
    buildAnalysis,
    selectZipFiles,
    readZipEntries,
    inspectZipFile,
    analyzeZipFiles,
  };

  if (global.document) {
    global.document.addEventListener("DOMContentLoaded", bootUI);
  }
})(typeof window !== "undefined" ? window : globalThis);
