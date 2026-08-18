const lessons = {
  silabas: [
    "ma me mi mo mu", "pa pe pi po pu", "la le li lo lu", "sa se si so su",
    "ta te ti to tu", "na ne ni no nu", "ra re ri ro ru", "ca que qui co cu",
    "ba be bi bo bu", "da de di do du", "fa fe fi fo fu", "ga gue gui go gu",
  ],
  palabras_cortas: [
    "sol", "mar", "luz", "paz", "sal", "pez", "rio", "oro", "ola", "col",
    "oso", "ave", "pan", "uva", "ajo", "ojo", "pie", "dar", "ser", "ver",
    "son", "uno", "van", "fue", "hay", "ven", "ten", "pon", "si", "no",
    "ya", "mas", "mil", "mal", "tan", "muy", "sin", "por", "con", "dos",
    "rey", "mes", "ley", "fin", "voz", "don", "gol", "era", "vez", "ano",
    "gas", "tres", "bien", "tos", "sed", "res", "mio", "oda", "asi", "ir",
    "luna", "nube", "rosa", "lago", "flor", "nido", "maiz", "duna", "lava", "rana",
    "lodo", "polo", "lena", "loma", "toro", "puma", "pato", "loro", "gato", "mula",
    "buey", "cria", "taco", "sopa", "miel", "coco", "papa", "lima", "higo", "yuca",
    "nabo", "mote", "nino", "nina", "mama", "papa", "bebe", "mano", "boca", "dedo",
    "pelo", "cara", "mesa", "casa", "ropa", "sala", "tela", "mapa", "vela", "bola",
    "bota", "fila", "hoja", "hola", "isla", "joya", "jugo", "kilo", "loco", "lupa",
    "tema", "tubo", "rojo", "azul", "gris", "lila", "alto", "bajo", "rico", "sano",
    "liso", "duro", "fino", "puro", "tipo", "tope", "tuna", "cola", "nuca", "leer",
    "amar", "amor", "beso", "vida", "vino", "vaca", "vale", "vena", "tren", "oido",
    "alma", "foca", "lona", "lomo", "toma", "visa",
  ],
  palabras_medianas: [
    "arbol", "lluvia", "camino", "jardin", "pelota", "musica", "amigos",
    "viento", "tierra", "verano", "puerta", "espejo", "tiempo", "trabajo",
    "bosque", "ciudad", "flores", "regalo", "escuela", "tambor", "cohete",
    "playa", "brillo", "cielo", "noche", "tarde", "campo", "cerro", "arroyo",
    "piedra", "monte", "bahia", "sierra", "palmar", "laguna", "selva",
    "perro", "pajaro", "raton", "caballo", "conejo", "tortuga", "iguana",
    "lagarto", "burro", "ardilla", "mapache", "coyote", "venado", "jabali",
    "grillo", "abeja", "mosca", "delfin", "alacran", "zorrillo",
    "tacos", "tamales", "pozole", "menudo", "birria", "elotes", "gordita",
    "tostada", "atole", "elote", "chile", "mango", "guayaba", "pepino",
    "jicama", "tlayuda", "tepache", "camote", "zapote", "platano", "naranja",
    "limon", "chayote", "carnita", "machaca", "memela", "chalupa", "tamal",
    "abuelo", "abuela", "hermano", "hermana", "primo", "vecino", "familia",
    "lapiz", "papel", "tijeras", "pintura", "maestra", "alumno", "recreo",
    "salon", "mochila", "examen", "crayon", "pincel", "tarea", "clase", "libro",
    "cabeza", "brazo", "pierna", "rodilla", "hombro", "espalda", "barriga",
    "mejilla", "oreja", "cuarto", "ventana", "pared", "suelo", "techo", "pasillo",
    "garage", "cocina", "colima", "volcan", "comala", "palmera", "danzon",
    "tecoman", "armeria", "puerto", "muelle", "malecon", "costera",
    "celular", "tablet", "bocina", "cable", "senal", "mensaje", "llamada",
    "verde", "negro", "blanco", "morado", "rosado", "dorado", "colores",
    "bonita", "alegre", "fuerte", "tierno", "suave", "grande", "gordo", "flaco",
    "moreno", "chico", "lindo", "bueno", "triste", "feliz", "rapido", "lento",
    "limpio", "sucio", "nuevo", "viejo", "bonito", "facil", "dificil",
    "bombero", "doctor", "musico", "pintor", "torero", "maices", "mangos",
    "cocos", "limones", "nopales",
  ],
  palabras_largas: [
    "mariposa", "elefante", "serpiente", "cocodrilo", "guajolote", "chapulin",
    "tlacuache", "tecolote", "escorpion", "cangrejo", "guacamole", "aguacate",
    "tamarindo", "enchilada", "guanabana", "carnitas", "gorditas", "tostadas",
    "chayotes", "palmeras", "coquitos", "naranjas", "mazapanes", "quesillo",
    "computadora", "calculadora", "reproductor", "television", "ventilador",
    "pantalla", "cargador", "cuaderno", "borrador", "pizarron", "presidente",
    "gobernador", "secretaria", "periodista", "arquitecto", "veterinario",
    "electricista", "carpintero", "enfermera", "dentista", "electricidad",
    "telescopio", "temperatura", "fotografia", "equilibrio", "madrugada",
    "manzanillo", "dinosaurio", "universidad", "biblioteca", "laboratorio",
    "supermercado", "restaurante", "aeropuerto", "estacionamiento",
    "departamento", "bicicleta", "automovil", "cumpleanos", "refrigerador",
    "helicoptero", "submarino", "diccionario", "calendario", "matematicas",
    "paraguas", "administracion", "investigacion", "conversacion",
    "participacion", "pronunciacion", "comprension", "independencia",
    "constitucion", "revolucion", "celebracion", "decoracion", "comunicacion",
    "construccion", "responsabilidad", "entretenimiento", "funcionamiento",
    "contabilidad",
  ],
  frases_cortas: [
    "El sol brilla hoy", "La luna es bella", "El cielo esta azul",
    "El agua esta fria", "La lluvia cayo fuerte", "El viento sopla fuerte",
    "El rio esta lleno", "El maiz es rico", "El volcan humea hoy",
    "La flor huele bien", "La noche esta fria", "El lago es grande",
    "El perro corre rapido", "Mi gato es cafe", "El pato nada bien",
    "La rosa es roja", "El toro es grande", "El oso es cafe",
    "La abeja pica mucho", "El loro habla claro", "El burro camina lento",
    "Mama hace pan rico", "El nino come manzana", "Mi mama me quiere",
    "Papa trabaja mucho", "Mi hermano es alto", "Tengo seis anos",
    "Mi abuela hace tamales", "La maestra es buena", "Mi casa es grande",
    "Me gusta el chocolate", "Me gustan los tacos", "El mango esta dulce",
    "La naranja es rica", "El pan esta caliente", "Quiero agua fria",
    "La palma da cocos", "Tengo un libro rojo", "Voy a la escuela",
    "Juego con mis amigos", "La mariposa vuela alto", "Tengo tarea hoy",
    "El recreo ya llego", "Me gustan las frutas", "Soy buen alumno",
    "Voy al parque", "Me duele la cabeza", "Me lavo las manos",
    "Me duele el pie", "Tengo hambre ahora", "Tengo sed y hambre",
    "Me duele la panza", "Colima es bonita", "Hoy no hay clases",
    "La luna brilla mucho", "El sol es grande", "Mi perro se llama Rex",
    "Los peces nadan juntos", "El arbol tiene hojas", "El cielo tiene nubes",
    "Quiero jugar futbol",
  ],
  frases_medianas: [
    "El perro juega en el jardin verde", "Las mariposas vuelan sobre las flores",
    "El caballo corre libre por el potrero", "Vi una iguana grande en el arroyo",
    "El rio corre entre las montanas altas", "Los pajaros cantan bonito en la manana",
    "La lluvia cae sobre los arboles grandes", "El sol calienta toda la ciudad hoy",
    "La ardilla salta de arbol en arbol", "El cocodrilo vive cerca del rio tranquilo",
    "El delfin nada muy rapido en el mar", "El coyote aulla en la noche oscura",
    "El tlacuache se esconde entre los arboles", "Las tortugas nadan lento en el lago",
    "El grillo canta toda la noche fuerte", "Encontramos un conejo chiquito en el jardin",
    "Me gustan los tacos de pollo con salsa", "Mama prepara la cena con mucho amor",
    "Mi abuela hace pozole rojo los jueves", "Hoy hay birria de res en mi casa",
    "Los chapulines se comen con sal y limon", "Los chayotes del mercado estan muy frescos",
    "Voy al mercado con mi abuelita querida", "Mi abuela sabe hacer guacamole muy rico",
    "En Tecoman hay muchos limones y cocos", "Los cocos caen de las palmeras altas",
    "La maestra ensena en la escuela cada dia", "Saque diez en el examen de matematicas",
    "Mi mochila tiene libros y cuadernos nuevos", "El recreo dura veinte minutos cada dia",
    "Hoy aprendimos las tablas de multiplicar", "Mi companero me presto un lapiz rojo",
    "La directora hablo con todos los alumnos", "Manana hay excursion al museo de la ciudad",
    "El maestro escribe en el pizarron verde", "El libro tiene muchas paginas con dibujos",
    "Mi hermana aprende a tocar la flauta dulce", "Los alumnos leen en voz alta en clase",
    "Mi papa trabaja en una tienda del centro", "Mi mama me lleva a la escuela cada manana",
    "Mi abuelo me cuenta cuentos por las noches", "Mi hermana y yo jugamos en el patio juntos",
    "Los domingos vamos a comer con la familia", "Mi tia vive en una casa cerca del rio",
    "El perro de mi vecino ladra muy fuerte", "Mi primo juega futbol en el parque verde",
    "Voy con mi mama al mercado los sabados", "La pelota rueda por todo el patio escolar",
    "El volcan de Colima se ve muy bonito", "Las palmeras crecen en toda la costa verde",
    "El danzon se baila en el jardin principal", "El calor de Colima es muy fuerte hoy",
    "Vamos a la playa de Manzanillo en verano", "Los limones de Tecoman son los mejores",
    "La costera de Manzanillo es muy bonita", "Los flamboyanes florecen en la ciudad capital",
    "Debo lavarme los dientes antes de dormir", "Es importante comer frutas y verduras frescas",
    "Mi perro come su comida todas las mananas", "El maestro llego muy temprano a la escuela",
  ],
  frases_largas: [
    "El nino corre feliz por el parque verde de la ciudad",
    "La mariposa vuela sobre las flores del jardin de mi abuela",
    "El arbol grande de mi jardin tiene muchas ramas llenas de hojas",
    "La luna brilla muy bonito en el cielo oscuro y estrellado",
    "Los flamboyanes florecen de color rojo en las calles de la ciudad",
    "El rio Armeria pasa por varios municipios del estado de Colima",
    "Durante la temporada de lluvias los cerros de Colima se ponen verdes",
    "Los chapulines son insectos que se comen tostados con sal y chile",
    "El tlacuache se pasea de noche buscando fruta y agua fresca",
    "El cocodrilo puede nadar muy rapido y tambien correr en tierra",
    "Los coyotes aullan en la noche oscura cuando hay luna llena",
    "Los venados corren muy rapido cuando sienten peligro en el bosque",
    "El volcan de Colima se puede ver desde muchos pueblos del estado",
    "Las fiestas de Colima tienen musica de mariachi y danzon en el jardin",
    "Mi familia viaja a Manzanillo para ver el mar y comer mariscos frescos",
    "Los limones de Tecoman son los mas famosos de todo Mexico y el mundo",
    "En la feria de Colima hay juegos mecanicos comida y musica toda la noche",
    "Mi abuela me enseno a hacer tamales de rajas con queso y chile verde",
    "El mercado Constitucion tiene frutas verduras y artesanias de todo Colima",
    "Los cocos de Manzanillo son muy ricos con limon y chile en polvo",
    "Mi mama hace atole de guayaba caliente cuando hace mucho frio",
    "Los charros de Colima son muy valientes y habilidosos con el lazo",
    "Todos los dias voy a la escuela caminando con mis amigos del barrio",
    "La maestra nos explico como se forman las nubes en el cielo azul",
    "Aprender a leer es muy importante para poder estudiar toda la vida",
    "En la biblioteca de la escuela hay muchos libros de cuentos y ciencias",
    "Mi companero y yo hicimos una maqueta del sistema solar con carton",
    "La directora premiara a los alumnos que lean mas libros este ano",
    "El maestro nos pidio que leyeramos un libro completo por semana",
    "En la noche escucho a los grillos cantar cerca de mi ventana",
    "Mi familia y yo comemos juntos en la mesa todos los domingos",
    "Mi abuelita hace tamales deliciosos cada ano para las posadas de diciembre",
    "El chocolate caliente sabe muy rico en las mananas de frio intenso",
    "Los ninos juegan futbol en el parque cuando termina la escuela por la tarde",
    "Mi abuelo me cuenta historias de cuando el era nino pequeno en el rancho",
    "Es importante ayudar a nuestros companeros cuando tienen alguna dificultad",
    "Mi mama me enseno a decir gracias por favor y buenos dias siempre",
    "Cuidar el medio ambiente es responsabilidad de todos los ninos y adultos",
    "Los amigos verdaderos se ayudan y se respetan en todo momento del dia",
    "Mi familia festeja el dia de muertos con ofrendas de flores y comida",
  ],
};

