// Couche vocale WEB — Web Speech API, portée à l'identique de l'app v1.
// Interface commune avec speech.native.js :
//   ttsAvailable(), pickVoice(ttsPrefixes), speak(text, opts), stopSpeaking(),
//   primeSpeech(), recognitionAvailable(), createRecognizer(opts),
//   messageMicroIndisponible().

import { choisitMicro } from "../core/micro";
import { choisitVoix } from "../core/voix";

export function ttsAvailable() {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

// ---------- Serveur vocal distant (#45) ----------
// STT (Whisper) et TTS (Piper) servis depuis le DGX (serveur-vocal/). Préféré pour les
// langues au support vocal partiel (suisse allemand, tunisien), où les moteurs du
// navigateur sont approximatifs, et pris en repli partout où ceux-ci font défaut : app
// installée sur iPhone pour le micro (#65), liste de voix vide pour la synthèse (#67).
// Le repli joue dans les deux sens, sans aller-retour (voir core/voix.js).

const remote = { url: "", onAvis: null };

// Signalés une fois chacun, pas à chaque phrase : répéter le même avertissement à chaque
// réplique noierait la conversation. Les drapeaux retombent à chaque changement de réglage.
const avisDonnes = { muet: false, repli: false };

export function configure({ voiceUrl, onAvis } = {}) {
  remote.url = (voiceUrl || "").trim().replace(/\/+$/, "");
  remote.onAvis = onAvis || null;
  avisDonnes.muet = false;
  avisDonnes.repli = false;
}

function avise(cle, texte) {
  if (avisDonnes[cle] || !remote.onAvis) return;
  avisDonnes[cle] = true;
  remote.onAvis(texte);
}

function signaleMuet() {
  avise(
    "muet",
    "Aucune voix disponible pour lire la réponse — vérifie l'URL du serveur vocal dans ⚙️ "
    + "(et ta connexion au réseau du serveur). Le texte reste lisible à l'écran.",
  );
}

// Le repli du serveur vocal vers une voix du navigateur n'est pas anodin pour les langues
// au support partiel : la voix de secours est dans une tout autre variante (#75). Sur
// iPhone, le tunisien est alors lu par la voix arabe standard du système. Rien ne distingue
// ce cas, à l'oreille, d'un serveur qui aurait répondu — d'où cet avis.
function signaleRepli(opts) {
  if (opts.support === "partial") {
    const langue = opts.langue ? ` en ${opts.langue.toLowerCase()}` : "";
    avise(
      "repli",
      `Serveur vocal injoignable : la réponse est lue par une voix du navigateur, qui n'est `
      + `pas${langue}. Vérifie ta connexion au réseau du serveur, ou son URL dans ⚙️.`,
    );
    return;
  }
  // Langue qui préfère le serveur pour la seule qualité de la voix (#79) : le repli reste
  // dans la bonne langue, mais se reconnaît à l'oreille. Le dire évite de croire l'app cassée.
  if (opts.voixServeur) {
    avise(
      "repli",
      "Serveur vocal injoignable : la réponse est lue par la voix du navigateur, de moins "
      + "bonne qualité. Vérifie ta connexion au réseau du serveur, ou son URL dans ⚙️.",
    );
  }
}

// Un seul élément <audio>, réutilisé pour toutes les lectures distantes (#77). Safari iOS
// n'autorise la lecture que sur un élément débloqué par un geste utilisateur : un
// `new Audio()` construit à chaque réplique, hors du gestionnaire d'appui, voit son
// `play()` rejeté — l'audio arrivait bien du serveur et ne sortait jamais du haut-parleur.
// Le déblocage vaut pour l'élément, pas pour la page : d'où l'instance unique.
let lecteur = null;
// WAV mono d'un seul échantillon muet : de quoi débloquer l'élément sans rien faire
// entendre.
const SILENCE = "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==";

function getLecteur() {
  if (!lecteur && typeof Audio !== "undefined") lecteur = new Audio();
  return lecteur;
}

let rQueue = [];
let rCurrent = null; // { audio, url }
let rPlaying = false;
let rGen = 0; // incrémenté par stopSpeaking() : périme les lectures en vol

function stopRemoteSpeech() {
  rQueue = [];
  rPlaying = false;
  rGen++;
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
  const gen = rGen;
  const done = (fallback) => {
    if (gen !== rGen) return; // arrêté entre-temps : ne pas relancer la file
    rPlaying = false;
    // Repli voix du navigateur. `repliEpuise` interdit de revenir au serveur : sans lui,
    // un appareil sans voix renverrait la phrase au serveur qui vient d'échouer.
    if (fallback) {
      signaleRepli(job.opts);
      speak(job.text, { ...job.opts, queue: true, repliEpuise: true });
    }
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
    const blob = await resp.blob();
    // stopSpeaking() a pu tomber pendant la requête : ne pas parler quand même.
    if (gen !== rGen) return;
    const url = URL.createObjectURL(blob);
    const audio = getLecteur();
    if (!audio) throw new Error("pas de lecteur audio");
    audio.src = url;
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

// App installée sur l'écran d'accueil d'un iPhone. `navigator.standalone` est propre à
// Safari iOS : ailleurs il est indéfini, et une PWA Android ou bureau garde donc la
// reconnaissance du navigateur, qui y fonctionne.
function autonomeIos() {
  return typeof window !== "undefined" && window.navigator?.standalone === true;
}

// Le moteur distant a besoin du micro et d'un enregistreur, en plus d'une URL de serveur.
function distantUtilisable() {
  return !!remote.url
    && typeof navigator !== "undefined"
    && !!navigator.mediaDevices?.getUserMedia
    && typeof MediaRecorder !== "undefined";
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
  // La voix est cherchée ici, et non dans speakLocal : c'est elle qui décide de
  // l'aiguillage. Une liste de voix encore vide (iOS avant la première synthèse) donne
  // `null`, et la réplique part alors au serveur vocal au lieu de se perdre.
  const picked = ttsAvailable() ? pickVoice(opts.ttsPrefixes || []) : null;
  const choix = choisitVoix({
    support: opts.support,
    voixServeur: !!opts.voixServeur,
    voixNavigateur: !!picked,
    distantDisponible: !!remote.url,
    repliEpuise: !!opts.repliEpuise,
  });
  if (choix === "distant") {
    if (!opts.queue) {
      stopRemoteSpeech();
      if (ttsAvailable()) window.speechSynthesis.cancel();
    }
    rQueue.push({ text, opts });
    pumpRemote();
    return;
  }
  if (choix === "local") {
    speakLocal(text, opts, picked);
    return;
  }
  signaleMuet();
  if (opts.onEnd) opts.onEnd();
}

function speakLocal(text, { rate = 1, onEnd, queue = false } = {}, picked) {
  if (!picked) {
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
  // Déblocage de la lecture audio (#77) : à faire ici, car primeSpeech() est appelé
  // depuis le gestionnaire du bouton qui lance la conversation — le seul moment où iOS
  // l'autorise. Sans cela, la voix du serveur vocal n'est jamais audible sur iPhone.
  const audio = getLecteur();
  if (audio) {
    try {
      audio.src = SILENCE;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {
      // Navigateur sans lecture audio : le repli voix du navigateur reste possible.
    }
  }
  if (!ttsAvailable()) return;
  // Une chaîne vide peut être ignorée par le moteur. Or sur iOS la liste des voix reste
  // vide tant que la synthèse n'a pas servi une fois : amorcer avec du vide, c'est ne
  // jamais amorcer, et toutes les répliques suivantes tombent sans voix (#67).
  const utter = new SpeechSynthesisUtterance(" ");
  utter.volume = 0;
  window.speechSynthesis.speak(utter);
  window.speechSynthesis.getVoices(); // déclenche le chargement asynchrone de la liste
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
  const choix = choisitMicro({
    support: opts.support,
    autonomeIos: autonomeIos(),
    distantDisponible: distantUtilisable(),
    localDisponible: recognitionAvailable(),
  });
  if (choix === "distant") return createRemoteRecognizer(opts);
  if (choix === "local") return createLocalRecognizer(opts);
  return null;
}

// Message affiché quand aucun moteur n'est utilisable : dire *pourquoi* et quoi faire,
// plutôt que de constater l'absence.
export function messageMicroIndisponible() {
  if (autonomeIos() && !remote.url) {
    return "Sur iOS, une app installée sur l'écran d'accueil ne peut pas utiliser la "
      + "reconnaissance du navigateur. Renseigne l'URL du serveur vocal dans ⚙️, ouvre le "
      + "site dans Safari, ou écris tes réponses.";
  }
  return "La reconnaissance vocale n'est pas disponible ici — écris tes réponses.";
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
