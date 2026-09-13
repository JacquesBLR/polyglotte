// Couche vocale NATIVE (iOS / Android) — interface identique à speech.web.js :
//   ttsAvailable(), configure(opts), pickVoice(ttsPrefixes), onVoicesChanged(cb),
//   speak(text, opts), stopSpeaking(), primeSpeech(), recognitionAvailable(),
//   createRecognizer(opts).
//
// Deux moteurs, comme sur le web :
//   - système : expo-speech pour la synthèse, expo-speech-recognition pour la
//     reconnaissance (SFSpeechRecognizer sur iOS, SpeechRecognizer sur Android) ;
//   - serveur vocal du DGX (Whisper + Piper) pour les langues au support
//     *partiel* quand son URL est configurée (#45), avec repli sur le système.
//
// expo-speech-recognition est un module natif tiers : absent de l'app Expo Go,
// il n'existe que dans un build de développement (#37). Son chargement est donc
// tenté paresseusement — sans lui, l'écran bascule proprement sur le clavier.

import {
  AudioModule, AudioQuality, IOSOutputFormat, createAudioPlayer,
  requestRecordingPermissionsAsync, setAudioModeAsync,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import * as Speech from "expo-speech";
import { Platform } from "react-native";

export function ttsAvailable() {
  return true;
}

// ---------- Reconnaissance système (module natif optionnel) ----------

let srModule;
function speechRecognition() {
  if (srModule === undefined) {
    try {
      srModule = require("expo-speech-recognition").ExpoSpeechRecognitionModule;
    } catch (_) {
      srModule = null; // binaire sans le module natif (Expo Go) : saisie clavier
    }
  }
  return srModule;
}

// ---------- Serveur vocal distant (#45) ----------

const remote = { url: "" };

export function configure({ voiceUrl } = {}) {
  remote.url = (voiceUrl || "").trim().replace(/\/+$/, "");
}

function remoteActive(opts) {
  return !!remote.url && opts.support === "partial";
}

// ---------- Synthèse ----------

let rQueue = [];
let rCurrent = null; // { player, file, sub }
let rPlaying = false;
let ttsSeq = 0;

function disposeCurrent() {
  if (!rCurrent) return;
  const { player, file, sub } = rCurrent;
  rCurrent = null;
  try { sub.remove(); } catch (_) { /* déjà retiré */ }
  try { player.remove(); } catch (_) { /* déjà libéré */ }
  try { file.delete(); } catch (_) { /* déjà supprimé */ }
}

function stopRemoteSpeech() {
  rQueue = [];
  rPlaying = false;
  disposeCurrent();
}

async function pumpRemote() {
  if (rPlaying || !rQueue.length) return;
  rPlaying = true;
  const job = rQueue.shift();
  const done = (fallback) => {
    rPlaying = false;
    if (fallback) speakLocal(job.text, { ...job.opts, queue: true }); // repli voix système
    else if (job.opts.onEnd) job.opts.onEnd();
    pumpRemote();
  };
  let file = null;
  try {
    const resp = await fetch(remote.url + "/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: job.text, lang: job.opts.stt || "" }),
    });
    if (!resp.ok) throw new Error();
    // Piper renvoie du WAV : on l'écrit dans le cache, le lecteur lit un fichier.
    const bytes = new Uint8Array(await resp.arrayBuffer());
    file = new File(Paths.cache, `polyglotte-tts-${Date.now()}-${ttsSeq++}.wav`);
    file.create({ overwrite: true });
    file.writeBytes(bytes);

    // Sur iOS, laisser la session en mode enregistrement rend la lecture inaudible.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const player = createAudioPlayer(file.uri);
    player.setPlaybackRate(job.opts.rate || 1);
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) { disposeCurrent(); done(false); }
      else if (status.error) { disposeCurrent(); done(true); }
    });
    rCurrent = { player, file, sub };
    player.play();
  } catch (_) {
    disposeCurrent();
    if (file) { try { file.delete(); } catch (__) { /* jamais créé */ } }
    done(true); // serveur injoignable ou pas de voix : repli
  }
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

// `queue: true` ajoute l'énoncé à la file au lieu d'interrompre (streaming phrase
// par phrase). Route vers le serveur vocal (Piper) pour les langues au support
// partiel quand il est configuré ; voix système sinon.
export function speak(text, opts = {}) {
  if (remoteActive(opts)) {
    if (!opts.queue) {
      stopRemoteSpeech();
      Speech.stop();
    }
    rQueue.push({ text, opts });
    pumpRemote();
    return;
  }
  speakLocal(text, opts);
}

function speakLocal(text, { ttsPrefixes = [], rate = 1, onEnd, queue = false } = {}) {
  if (!queue) Speech.stop();
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
  stopRemoteSpeech();
  Speech.stop();
}

export function primeSpeech() {
  // Pas de restriction de geste utilisateur en natif.
}

// ---------- Reconnaissance ----------