const promptEl = document.querySelector("#prompt");
const statusEl = document.querySelector("#mic-status");
const feedbackEl = document.querySelector("#feedback");
const heardEl = document.querySelector("#heard-text");
const meterFill = document.querySelector("#meter-fill");
const startBtn = document.querySelector("#start-btn");
const nextBtn = document.querySelector("#next-btn");
const levelSelect = document.querySelector("#level-select");
const correctCountEl = document.querySelector("#correct-count");
const errorCountEl = document.querySelector("#error-count");
const customText = document.querySelector("#custom-text");
const useCustom = document.querySelector("#use-custom");
const noiseLevelEl = document.querySelector("#noise-level");
const voiceLevelEl = document.querySelector("#voice-level");
const confidenceLevelEl = document.querySelector("#confidence-level");
const loginScreen = document.querySelector("#login-screen");
const loginForm = document.querySelector("#login-form");
const studentNameInput = document.querySelector("#student-name");
const studentGroupInput = document.querySelector("#student-group");
const currentStudentEl = document.querySelector("#current-student");
const scoreCountEl = document.querySelector("#score-count");
const logoutBtn = document.querySelector("#logout-btn");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const storageKey = "lectovoz_records";
const sessionKey = "lectovoz_session";

let recognition;
let activeText = "";
let chunks = [];
let currentIndex = 0;
let lessonIndex = 0;
let listening = false;
let correctCount = 0;
let errorCount = 0;
let lastTranscript = "";
let audioContext;
let analyser;
let micStream;
let animationFrameId;
let audioSource;
let noiseFloor = 0.025;
let currentVolume = 0;
let pendingErrorCount = 0;
let recognitionStartedAt = 0;
let audioReady = false;
let currentSession = null;
let score = 0;
let lessonStartedAt = Date.now();
let lessonCorrect = 0;
let lessonErrors = 0;
let shuffledLessons = {};

