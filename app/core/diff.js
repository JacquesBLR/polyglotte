// Correction mot à mot des dictées et exercices de prononciation — fonctions pures.

// Normalisation : casse, ponctuation (latine, arabe ، ؛ ؟, japonaise), diacritiques arabes,
// tatweel ـ et emoji ; le japonais est comparé caractère par caractère (pas d'espaces). Une entrée
// nulle (reconnaissance vocale muette) vaut une chaîne vide.
export function normalizeTokens(text, langId) {
  let t = String(text ?? "").toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")
    // Emoji (et leurs sélecteurs / liants) : jamais prononcés, ils faisaient un jeton
    // impossible à reconnaître (#101, P6).
    // Drapeaux (indicateurs régionaux) et touches numérotées (1️⃣ : chiffre + U+20E3) :
    // relecture du 12/10, P6b — le chiffre d'une touche est retiré avec elle.
    .replace(/[0-9#*]\u{FE0F}?\u{20E3}/gu, " ")
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}]/gu, " ")
    .replace(/[.,;:!?¿¡«»"“”'’‘…()\-—、。，！？「」『』〜・،؛؟]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (langId === "japonais") return [...t.replace(/ /g, "")];
  return t ? t.split(" ") : [];
}

// Indices des jetons de `target` retrouvés dans `attempt` (alignement LCS).
export function lcsMatchedIndices(target, attempt) {
  const m = target.length, n = attempt.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = target[i] === attempt[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const matched = new Set();
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (target[i] === attempt[j]) { matched.add(i); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return matched;
}

// Évalue une tentative : { tokens, matched (Set d'indices), score (0-100), isCharBased }.
export function gradeAttempt(targetText, attemptText, langId) {
  const tokens = normalizeTokens(targetText, langId);
  const attempt = normalizeTokens(attemptText, langId);
  const matched = lcsMatchedIndices(tokens, attempt);
  const score = tokens.length ? Math.round((matched.size / tokens.length) * 100) : 0;
  return { tokens, matched, score, isCharBased: langId === "japonais" };
}
