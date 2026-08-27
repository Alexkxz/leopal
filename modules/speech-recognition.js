(function initSpeechRecognitionModule(global) {
  function createSpeechController(options) {
    const win = options.window || global;
    const nav = options.navigator || global.navigator || {};
    const Recognition = options.recognitionCtor;
    const AudioContextCtor = global.AudioContext || global.webkitAudioContext;

    let recognition;
    let listening = false;
    let audioContext;
    let analyser;
    let micStream;
    let animationFrameId;
    let audioSource;
    let noiseFloor = 0.025;
    let currentVolume = 0;
    let audioReady = false;

    async function start() {
      if (!options.getCurrentSession()) {
        options.onMissingSession();
        return;
      }

      if (!Recognition) {
        options.setFeedback("Este navegador no soporta reconocimiento de voz. Usa Chrome o Edge.");
        return;
      }

      await prepareAudioMonitor();
      ensureRecognition();

      listening = true;
      try {
        recognition.start();
      } catch (error) {
        if (error.name !== "InvalidStateError") throw error;
      }
      options.setStatus("Escuchando", true);
      options.setStartLabel("Pausar");
      options.setFeedback(`Lee ahora: ${options.getCurrentChunk()}`);
    }

    function stop(updateText = true) {
      listening = false;
      if (recognition) recognition.stop();
      stopAudioMonitor();
      options.setStatus("Microfono detenido", false);
      options.setStartLabel("Iniciar lectura");
      if (updateText) options.setFeedback("Lectura pausada.");
    }

    function ensureRecognition() {
      if (recognition) return;

      recognition = new Recognition();
      recognition.lang = "es-MX";
      recognition.continuous = false;
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

        options.setFeedback(`No pude escuchar bien: ${event.error}`);
        options.setStatus("Reintentando microfono", true);
      };

      recognition.onend = () => {
        if (listening) {
          win.setTimeout(() => {
            if (!listening) return;
            try {
              recognition.start();
            } catch (error) {
              if (error.name !== "InvalidStateError") throw error;
            }
          }, 180);
        }
      };
    }

    async function prepareAudioMonitor() {
      if (!nav.mediaDevices?.getUserMedia || !AudioContextCtor) {
        audioReady = false;
        return;
      }

      if (!micStream) {
        micStream = await nav.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
      }

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
      audioReady = true;
    }

    async function calibrateNoise() {
      const samples = [];
      const startedAt = global.performance.now();

      while (global.performance.now() - startedAt < 1100) {
        samples.push(readVolume());
        await new Promise((resolve) => win.setTimeout(resolve, 70));
      }

      const average = samples.reduce((sum, value) => sum + value, 0) / Math.max(samples.length, 1);
      noiseFloor = Math.max(0.006, average * 1.2);
      options.setNoiseLevel(Math.min(100, Math.round(noiseFloor * 650)));
    }

    function startAudioMeter() {
      const tick = () => {
        currentVolume = readVolume();
        options.setVoiceLevel(Math.min(100, Math.round(currentVolume * 650)));
        options.setNoiseLevel(Math.min(100, Math.round(noiseFloor * 650)));
        animationFrameId = win.requestAnimationFrame(tick);
      };
      tick();
    }

    function stopAudioMonitor() {
      if (animationFrameId) {
        win.cancelAnimationFrame(animationFrameId);
        animationFrameId = undefined;
      }

      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
        micStream = undefined;
      }

      if (audioSource) {
        audioSource.disconnect();
        audioSource = undefined;
      }

      options.setVoiceLevel(0);
      audioReady = false;
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

    function isVoiceActive() {
      return currentVolume > noiseFloor + 0.002;
    }

    return {
      start,
      stop,
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