const minConfidence = 0;

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00f1/g, "n")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoChunks(text) {
  const normalized = normalizeText(text);
  if (levelSelect.value === "silabas") {
    return normalized.split(" ").filter(Boolean);
  }

  if (levelSelect.value.startsWith("palabras")) {
    return normalized
      .split(" ")
      .flatMap((word) => syllabifyWord(word))
      .filter(Boolean);
  }

  return normalized.split(" ").filter(Boolean);
}

function syllabifyWord(word) {
  const syllables = [];
  let chunk = "";

  for (let index = 0; index < word.length; index += 1) {
    const letter = word[index];
    const next = word[index + 1] || "";
    chunk += letter;

    if (isVowel(letter) && (!next || !isVowel(next))) {
      syllables.push(chunk);
      chunk = "";
    }
  }

  if (chunk) {
    if (syllables.length) {
      syllables[syllables.length - 1] += chunk;
    } else {
      syllables.push(chunk);
    }
  }

  return syllables;
}

function isVowel(letter) {
  return "aeiou".includes(letter);
}

function renderPrompt() {
  promptEl.innerHTML = "";
  chunks.forEach((chunk, index) => {
    const span = document.createElement("span");
    span.className = "chunk";
    span.textContent = chunk;
    span.dataset.index = index;
    if (index === currentIndex) span.classList.add("current");
    promptEl.appendChild(span);

    if (levelSelect.value.startsWith("frases") && index < chunks.length - 1) {
      const space = document.createElement("span");
      space.className = "space";
      promptEl.appendChild(space);
    }
  });
  updateMeter();
}

