(function initEvaluationModule(global) {
  function normalizeText(value) {
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\u00f1/g, "n")
      .replace(/[^a-z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isVowel(letter) {
    return "aeiou".includes(letter);
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

  function splitIntoChunks(text, options = {}) {
    const normalized = normalizeText(text);
    const level = options.level || "silabas";
    if (level === "silabas" || level === "syllables") {
      const syllables = normalized.split(" ").filter(Boolean);
      return options.shuffleSyllables ? shuffleList(syllables) : syllables;
    }

    if (level === "segmentedWords" || level === "simpleWords" || level === "complexWords") {
      return normalized ? [normalized] : [];
    }

    if (level.startsWith("palabras")) {
      return normalized ? [normalized] : [];
    }

    return normalized.split(" ").filter(Boolean);
  }

  function normalizeConsonant(value) {
    return normalizeText(value).replace(/\s/g, "");
  }

  function getTextConsonants(text) {
    const normalized = normalizeText(text);
    const consonants = [];

    for (let index = 0; index < normalized.length; index += 1) {
      const pair = normalized.slice(index, index + 2);
      const trio = normalized.slice(index, index + 3);

      if (pair === "ch" || pair === "ll" || pair === "rr") {
        consonants.push(pair);
        index += 1;
        continue;
      }

      if (pair === "qu") {
        consonants.push("q");
        index += 1;
        continue;
      }

      if ((trio === "gue" || trio === "gui") && normalized[index] === "g") {
        consonants.push("g");
        continue;
      }

      const letter = normalized[index];
      if (letter >= "a" && letter <= "z" && !isVowel(letter)) {
        consonants.push(letter);
      }
    }

    return consonants;
  }

  function usesOnlyAllowedConsonants(text, allowedConsonants) {
    const allowed = new Set(allowedConsonants.map(normalizeConsonant));
    return getTextConsonants(text).every((consonant) => allowed.has(consonant));
  }

  function shuffleList(list) {
    const copy = [...list];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function chunkMatches(spoken, expected) {
    return evaluateReading(spoken, expected).status === "correct";
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

  function evaluateReading(spoken, expected) {
    const normalizedSpoken = normalizeText(spoken);
    const normalizedExpected = normalizeText(expected);
    const phoneticSpoken = phoneticKey(normalizedSpoken);
    const phoneticExpected = phoneticKey(normalizedExpected);
    const score = scoreMatch(normalizedSpoken, normalizedExpected);
    const details = {
      spoken: normalizedSpoken,
      expected: normalizedExpected,
      status: "incorrect",
      score,
      normalizedSpoken,
      normalizedExpected,
      reason: "low_similarity",
    };

    if (!normalizedSpoken || !normalizedExpected) {
      return {
        ...details,
        score: 0,
        reason: "missing_text",
      };
    }

    if (normalizedSpoken === normalizedExpected) {
      return {
        ...details,
        status: "correct",
        score: 1,
        reason: "exact_match",
      };
    }

    if (phoneticSpoken === phoneticExpected) {
      return {
        ...details,
        status: "correct",
        score: 1,
        reason: "phonetic_equivalence",
      };
    }

    if (isExpectedInsideSpokenCandidate(normalizedSpoken, normalizedExpected, phoneticSpoken, phoneticExpected)) {
      return {
        ...details,
        status: "correct",
        reason: "expected_found_in_spoken_candidate",
      };
    }

    if (isApproximateReading(normalizedSpoken, normalizedExpected, phoneticSpoken, phoneticExpected, score)) {
      return {
        ...details,
        status: "approximate",
        reason: "high_similarity_but_not_exact",
      };
    }

    return details;
  }

  function isExpectedInsideSpokenCandidate(normalizedSpoken, normalizedExpected, phoneticSpoken, phoneticExpected) {
    if (normalizedExpected.length > 4) return false;
    if (normalizedExpected.length > normalizedSpoken.length) return false;
    if (normalizedSpoken.includes(normalizedExpected)) return true;
    return phoneticSpoken.includes(phoneticExpected);
  }

  function isApproximateReading(normalizedSpoken, normalizedExpected, phoneticSpoken, phoneticExpected, score) {
    const expectedLength = normalizedExpected.length;
    if (expectedLength < 5) return false;

    const directDistance = levenshtein(normalizedSpoken, normalizedExpected);
    const phoneticDistance = levenshtein(phoneticSpoken, phoneticExpected);
    const normalizedDirectDistance = normalizedDistance(normalizedSpoken, normalizedExpected);
    const normalizedPhoneticDistance = normalizedDistance(phoneticSpoken, phoneticExpected);
    const lengthGap = Math.abs(normalizedSpoken.length - normalizedExpected.length);
    const threshold = getApproximateThreshold(normalizedExpected);
    const hasSmallEdit = Math.min(directDistance, phoneticDistance) <= 1;
    const hasCloseDistance = Math.min(normalizedDirectDistance, normalizedPhoneticDistance) <= 0.2;
    const keepsWordShape = hasSharedWordShape(normalizedSpoken, normalizedExpected, phoneticSpoken, phoneticExpected);

    return score >= threshold && hasSmallEdit && hasCloseDistance && lengthGap <= 1 && keepsWordShape;
  }

  function getApproximateThreshold(expected) {
    if (expected.length < 5) return 1;
    if (expected.length <= 7) return 0.82;
    return 0.78;
  }

  function hasSharedWordShape(normalizedSpoken, normalizedExpected, phoneticSpoken, phoneticExpected) {
    const prefixLength = commonPrefixLength(normalizedSpoken, normalizedExpected);
    const phoneticPrefixLength = commonPrefixLength(phoneticSpoken, phoneticExpected);
    const requiredEdge = normalizedExpected.length >= 8 ? 2 : 1;

    return (
      prefixLength >= requiredEdge
      || phoneticPrefixLength >= requiredEdge
    );
  }

  function commonPrefixLength(a, b) {
    const limit = Math.min(a.length, b.length);
    let count = 0;
    while (count < limit && a[count] === b[count]) count += 1;
    return count;
  }

  function commonSuffixLength(a, b) {
    const limit = Math.min(a.length, b.length);
    let count = 0;
    while (count < limit && a[a.length - 1 - count] === b[b.length - 1 - count]) count += 1;
    return count;
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

  const api = {
    normalizeText,
    isVowel,
    syllabifyWord,
    splitIntoChunks,
    normalizeConsonant,
    getTextConsonants,
    usesOnlyAllowedConsonants,
    shuffleList,
    evaluateReading,
    chunkMatches,
    scoreMatch,
    getApproximateThreshold,
    getMatchThreshold,
    phoneticKey,
    buildSpokenCandidates,
    canAdvanceWithTranscript,
    findError,
    normalizedDistance,
    diceSimilarity,
    makePairs,
    levenshtein,
  };

  global.LectoVozEvaluation = api;
  Object.assign(global, api);
})(typeof window !== "undefined" ? window : globalThis);
