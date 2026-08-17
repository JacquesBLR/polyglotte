// Couche vocale WEB — Web Speech API, portée à l'identique de l'app v1.
// Interface commune avec speech.native.js :
//   ttsAvailable(), pickVoice(ttsPrefixes), speak(text, opts), stopSpeaking(),
//   primeSpeech(), recognitionAvailable(), createRecognizer(opts).

export function ttsAvailable() {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

// Cherche une voix par ordre de préférence des préfixes de locale.
// Retourne { voice, native } (native = premier préfixe trouvé) ou null.
export function pickVoice(ttsPrefixes) {
  if (!ttsAvailable()) return null;
  const voices = window.speechSynthesis.getVoices();
  for (let i = 0; i < ttsPrefixes.length; i++) {
    const prefix = ttsPrefixes[i];
    const found = voices.find(v => v.lang.toLowerCase().replace("_", "-").startsWith(prefix));
    if (found) return { voice: found, native: i === 0, name: found.name, lang: found.lang };
  }
  return null;
}

// Les voix arrivent parfois après le chargement (Chrome) : rappelle cb quand la liste change.
export function onVoicesChanged(cb) {
  if (ttsAvailable()) window.speechSynthesis.onvoiceschanged = cb;
}

export function speak(text, { ttsPrefixes = [], rate = 1, onEnd } = {}) {
  const picked = pickVoice(ttsPrefixes);
  if (!ttsAvailable() || !picked) {
    if (onEnd) onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.voice = picked.voice;
  utter.lang = picked.voice.lang;
  utter.rate = rate;
  let done = false;
  const finish = () => { if (!done) { done = true; if (onEnd) onEnd(); } };
  utter.onend = finish;
  utter.onerror = finish;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking() {
  if (ttsAvailable()) window.speechSynthesis.cancel();
}

// Safari iOS n'autorise la synthèse qu'après un geste utilisateur : à appeler
// depuis le gestionnaire du premier bouton pressé.
export function primeSpeech() {
  if (!ttsAvailable()) return;
  const utter = new SpeechSynthesisUtterance("");
  utter.volume = 0;
  window.speechSynthesis.speak(utter);
}

export function recognitionAvailable() {
  return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

const REC_ERRORS = {
  "not-allowed": "Accès au micro refusé — autorise-le dans les réglages du navigateur, ou écris ta réponse.",
  "no-speech": "Je n'ai rien entendu. Réessaie, ou écris ta réponse.",
  "language-not-supported": "Ce navigateur ne reconnaît pas cette langue à l'oral. Écris tes réponses.",
};

// Retourne { start(), stop() } ou null si la reconnaissance n'est pas disponible.
export function createRecognizer({ lang, onStart, onInterim, onResult, onError, onEnd }) {
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!SR) return null;
  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;

  rec.onstart = () => { if (onStart) onStart(); };
  rec.onresult = (event) => {
    let interim = "", final = "";
    for (const result of event.results) {
      if (result.isFinal) final += result[0].transcript;
      else interim += result[0].transcript;
    }
    if (interim && onInterim) onInterim(interim);
    if (final.trim() && onResult) onResult(final.trim());
  };
  rec.onerror = (event) => {
    if (event.error === "aborted") return;
    if (onError) onError(REC_ERRORS[event.error] || `Erreur du micro (${event.error}). Tu peux écrire ta réponse.`);
  };
  rec.onend = () => { if (onEnd) onEnd(); };

  return {
    start() {
      stopSpeaking();
      try { rec.start(); } catch (_) { /* déjà démarré */ }
    },
    stop() {
      try { rec.stop(); } catch (_) { /* déjà arrêté */ }
    },
  };
}
