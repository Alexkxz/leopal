(function initSpeechRecognitionModule(global) {
  function createSpeechController(options) {
    const win = options.window || global;
    const nav = options.navigator || global.navigator || {};
    const Recognition = options.recognitionCtor;
    const AudioContextCtor = global.AudioContext || global.webkitAudioContext;

    let recognition;
    let recognitionActive = false;
    let micStream;
    let audioContext;
    let analyser;
    let animationFrameId;
    let audioSource;
    let restartTimer;
    let startingPromise;
    let noiseFloor = 0.025;
    let currentVolume = 0;
    let state = "idle";
    let audioReady = false;
    let listening = false;
    let userStopped = false;
    let fatalError = false;

    async function start() {
      if (!options.getCurrentSession()) {
        options.onMissingSession();
        return;
      }

      if (!Recognition) {
        state = "error";
        options.setFeedback("Este navegador no soporta reconocimiento de voz. Usa Chrome o Edge.");
        options.setStartLabel("Permitir microfono y comenzar");
        return;
      }

      if (state === "requesting-permission" && startingPromise) return startingPromise;
      if (listening && recognitionActive) return;

      userStopped = false;
      fatalError = false;
      startingPromise = startSession();
      await startingPromise;
      startingPromise = undefined;
    }

    async function startSession() {
      try {
        await prepareAudioSession();
      } catch (error) {
        listening = false;
        fatalError = true;
        state = "error";
        clearRestartTimer();
        options.setStatus("Microfono detenido", false);
        options.setStartLabel("Permitir microfono y comenzar");
        options.setFeedback(getMicrophoneErrorMessage(error));
        return;
      }

      ensureRecognition();
      startRecognition();
      options.setFeedback(`Lee ahora: ${options.getCurrentChunk()}`);
    }

    function stop(updateText = true) {
      userStopped = true;
      listening = false;
      clearRestartTimer();
      stopRecognition();
      state = micStream ? "ready" : "stopped";
      options.setStatus(micStream ? "Microfono listo" : "Microfono detenido", false);
      options.setStartLabel(micStream ? "Continuar lectura" : "Permitir microfono y comenzar");
      if (updateText) options.setFeedback("Lectura pausada.");
    }

    function close(updateText = true) {
      userStopped = true;
      fatalError = true;
      listening = false;
      clearRestartTimer();
      stopRecognition();
      releaseMicrophone();
      state = "stopped";
      options.setStatus("Microfono detenido", false);
      options.setStartLabel("Permitir microfono y comenzar");
      if (updateText) options.setFeedback("Lectura pausada.");
    }

    async function prepareAudioSession() {
      if (micStream) {
        audioReady = true;
        return;
      }

      if (!nav.mediaDevices?.getUserMedia) {
        const error = new Error("Microphone unavailable");
        error.code = "microphone-unavailable";
        throw error;
      }

      state = "requesting-permission";
      options.setStatus("Solicitando microfono", false);
      options.setStartLabel("Solicitando permiso...");
      micStream = await nav.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      try {
        await prepareAudioMonitor();
      } catch {
        options.setNoiseLevel(0);
        options.setVoiceLevel(0);
      }
      audioReady = true;
      state = "ready";
      options.setStatus("Microfono listo", false);
      options.setStartLabel("Comenzar lectura");
    }

    async function prepareAudioMonitor() {
      if (!AudioContextCtor || audioSource) return;

      audioContext = audioContext || new AudioContextCtor();
      if (audioContext.state === "suspended") await audioContext.resume();

      const makeFilter = (type, frequency, q, gain) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        filter.Q.value = q;
        if (gain !== undefined) filter.gain.value = gain;
        return filter;
      };

      const highPass = makeFilter("highpass", 80, 0.7);
      const lowPass = makeFilter("lowpass", 8000, 0.7);
      const presenceBoost = makeFilter("peaking", 2500, 1, 5);
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -28;
      compressor.knee.value = 14;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.14;

      const gain = audioContext.createGain();
      gain.gain.value = 2.2;

      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.58;

      audioSource = audioContext.createMediaStreamSource(micStream);
      audioSource.connect(highPass);
      highPass.connect(lowPass);
      lowPass.connect(presenceBoost);
      presenceBoost.connect(compressor);
      compressor.connect(gain);
      gain.connect(analyser);

      options.setStatus("Calibrando ruido", false);
      options.setFeedback("Guarda silencio un momento para medir el ruido del salon.");
      await calibrateNoise();
      startAudioMeter();
    }

    function ensureRecognition() {
      if (recognition) return;

      recognition = new Recognition();
      recognition.lang = "es-MX";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;

      recognition.onresult = (event) => {
        let transcript = "";
        let confidence = 0;
        let isFinal = false;
        const alternatives = [];

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          transcript += result[0].transcript;
          confidence = Math.max(confidence, result[0].confidence || 0);
          isFinal = isFinal || result.isFinal;

          for (let altIndex = 0; altIndex < result.length; altIndex += 1) {
            alternatives.push(result[altIndex].transcript);
          }
        }
        options.processTranscript(transcript, confidence, isFinal, alternatives);
      };

      recognition.onerror = (event) => {
        if (event.error === "no-speech") {
          options.setFeedback("Sigo escuchando. Habla normal, cerca del microfono.");
          return;
        }

        if (event.error === "aborted") return;

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          fatalError = true;
          listening = false;
          state = "error";
          clearRestartTimer();
          releaseMicrophone();
          options.setFeedback("Necesitamos el microfono para escuchar tu lectura.");
          options.setStatus("Microfono detenido", false);
          options.setStartLabel("Permitir microfono y comenzar");
          return;
        }

        if (event.error === "audio-capture") {
          fatalError = true;
          listening = false;
          state = "error";
          clearRestartTimer();
          releaseMicrophone();
          options.setFeedback("El microfono no esta disponible en este momento.");
          options.setStatus("Microfono detenido", false);
          options.setStartLabel("Permitir microfono y comenzar");
          return;
        }

        state = "restarting";
        options.setFeedback(`No pude escuchar bien: ${event.error}`);
        options.setStatus("Reintentando microfono", true);
      };

      recognition.onend = () => {
        recognitionActive = false;
        if (shouldRestartRecognition()) scheduleRestart();
      };
    }

    function startRecognition() {
      if (recognitionActive || fatalError) return;

      listening = true;
      clearRestartTimer();
      try {
        recognition.start();
        recognitionActive = true;
      } catch (error) {
        if (error.name !== "InvalidStateError") throw error;
        recognitionActive = true;
      }
      state = "listening";
      options.setStatus("Escuchando", true);
      options.setStartLabel("Escuchando...");
    }

    function stopRecognition() {
      if (!recognition || !recognitionActive) return;

      try {
        recognition.stop();
      } catch (error) {
        if (error.name !== "InvalidStateError") throw error;
      }
      recognitionActive = false;
    }

    function shouldRestartRecognition() {
      return Boolean(
        listening
        && !userStopped
        && !fatalError
        && micStream
        && options.getCurrentSession()
      );
    }

    function scheduleRestart() {
      if (restartTimer) return;
      state = "restarting";
      options.setStatus("Reintentando microfono", true);
      restartTimer = win.setTimeout(() => {
        restartTimer = undefined;
        if (!shouldRestartRecognition()) return;
        startRecognition();
      }, 180);
    }

    function clearRestartTimer() {
      if (!restartTimer) return;
      win.clearTimeout?.(restartTimer);
      restartTimer = undefined;
    }

    function releaseMicrophone() {
      if (animationFrameId) {
        win.cancelAnimationFrame(animationFrameId);
        animationFrameId = undefined;
      }

      if (audioSource) {
        audioSource.disconnect();
        audioSource = undefined;
      }

      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
        micStream = undefined;
      }

      recognition = undefined;
      recognitionActive = false;
      analyser = undefined;
      currentVolume = 0;
      audioReady = false;
      options.setVoiceLevel(0);
    }

    async function calibrateNoise() {
      const samples = [];
      const startedAt = getNow();

      while (getNow() - startedAt < 1100) {
        samples.push(readVolume());
        await new Promise((resolve) => win.setTimeout(resolve, 70));
      }

      const average = samples.reduce((sum, value) => sum + value, 0) / Math.max(samples.length, 1);
      noiseFloor = Math.max(0.006, average * 1.2);
      options.setNoiseLevel(Math.min(100, Math.round(noiseFloor * 650)));
    }

    function startAudioMeter() {
      if (animationFrameId) return;

      const tick = () => {
        currentVolume = readVolume();
        options.setVoiceLevel(Math.min(100, Math.round(currentVolume * 650)));
        options.setNoiseLevel(Math.min(100, Math.round(noiseFloor * 650)));
        animationFrameId = win.requestAnimationFrame(tick);
      };
      tick();
    }

    function readVolume() {
      if (!analyser) return 0;

      const data = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(data);

      let sum = 0;
      for (const value of data) {
        const centered = (value - 128) / 128;
        sum += centered * centered;
      }

      return Math.sqrt(sum / data.length);
    }

    function getNow() {
      return global.performance?.now ? global.performance.now() : Date.now();
    }

    function getMicrophoneErrorMessage(error) {
      if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
        return "Necesitamos el microfono para escuchar tu lectura.";
      }
      if (error?.code === "microphone-unavailable" || error?.name === "NotFoundError") {
        return "El microfono no esta disponible en este momento.";
      }
      return "Necesitamos el microfono para escuchar tu lectura.";
    }

    function isVoiceActive() {
      return currentVolume > noiseFloor + 0.002;
    }

    return {
      start,
      stop,
      close,
      getState: () => state,
      isListening: () => listening,
      isAudioReady: () => audioReady,
      isVoiceActive,
      readVolume,
    };
  }

  global.LectoVozSpeech = {
    createSpeechController,
  };
})(typeof window !== "undefined" ? window : globalThis);
