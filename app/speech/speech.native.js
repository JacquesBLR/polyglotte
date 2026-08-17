// Couche vocale NATIVE (iOS / Android) — expo-speech pour la synthèse.
// La reconnaissance vocale n'existe pas dans expo-speech : recognitionAvailable()
// renvoie false et l'écran bascule proprement sur la saisie clavier
// (un module natif type expo-speech-recognition sera branché dans l'issue #36).
// Interface identique à speech.web.js.

import * as Speech from "expo-speech";

export function ttsAvailable() {
  return true;
}

// En natif on ne choisit pas une voix précise : on passe la locale du premier
// préfixe et l'OS prend sa meilleure voix. `native` est donc supposé vrai.
export function pickVoice(ttsPrefixes) {
  if (!ttsPrefixes || !ttsPrefixes.length) return null;
  return { voice: null, native: true, name: "voix système", lang: ttsPrefixes[0] };
}

export function onVoicesChanged(_cb) {
  // Les voix système sont disponibles immédiatement : rien à faire.
}

export function speak(text, { ttsPrefixes = [], rate = 1, onEnd } = {}) {
  Speech.stop();
  let done = false;
  const finish = () => { if (!done) { done = true; if (onEnd) onEnd(); } };
  Speech.speak(text, {
    language: ttsPrefixes[0] || undefined,
    rate,
    onDone: finish,
    onStopped: finish,
    onError: finish,
  });
}

export function stopSpeaking() {
  Speech.stop();
}

export function primeSpeech() {
  // Pas de restriction de geste utilisateur en natif.
}

export function recognitionAvailable() {
  return false;
}

export function createRecognizer(_opts) {
  return null;
}