const REC_ERRORS = {
  "not-allowed": "Accès au micro refusé — autorise-le dans les réglages de l'appareil, ou écris ta réponse.",
  "service-not-allowed": "Accès à la reconnaissance vocale refusé — autorise-le dans les réglages de l'appareil, ou écris ta réponse.",
  "no-speech": "Je n'ai rien entendu. Réessaie, ou écris ta réponse.",
  "language-not-supported": "Cet appareil ne reconnaît pas cette langue à l'oral. Écris tes réponses.",
  "audio-capture": "Le micro est indisponible. Tu peux écrire ta réponse.",
  network: "Reconnaissance vocale injoignable (réseau). Tu peux écrire ta réponse.",
};

export function recognitionAvailable() {
  const SR = speechRecognition();
  if (!SR) return false;
  try {
    return SR.isRecognitionAvailable();
  } catch (_) {
    return false;
  }
}

// Retourne { start(), stop() } ou null si la reconnaissance n'est pas disponible.
export function createRecognizer(opts) {
  if (remoteActive(opts)) return createRemoteRecognizer(opts);
  return createLocalRecognizer(opts);
}

function createLocalRecognizer({ lang, onStart, onInterim, onResult, onError, onEnd }) {
  const SR = speechRecognition();
  if (!SR || !recognitionAvailable()) return null;
  let subs = [];
  let final = "";

  const cleanup = () => {
    for (const s of subs) { try { s.remove(); } catch (_) { /* déjà retiré */ } }
    subs = [];
  };

  return {
    async start() {
      stopSpeaking();
      cleanup();
      final = "";
      const perm = await SR.requestPermissionsAsync();
      if (!perm.granted) {
        if (onError) onError(REC_ERRORS["not-allowed"]);
        return;
      }
      subs = [
        SR.addListener("start", () => { if (onStart) onStart(); }),
        SR.addListener("result", (event) => {
          const text = event.results?.[0]?.transcript || "";
          if (!text) return;
          if (event.isFinal) final = text.trim();
          else if (onInterim) onInterim(text);
        }),
        SR.addListener("error", (event) => {
          if (event.error === "aborted") return;
          if (onError) {
            onError(REC_ERRORS[event.error]
              || `Erreur du micro (${event.error}). Tu peux écrire ta réponse.`);
          }
        }),
        // Sur iOS, le résultat final n'arrive qu'une fois la session terminée :
        // on n'envoie le tour qu'à la fermeture, jamais deux fois.
        SR.addListener("end", () => {
          cleanup();
          if (onEnd) onEnd();
          if (final && onResult) onResult(final);
          final = "";
        }),
      ];
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        SR.start({ lang, interimResults: true, continuous: false, addsPunctuation: true });
      } catch (_) {
        cleanup();
        if (onError) onError("La reconnaissance vocale n'a pas démarré. Tu peux écrire ta réponse.");
        if (onEnd) onEnd();
      }
    },
    stop() {
      try { SR.stop(); } catch (_) { /* déjà arrêté */ }
    },
  };
}

// Whisper reçoit de l'AAC 16 kHz mono : assez pour la parole, léger à téléverser.
// Options déjà aplaties par plateforme (ce que la couche native attend).
const REC_OPTIONS = Platform.select({
  ios: {
    extension: ".m4a",
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    extension: ".m4a",
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    outputFormat: "mpeg4",
    audioEncoder: "aac",
  },
  default: { extension: ".m4a", sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
});

// Appuyer-parler-retoucher, comme sur le web : start() enregistre, stop() envoie
// l'audio au serveur vocal, la transcription revient en un seul tour.
function createRemoteRecognizer({ lang, onStart, onInterim, onResult, onError, onEnd }) {
  let recorder = null;

  return {
    async start() {
      if (recorder) return;
      stopSpeaking();
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        if (onError) onError(REC_ERRORS["not-allowed"]);
        return;
      }
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        recorder = new AudioModule.AudioRecorder(REC_OPTIONS);
        await recorder.prepareToRecordAsync();
        recorder.record();
      } catch (_) {
        recorder = null;
        if (onError) onError(REC_ERRORS["audio-capture"]);
        return;
      }
      if (onStart) onStart();
      if (onInterim) onInterim("parle, puis retouche le micro pour envoyer");
    },

    async stop() {
      const rec = recorder;
      if (!rec) return;
      recorder = null;
      let uri = null;
      try {
        await rec.stop();
        uri = rec.uri;
      } catch (_) { /* enregistrement déjà interrompu */ }
      if (onEnd) onEnd();
      if (!uri) {
        if (onError) onError(REC_ERRORS["audio-capture"]);
        return;
      }
      if (onInterim) onInterim("transcription en cours…");
      try {
        const fd = new FormData();
        fd.append("file", { uri, name: "audio.m4a", type: "audio/m4a" });
        fd.append("lang", lang || "");
        const resp = await fetch(remote.url + "/stt", { method: "POST", body: fd });
        if (!resp.ok) throw new Error(`Serveur vocal : erreur ${resp.status}.`);
        const data = await resp.json();
        if (data.text) onResult(data.text);
        else if (onError) onError(REC_ERRORS["no-speech"]);
      } catch (err) {
        if (onError) onError(err.message || "Serveur vocal injoignable.");
      } finally {
        try { new File(uri).delete(); } catch (_) { /* déjà supprimé */ }
      }
    },
  };
}
