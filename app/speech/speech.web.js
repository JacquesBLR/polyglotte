// Couche vocale WEB — Web Speech API, portée à l'identique de l'app v1.
// Interface commune avec speech.native.js :
//   ttsAvailable(), pickVoice(ttsPrefixes), speak(text, opts), stopSpeaking(),
//   primeSpeech(), recognitionAvailable(), createRecognizer(opts).

export function ttsAvailable() {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

// ---------- Serveur vocal distant (#45) ----------
// STT (Whisper) et TTS (Piper) servis depuis le DGX (serveur-vocal/). Utilisé
// uniquement pour les langues au support vocal partiel (suisse allemand, tunisien),
// où les moteurs du navigateur sont approximatifs ; repli local en cas d'échec.

const remote = { url: "" };

export function configure({ voiceUrl } = {}) {
  remote.url = (voiceUrl || "").trim().replace(/\/+$/, "");
}

function remoteActive(opts) {
  return !!remote.url && opts.support === "partial";
}

let rQueue = [];
let rCurrent = null; // { audio, url }
let rPlaying = false;

function stopRemoteSpeech() {
  rQueue = [];
  rPlaying = false;
  if (rCurrent) {
    try { rCurrent.audio.pause(); } catch (_) { /* déjà arrêté */ }
    URL.revokeObjectURL(rCurrent.url);
    rCurrent = null;
  }
}

async function pumpRemote() {
  if (rPlaying || !rQueue.length) return;
  rPlaying = true;
  const job = rQueue.shift();
  const done = (fallback) => {
    rPlaying = false;
    if (fallback) speakLocal(job.text, { ...job.opts, queue: true }); // repli voix navigateur
    else if (job.opts.onEnd) job.opts.onEnd();
    pumpRemote();
  };
  try {
    const resp = await fetch(remote.url + "/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: job.text, lang: job.opts.stt || "" }),
    });
    if (!resp.ok) throw new Error();
    const url = URL.createObjectURL(await resp.blob());
    const audio = new Audio(url);
    audio.playbackRate = job.opts.rate || 1;
    rCurrent = { audio, url };
    audio.onended = () => { URL.revokeObjectURL(url); rCurrent = null; done(false); };
    audio.onerror = () => { URL.revokeObjectURL(url); rCurrent = null; done(true); };
    await audio.play();
  } catch (_) {
    if (rCurrent) { URL.revokeObjectURL(rCurrent.url); rCurrent = null; }
    done(true); // serveur injoignable ou pas de voix : repli
  }
}

function createRemoteRecognizer({ lang, onStart, onInterim, onResult, onError, onEnd }) {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia
      || typeof MediaRecorder === "undefined") return null;
  let rec = null;
  return {
    // Appuyer-parler-retoucher : start() enregistre, stop() envoie au serveur.
    async start() {
      if (rec) return;
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (_) {
        if (onError) onError(REC_ERRORS["not-allowed"]);
        return;
      }
      const chunks = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = (rec && rec.mimeType) || "audio/webm";
        rec = null;
        if (onEnd) onEnd();
        if (onInterim) onInterim("transcription en cours…");
        try {
          const fd = new FormData();
          fd.append("file", new Blob(chunks, { type }), "audio.webm");
          fd.append("lang", lang || "");
          const resp = await fetch(remote.url + "/stt", { method: "POST", body: fd });
          if (!resp.ok) throw new Error(`Serveur vocal : erreur ${resp.status}.`);
          const data = await resp.json();
          if (data.text) onResult(data.text);
          else if (onError) onError(REC_ERRORS["no-speech"]);
        } catch (err) {
          if (onError) onError(err.message || "Serveur vocal injoignable.");
        }
      };
      rec.start();
      if (onStart) onStart();
      if (onInterim) onInterim("parle, puis retouche le micro pour envoyer");
    },
    stop() {
      if (rec && rec.state !== "inactive") { try { rec.stop(); } catch (_) { /* déjà arrêté */ } }
    },
  };
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

// `queue: true` ajoute l'énoncé à la file au lieu d'interrompre (streaming phrase
// par phrase). Route vers le serveur vocal (Piper) pour les langues au support
// partiel quand il est configuré ; voix du navigateur sinon.
export function speak(text, opts = {}) {
  if (remoteActive(opts)) {
    if (!opts.queue) {
      stopRemoteSpeech();
      if (ttsAvailable()) window.speechSynthesis.cancel();
    }
    rQueue.push({ text, opts });
    pumpRemote();
    return;
  }
  speakLocal(text, opts);
}

function speakLocal(text, { ttsPrefixes = [], rate = 1, onEnd, queue = false } = {}) {
  const picked = pickVoice(ttsPrefixes);
  if (!ttsAvailable() || !picked) {
    if (onEnd) onEnd();
    return;
  }
  if (!queue) window.speechSynthesis.cancel();
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
  stopRemoteSpeech();
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
export function createRecognizer(opts) {
  if (remoteActive(opts)) return createRemoteRecognizer(opts);
  return createLocalRecognizer(opts);
}

function createLocalRecognizer({ lang, onStart, onInterim, onResult, onError, onEnd }) {
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
