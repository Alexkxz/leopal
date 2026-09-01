(function initContentModule(global) {
  const syllableGroups = [
    { consonant: "m", items: ["ma", "me", "mi", "mo", "mu"] },
    { consonant: "p", items: ["pa", "pe", "pi", "po", "pu"] },
    { consonant: "l", items: ["la", "le", "li", "lo", "lu"] },
    { consonant: "s", items: ["sa", "se", "si", "so", "su"] },
    { consonant: "t", items: ["ta", "te", "ti", "to", "tu"] },
    { consonant: "n", items: ["na", "ne", "ni", "no", "nu"] },
    { consonant: "d", items: ["da", "de", "di", "do", "du"] },
    { consonant: "b", items: ["ba", "be", "bi", "bo", "bu"] },
    { consonant: "f", items: ["fa", "fe", "fi", "fo", "fu"] },
    { consonant: "c", items: ["ca", "que", "qui", "co", "cu"] },
    { consonant: "g", items: ["ga", "gue", "gui", "go", "gu"] },
    { consonant: "r", items: ["ra", "re", "ri", "ro", "ru"] },
    { consonant: "j", items: ["ja", "je", "ji", "jo", "ju"] },
    { consonant: "v", items: ["va", "ve", "vi", "vo", "vu"] },
    { consonant: "z", items: ["za", "ze", "zi", "zo", "zu"] },
    { consonant: "h", items: ["ha", "he", "hi", "ho", "hu"] },
    { consonant: "ch", items: ["cha", "che", "chi", "cho", "chu"] },
    { consonant: "ll", items: ["lla", "lle", "lli", "llo", "llu"] },
    { consonant: "ñ", items: ["ña", "ñe", "ñi", "ño", "ñu"] },
  ];

  const segmentedWordPairs = [
    ["ca-sa", "casa"], ["me-sa", "mesa"], ["pe-lo-ta", "pelota"], ["ma-no", "mano"],
    ["pa-to", "pato"], ["ca-mi-no", "camino"], ["ca-mio-ne-ta", "camioneta"], ["ma-ri-po-sa", "mariposa"],
    ["lu-na", "luna"], ["nu-be", "nube"], ["ro-sa", "rosa"], ["la-go", "lago"],
    ["ni-do", "nido"], ["ra-na", "rana"], ["lo-ro", "loro"], ["ga-to", "gato"],
    ["mu-la", "mula"], ["ta-co", "taco"], ["so-pa", "sopa"], ["co-co", "coco"],
    ["li-ma", "lima"], ["hi-go", "higo"], ["yu-ca", "yuca"], ["da-do", "dado"],
    ["ta-za", "taza"], ["te-la", "tela"], ["bo-la", "bola"], ["bo-ta", "bota"],
    ["fi-la", "fila"], ["ho-ja", "hoja"], ["ju-go", "jugo"], ["lu-pa", "lupa"],
    ["te-ma", "tema"], ["tu-bo", "tubo"], ["ro-jo", "rojo"], ["a-zul", "azul"],
    ["bo-ca", "boca"], ["de-do", "dedo"], ["pe-lo", "pelo"], ["ca-ra", "cara"],
    ["ro-pa", "ropa"], ["sa-la", "sala"], ["ma-pa", "mapa"], ["ve-la", "vela"],
    ["ca-ma", "cama"], ["co-pa", "copa"], ["pi-so", "piso"], ["pe-so", "peso"],
    ["ma-sa", "masa"], ["nu-do", "nudo"], ["sa-po", "sapo"], ["se-da", "seda"],
    ["fa-ro", "faro"], ["go-ma", "goma"], ["va-so", "vaso"], ["zo-na", "zona"],
    ["a-bue-lo", "abuelo"], ["a-bue-la", "abuela"], ["her-ma-no", "hermano"], ["fa-mi-lia", "familia"],
    ["es-cue-la", "escuela"], ["a-mi-go", "amigo"], ["co-mi-da", "comida"], ["jar-din", "jardin"],
    ["puer-ta", "puerta"], ["co-ci-na", "cocina"], ["re-ga-lo", "regalo"], ["cam-po", "campo"],
  ];

  const simpleWords = [
    "casa", "mesa", "familia", "cosa", "limpio", "pelota", "camino", "mano", "gato", "perro",
    "escuela", "amigo", "comida", "jardin", "puerta", "cocina", "regalo", "campo", "playa", "cielo",
    "sol", "mar", "luz", "paz", "sal", "pez", "rio", "oro", "ola", "oso",
    "ave", "pan", "uva", "ajo", "ojo", "pie", "luna", "nube", "rosa", "lago",
    "flor", "nido", "maiz", "duna", "lava", "rana", "lodo", "polo", "lena", "loma",
    "toro", "puma", "pato", "loro", "mula", "taco", "sopa", "miel", "coco", "papa",
    "lima", "higo", "yuca", "nabo", "mote", "nino", "nina", "mama", "bebe", "boca",
    "dedo", "pelo", "cara", "ropa", "sala", "tela", "mapa", "vela", "bola", "bota",
    "fila", "hoja", "hola", "isla", "joya", "jugo", "kilo", "loco", "lupa", "tema",
    "tubo", "rojo", "azul", "gris", "lila", "alto", "bajo", "rico", "sano", "liso",
    "duro", "fino", "puro", "tuna", "cola", "nuca", "leer", "amar", "amor", "beso",
    "vida", "vino", "vaca", "foca", "abuelo", "abuela", "primo", "vecino", "lapiz", "papel",
    "tarea", "clase", "libro", "salon", "patio", "cuento", "dulce", "nuevo", "viejo", "bonito",
  ];

  const complexWords = [
    "trabajo", "flamenco", "experimentos", "problema", "primavera", "biblioteca", "electricidad", "computadora",
    "instrumento", "transporte", "escritura", "planeta", "profesor", "cristal", "dragon", "grande",
    "fruta", "planta", "blanco", "brazo", "brillo", "bosque", "ciudad", "tambor",
    "cohete", "arroyo", "piedra", "sierra", "palmar", "laguna", "pajaro", "raton",
    "caballo", "conejo", "tortuga", "iguana", "lagarto", "ardilla", "venado", "grillo",
    "delfin", "alacran", "tamales", "pozole", "gordita", "tostada", "tepache", "platano",
    "naranja", "chayote", "hermano", "hermana", "tijeras", "pintura", "maestra", "alumno",
    "recreo", "mochila", "examen", "crayon", "pincel", "cabeza", "pierna", "rodilla",
    "hombro", "espalda", "barriga", "mejilla", "oreja", "cuarto", "ventana", "pasillo",
    "palmera", "danzon", "tecoman", "armeria", "puerto", "muelle", "malecon", "costera",
    "celular", "tablet", "bocina", "mensaje", "llamada", "colores", "alegre", "fuerte",
    "tierno", "suave", "morado", "rosado", "dorado", "bombero", "doctor", "musico",
    "pintor", "mariposa", "elefante", "serpiente", "cocodrilo", "chapulin", "tecolote", "cangrejo",
    "guacamole", "aguacate", "tamarindo", "enchilada", "carnitas", "computadora", "calculadora", "reproductor",
    "television", "ventilador", "pantalla", "cargador", "cuaderno", "borrador", "pizarron", "arquitecto",
    "veterinario", "electricista", "carpintero", "enfermera", "dentista", "telescopio", "temperatura", "fotografia",
    "equilibrio", "dinosaurio", "universidad", "laboratorio", "supermercado", "restaurante", "aeropuerto", "departamento",
    "bicicleta", "automovil", "cumpleanos", "refrigerador", "helicoptero", "submarino", "diccionario", "calendario",
    "matematicas", "paraguas", "aprendizaje", "abecedario", "consonantes", "vocalizacion", "entonacion", "ortografia",
    "vocabulario", "imaginacion", "curiosidad", "observacion", "explicacion", "instruccion", "educacion", "naturaleza",
    "experimento", "maravilloso", "silencioso", "cuidadoso", "respetuoso", "organizado", "compartido", "bibliotecario",
  ];

  const shortSentences = [
    "Mi perro corre muy rapido.", "La casa tiene una puerta.", "Mi familia vive cerca de aqui.",
    "El gato duerme en casa.", "La pelota esta en el patio.", "El sol brilla hoy.",
    "La luna es bella.", "El cielo esta azul.", "El agua esta fria.", "La lluvia cayo fuerte.",
    "El viento sopla fuerte.", "El rio esta lleno.", "La flor huele bien.", "La noche esta fria.",
    "El lago es grande.", "El pato nada bien.", "La rosa es roja.", "El toro es grande.",
    "El oso es cafe.", "El loro habla claro.", "Mama hace pan rico.", "El nino come manzana.",
    "Mi mama me quiere.", "Papa trabaja mucho.", "Mi hermano es alto.", "Tengo seis anos.",
    "La maestra es buena.", "Mi casa es grande.", "Me gusta el chocolate.", "Me gustan los tacos.",
    "El mango esta dulce.", "La naranja es rica.", "El pan esta caliente.", "Quiero agua fria.",
    "Tengo un libro rojo.", "Voy a la escuela.", "Juego con mis amigos.", "Tengo tarea hoy.",
    "El recreo ya llego.", "Me gustan las frutas.", "Soy buen alumno.", "Voy al parque.",
    "Me lavo las manos.", "Tengo hambre ahora.", "Colima es bonita.", "Hoy no hay clases.",
    "La luna brilla mucho.", "El sol es grande.", "Los peces nadan juntos.", "Quiero jugar futbol.",
  ];

  const longSentences = [
    "Mi familia prepara la comida mientras yo pongo la mesa.",
    "El perro pequeno corre rapidamente por el patio de la casa.",
    "Los ninos llevaron sus cuadernos nuevos para trabajar en la escuela.",
    "La mariposa de colores volo lentamente sobre las flores del jardin.",
    "El perro juega en el jardin verde de mi abuela.",
    "Las mariposas vuelan sobre las flores durante la manana.",
    "El caballo corre libre por el potrero cerca del rio.",
    "Los pajaros cantan bonito en la manana de primavera.",
    "La lluvia cae sobre los arboles grandes del parque.",
    "El sol calienta toda la ciudad durante la tarde.",
    "La ardilla salta de arbol en arbol sin miedo.",
    "El cocodrilo vive cerca del rio tranquilo y ancho.",
    "Encontramos un conejo chiquito en el jardin escolar.",
    "Me gustan los tacos de pollo con salsa verde.",
    "Mama prepara la cena con mucho amor cada noche.",
    "Mi abuela hace pozole rojo los jueves en casa.",
    "Voy al mercado con mi abuelita querida los sabados.",
    "En Tecoman hay muchos limones y cocos frescos.",
    "La maestra ensena en la escuela cada dia con paciencia.",
    "Mi mochila tiene libros y cuadernos nuevos para clase.",
    "El recreo dura veinte minutos cada dia en la escuela.",
    "Hoy aprendimos las tablas de multiplicar con la maestra.",
    "Mi companero me presto un lapiz rojo nuevo.",
    "El maestro escribe en el pizarron verde con calma.",
    "El libro tiene muchas paginas con dibujos grandes.",
    "Mi hermana aprende a tocar la flauta dulce.",
    "Los alumnos leen en voz alta durante la clase.",
    "Mi papa trabaja en una tienda del centro.",
    "Mi mama me lleva a la escuela cada manana.",
    "Mi abuelo me cuenta cuentos por las noches.",
    "Mi hermana y yo jugamos en el patio juntos.",
    "Los domingos vamos a comer con la familia.",
    "Mi tia vive en una casa cerca del rio.",
    "El perro de mi vecino ladra muy fuerte.",
    "Mi primo juega futbol en el parque verde.",
    "La pelota rueda por todo el patio escolar.",
    "El volcan de Colima se ve muy bonito.",
    "Vamos a la playa de Manzanillo en verano.",
    "Debo lavarme los dientes antes de dormir.",
    "Es importante comer frutas y verduras frescas.",
    "El alumno lee una frase completa con calma.",
    "Cada estudiante puede mejorar con practica constante.",
  ];

  const contentTree = {
    syllables: {
      label: "SILABAS",
      sublevels: {
        syllables: { label: "Silabas", category: "syllables", items: syllableGroups },
        segmentedWords: { label: "Palabras silabeadas", category: "syllables", items: segmentedWordPairs.map(([displayText, expectedText]) => ({ displayText, expectedText })) },
      },
    },
    words: {
      label: "PALABRAS",
      sublevels: {
        simple: { label: "Simples", category: "words", items: simpleWords },
        complex: { label: "Complejas", category: "words", items: complexWords },
      },
    },
    sentences: {
      label: "ORACIONES",
      sublevels: {
        short: { label: "Cortas", category: "sentences", items: shortSentences },
        long: { label: "Amplias", category: "sentences", items: longSentences },
      },
    },
  };

  const levelDefinitions = {
    syllables: contentTree.syllables.sublevels.syllables,
    segmentedWords: contentTree.syllables.sublevels.segmentedWords,
    simpleWords: contentTree.words.sublevels.simple,
    complexWords: contentTree.words.sublevels.complex,
    shortSentences: contentTree.sentences.sublevels.short,
    longSentences: contentTree.sentences.sublevels.long,
  };

  const legacyLevelMap = {
    silabas: "syllables",
    palabras_cortas: "simpleWords",
    palabras_medianas: "simpleWords",
    palabras_largas: "complexWords",
    frases_cortas: "shortSentences",
    frases_medianas: "longSentences",
    frases_largas: "longSentences",
  };

  function makeExercise(value) {
    if (typeof value === "string") return { displayText: value, expectedText: value };
    return {
      ...value,
      displayText: value.displayText || value.expectedText || "",
      expectedText: value.expectedText || value.displayText || "",
    };
  }

  function makeSyllableExercise(group) {
    return {
      displayText: group.items.join(" "),
      expectedText: group.items.join(" "),
      consonant: group.consonant,
      syllables: [...group.items],
    };
  }

  function normalizeLevelId(level) {
    return legacyLevelMap[level] || level || "syllables";
  }

  function getLevelDefinition(level) {
    return levelDefinitions[normalizeLevelId(level)] || levelDefinitions.syllables;
  }

  function getLessonsForLevel(level) {
    const id = normalizeLevelId(level);
    const definition = getLevelDefinition(id);
    if (id === "syllables") return definition.items.map(makeSyllableExercise);
    return definition.items.map(makeExercise);
  }

  function getItems(category, sublevel) {
    const categoryDef = contentTree[category];
    if (!categoryDef) return [];
    const sublevelDef = categoryDef.sublevels[sublevel];
    if (!sublevelDef) return [];
    if (category === "syllables" && sublevel === "syllables") {
      return sublevelDef.items.flatMap((group) => group.items.map((item) => ({
        displayText: item,
        expectedText: item,
        consonant: group.consonant,
      })));
    }
    return sublevelDef.items.map(makeExercise);
  }

  const lessons = Object.fromEntries(Object.keys(levelDefinitions).map((level) => [level, getLessonsForLevel(level)]));
  lessons.silabas = lessons.syllables.map((exercise) => exercise.displayText);
  lessons.palabras_cortas = simpleWords;
  lessons.palabras_medianas = simpleWords;
  lessons.palabras_largas = complexWords;
  lessons.frases_cortas = shortSentences;
  lessons.frases_medianas = longSentences;
  lessons.frases_largas = longSentences;

  const defaultConsonants = syllableGroups.map((group) => group.consonant);
  const defaultGameConfig = {
    consonants: [...defaultConsonants],
    levelStart: "syllables",
    category: "syllables",
    sublevel: "syllables",
    sessionGoal: 10,
    shuffleSyllables: false,
    maxAttemptsPerChunk: 3,
    notes: "",
  };

  function getLessons() {
    return lessons;
  }

  function getContentTree() {
    return contentTree;
  }

  function getDefaultGameConfig() {
    return { ...defaultGameConfig, consonants: [...defaultGameConfig.consonants] };
  }

  global.LectoVozContent = {
    contentTree,
    lessons,
    syllableGroups,
    levelDefinitions,
    legacyLevelMap,
    defaultConsonants,
    defaultGameConfig,
    getLessons,
    getContentTree,
    getLevelDefinition,
    getLessonsForLevel,
    getItems,
    makeExercise,
    normalizeLevelId,
    getDefaultGameConfig,
  };
})(typeof window !== "undefined" ? window : globalThis);