function setLesson(text) {
  activeText = normalizeText(text);
  chunks = splitIntoChunks(activeText);
  currentIndex = 0;
  lastTranscript = "";
  pendingErrorCount = 0;
  lessonStartedAt = Date.now();
  lessonCorrect = 0;
  lessonErrors = 0;
  heardEl.textContent = "-";
  feedbackEl.textContent = "Lee en voz alta. El microfono ira siguiendo tu lectura.";
  renderPrompt();
}

function loadCurrentLesson() {
  const list = getLessonList(levelSelect.value);
  setLesson(list[lessonIndex % list.length]);
}

function getLessonList(level) {
  if (!shuffledLessons[level] || shuffledLessons[level].length !== lessons[level].length) {
    shuffledLessons[level] = shuffleList(lessons[level]);
  }
  return shuffledLessons[level];
}

function shuffleList(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function updateMeter() {
  const done = chunks.filter((_, index) => {
    const el = promptEl.querySelector(`[data-index="${index}"]`);
    return el?.classList.contains("correct");
  }).length;
  meterFill.style.width = chunks.length ? `${Math.round((done / chunks.length) * 100)}%` : "0%";
}

function markChunk(index, state) {
  const el = promptEl.querySelector(`[data-index="${index}"]`);
  if (!el) return;
  el.classList.remove("current", "correct", "error");
  el.classList.add(state);
}

function setCurrent(index) {
  promptEl.querySelectorAll(".chunk").forEach((el) => el.classList.remove("current"));
  const el = promptEl.querySelector(`[data-index="${index}"]`);
  if (el) el.classList.add("current");
}

function chunkMatches(spoken, expected) {
  if (!spoken || !expected) return false;
  return scoreMatch(spoken, expected) >= getMatchThreshold(expected);
}

function scoreMatch(spoken, expected) {
  const cleanSpoken = normalizeText(spoken);
  const cleanExpected = normalizeText(expected);
  const phoneticSpoken = phoneticKey(cleanSpoken);
  const phoneticExpected = phoneticKey(cleanExpected);

  if (cleanSpoken === cleanExpected || phoneticSpoken === phoneticExpected) return 1;
  if (cleanSpoken.includes(cleanExpected) || phoneticSpoken.includes(phoneticExpected)) {
    return cleanExpected.length <= 2 ? 0.92 : 0.86;
  }

  const directDistance = normalizedDistance(cleanSpoken, cleanExpected);
  const phoneticDistance = normalizedDistance(phoneticSpoken, phoneticExpected);
  const dice = diceSimilarity(phoneticSpoken, phoneticExpected);
  return Math.max(1 - directDistance, 1 - phoneticDistance, dice);
}

function getMatchThreshold(expected) {
  if (expected.length <= 2) return 0.9;
  if (expected.length <= 4) return 0.76;
  return 0.68;
}

function phoneticKey(value) {
  return normalizeText(value)
    .replace(/ch/g, "x")
    .replace(/ll/g, "y")
    .replace(/rr/g, "r")
    .replace(/qu/g, "k")
    .replace(/gue/g, "ge")
    .replace(/gui/g, "gi")
    .replace(/[bv]/g, "b")
    .replace(/[cz]/g, "s")
    .replace(/h/g, "")
    .replace(/j/g, "g")
    .replace(/y$/g, "i")
    .replace(/(.)\1+/g, "$1");
}

function buildSpokenCandidates(transcript) {
  const words = normalizeText(transcript).split(" ").filter(Boolean);
  const syllables = words.flatMap((word) => syllabifyWord(word));
  const adjacentPairs = [];

  for (let index = 0; index < words.length - 1; index += 1) {
    adjacentPairs.push(`${words[index]} ${words[index + 1]}`);
    adjacentPairs.push(`${words[index]}${words[index + 1]}`);
  }

  return [...new Set([...words, ...syllables, ...adjacentPairs, words.join(" ")].filter(Boolean))];
}

function canAdvanceWithTranscript(transcript, expected) {
  const candidates = buildSpokenCandidates(transcript);
  return candidates.some((candidate) => chunkMatches(candidate, expected));
}

function findError(spokenWords, expected) {
  if (!spokenWords.length || !expected) return false;
  const tail = spokenWords[spokenWords.length - 1];
  const tailScore = scoreMatch(tail, expected);
  const startsClose = phoneticKey(expected).startsWith(phoneticKey(tail));
  return tail.length >= Math.min(3, expected.length) && !startsClose && tailScore < getMatchThreshold(expected) - 0.18;
}

function processTranscript(transcript, confidence = 1, isFinal = false, alternatives = []) {
  const clean = normalizeText(transcript);
  if (!clean || clean === lastTranscript) return;
  if (!isFinal && confidence > 0 && confidence < minConfidence) return;

  lastTranscript = clean;
  heardEl.textContent = clean;
  confidenceLevelEl.textContent = confidence > 0 ? `${Math.round(confidence * 100)}%` : "-";

  const spokenWords = clean.split(" ").filter(Boolean);
  const candidateTranscripts = [clean, ...alternatives.map(normalizeText)].filter(Boolean);
  let advanced = 0;

  while (
    currentIndex < chunks.length
    && candidateTranscripts.some((candidate) => canAdvanceWithTranscript(candidate, chunks[currentIndex]))
  ) {
    pendingErrorCount = 0;
    markChunk(currentIndex, "correct");
    correctCount += 1;
    lessonCorrect += 1;
    correctCountEl.textContent = correctCount;
    updateScore(10);
    currentIndex += 1;
    advanced += 1;
    updateMeter();
  }

  if (currentIndex >= chunks.length) {
    feedbackEl.textContent = "Lectura completa. Muy bien.";
    savePracticeRecord("completed");
    stopListening(false);
    return;
  }

  if (advanced > 0) {
    setCurrent(currentIndex);
    feedbackEl.textContent = `Sigue con: ${chunks[currentIndex]}`;
    return;
  }

  const expected = chunks[currentIndex];
  if (findError(spokenWords, expected)) {
    pendingErrorCount += isFinal ? 2 : 1;
    if (pendingErrorCount < 2) return;

    markChunk(currentIndex, "error");
    errorCount += 1;
    lessonErrors += 1;
    errorCountEl.textContent = errorCount;
    updateScore(-2);
    feedbackEl.textContent = `Intenta de nuevo: ${expected}`;
    pendingErrorCount = 0;
    window.setTimeout(() => setCurrent(currentIndex), 650);
  }
}

async function startListening() {
  if (!currentSession) {
    loginScreen.classList.remove("hidden");
    feedbackEl.textContent = "Entra con nombre y grupo para guardar tu avance.";
    return;
  }

  if (!SpeechRecognition) {
    feedbackEl.textContent = "Este navegador no soporta reconocimiento de voz. Usa Chrome o Edge.";
    return;
  }

  await prepareAudioMonitor();

  if (!recognition) {
    recognition = new SpeechRecognition();
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
      processTranscript(transcript, confidence, isFinal, alternatives);
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        feedbackEl.textContent = "Sigo escuchando. Habla normal, cerca del microfono.";
        return;
      }

      if (event.error === "aborted") return;

      feedbackEl.textContent = `No pude escuchar bien: ${event.error}`;
      statusEl.textContent = "Reintentando microfono";
    };

    recognition.onend = () => {
      if (listening) {
        window.setTimeout(() => {
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

  listening = true;
  recognitionStartedAt = performance.now();
  try {
    recognition.start();
  } catch (error) {
    if (error.name !== "InvalidStateError") throw error;
  }
  statusEl.textContent = "Escuchando";
  statusEl.classList.add("listening");
  startBtn.textContent = "Pausar";
  feedbackEl.textContent = `Lee ahora: ${chunks[currentIndex]}`;
}

function stopListening(updateText = true) {
  listening = false;
  if (recognition) recognition.stop();
  stopAudioMonitor();
  statusEl.textContent = "Microfono detenido";
  statusEl.classList.remove("listening");
  startBtn.textContent = "Iniciar lectura";
  if (updateText) feedbackEl.textContent = "Lectura pausada.";
}

function getRecords() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function savePracticeRecord(status) {
  if (!currentSession || !chunks.length) return;

  const total = chunks.length;
  const accuracy = Math.max(0, Math.round((lessonCorrect / Math.max(lessonCorrect + lessonErrors, 1)) * 100));
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    status,
    student: currentSession.student,
    group: currentSession.group,
    level: levelSelect.value,
    text: activeText,
    correct: lessonCorrect,
    errors: lessonErrors,
    total,
    score,
    accuracy,
    transcript: lastTranscript || "-",
    durationSeconds: Math.max(1, Math.round((Date.now() - lessonStartedAt) / 1000)),
    createdAt: new Date().toISOString(),
  };

  const records = getRecords();
  records.unshift(record);
  localStorage.setItem(storageKey, JSON.stringify(records.slice(0, 300)));
}

function updateScore(points) {
  score = Math.max(0, score + points);
  scoreCountEl.textContent = score;
}

function restoreSession() {
  try {
    currentSession = JSON.parse(localStorage.getItem(sessionKey));
  } catch {
    currentSession = null;
  }

  if (!currentSession) return;
  loginScreen.classList.add("hidden");
  currentStudentEl.textContent = `${currentSession.student} / ${currentSession.group}`;
}

function createSession(student, group) {
  currentSession = {
    student,
    group,
    startedAt: new Date().toISOString(),
  };
  localStorage.setItem(sessionKey, JSON.stringify(currentSession));
  loginScreen.classList.add("hidden");
  currentStudentEl.textContent = `${student} / ${group}`;
}

async function prepareAudioMonitor() {
  if (!navigator.mediaDevices?.getUserMedia) {
    audioReady = false;
    return;
  }

  if (!micStream) {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
  }

  audioContext = audioContext || new AudioContext();
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

  statusEl.textContent = "Calibrando ruido";
  feedbackEl.textContent = "Guarda silencio un momento para medir el ruido del salon.";
  await calibrateNoise();
  startAudioMeter();
  audioReady = true;
}

async function calibrateNoise() {
  const samples = [];
  const startedAt = performance.now();

  while (performance.now() - startedAt < 1100) {
    samples.push(readVolume());
    await new Promise((resolve) => window.setTimeout(resolve, 70));
  }

  const average = samples.reduce((sum, value) => sum + value, 0) / Math.max(samples.length, 1);
  noiseFloor = Math.max(0.006, average * 1.2);
  noiseLevelEl.style.width = `${Math.min(100, Math.round(noiseFloor * 650))}%`;
}

function startAudioMeter() {
  const tick = () => {
    currentVolume = readVolume();
    const voicePercent = Math.min(100, Math.round(currentVolume * 650));
    const noisePercent = Math.min(100, Math.round(noiseFloor * 650));
    voiceLevelEl.style.width = `${voicePercent}%`;
    noiseLevelEl.style.width = `${noisePercent}%`;
    animationFrameId = window.requestAnimationFrame(tick);
  };
  tick();
}

function stopAudioMonitor() {
  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId);
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

  voiceLevelEl.style.width = "0%";
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

function normalizedDistance(a, b) {
  if (!a && !b) return 0;
  return levenshtein(a, b) / Math.max(a.length, b.length, 1);
}

function diceSimilarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const aPairs = makePairs(a);
  const bPairs = makePairs(b);
  let matches = 0;
  const used = new Set();

  for (const pair of aPairs) {
    const index = bPairs.findIndex((other, candidateIndex) => other === pair && !used.has(candidateIndex));
    if (index >= 0) {
      matches += 1;
      used.add(index);
    }
  }

  return (2 * matches) / (aPairs.length + bPairs.length);
}

function makePairs(value) {
  const pairs = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    pairs.push(value.slice(index, index + 2));
  }
  return pairs;
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, (_, row) => [row]);
  for (let col = 0; col <= a.length; col += 1) matrix[0][col] = col;

  for (let row = 1; row <= b.length; row += 1) {
    for (let col = 1; col <= a.length; col += 1) {
      matrix[row][col] = b[row - 1] === a[col - 1]
        ? matrix[row - 1][col - 1]
        : Math.min(matrix[row - 1][col - 1] + 1, matrix[row][col - 1] + 1, matrix[row - 1][col] + 1);
    }
  }
  return matrix[b.length][a.length];
}

startBtn.addEventListener("click", () => {
  if (listening) {
    stopListening();
  } else {
    startListening();
  }
});

nextBtn.addEventListener("click", () => {
  stopListening(false);
  lessonIndex += 1;
  loadCurrentLesson();
});

levelSelect.addEventListener("change", () => {
  stopListening(false);
  lessonIndex = 0;
  loadCurrentLesson();
});

useCustom.addEventListener("click", () => {
  const value = customText.value.trim();
  if (!value) return;
  stopListening(false);
  setLesson(value);
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const student = studentNameInput.value.trim();
  const group = studentGroupInput.value.trim();
  if (!student || !group) return;
  createSession(student, group);
});

logoutBtn.addEventListener("click", () => {
  stopListening(false);
  localStorage.removeItem(sessionKey);
  currentSession = null;
  loginScreen.classList.remove("hidden");
  currentStudentEl.textContent = "Invitado";
});

restoreSession();
loadCurrentLesson();
