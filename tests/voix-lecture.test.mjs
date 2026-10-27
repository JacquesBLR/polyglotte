// Lecture vocale web sur iPhone (#129) : aiguillage vers le serveur vocal, repli des langues
// sans voix serveur, file qui avance malgré une pause imposée par iOS, micro distant qui
// coupe la voix. Navigateur simulé : Audio, fetch, speechSynthesis, getUserMedia.

import assert from "node:assert/strict";
import { register } from "node:module";
import { test, beforeEach } from "node:test";

// speech.web.js importe sans extension (résolution Metro) : on complète « .js » pour Node.
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (spec.startsWith(".") && !spec.endsWith(".js")) return next(spec + ".js", ctx);
    throw e;
  }
}`));

// ---------- Navigateur simulé ----------

const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
const UA_BUREAU = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36";

const nav = { userAgent: UA_IPHONE, platform: "iPhone", maxTouchPoints: 5, standalone: true };
Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true, writable: true });

const dits = []; // énoncés passés à speechSynthesis
globalThis.window = globalThis;
globalThis.speechSynthesis = {
  getVoices: () => [{ lang: "es-ES", name: "Mónica" }, { lang: "ja-JP", name: "Kyoko" }],
  speak: (u) => { if (u.text.trim()) dits.push(u.text); },
  cancel: () => {},
};
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };

const lecteurs = [];
globalThis.Audio = class {
  constructor() { this.paused = true; this.ended = false; this.src = ""; lecteurs.push(this); }
  play() { this.paused = false; this.ended = false; return Promise.resolve(); }
  pause() {
    if (this.paused) return;
    this.paused = true;
    setTimeout(() => this.onpause && this.onpause(), 0); // événement asynchrone, comme au navigateur
  }
  // Fin naturelle : `pause` (ended déjà vrai) puis `ended`, dans l'ordre de la spécification.
  finit() { this.paused = true; this.ended = true; this.onpause && this.onpause(); this.onended && this.onended(); }
  // iOS suspend la lecture (écran verrouillé, micro…) : `pause` seul, jamais `ended`.
  suspendParIos() { this.paused = true; this.onpause && this.onpause(); }
};

const requetes = []; // { text, lang }
let sansVoix = new Set(["ja-JP"]);
globalThis.fetch = async (url, init) => {
  const corps = JSON.parse(init.body);
  requetes.push(corps);
  if (sansVoix.has(corps.lang)) return { ok: false, status: 404 };
  return { ok: true, status: 200, blob: async () => new Blob(["RIFF"]) };
};

const attends = () => new Promise((r) => setTimeout(r, 5));

const speech = await import("../app/speech/speech.web.js");

const ES = { ttsPrefixes: ["es"], stt: "es-ES", support: "full", langue: "Espagnol" };
const JA = { ttsPrefixes: ["ja"], stt: "ja-JP", support: "full", langue: "Japonais" };

let avis = [];
beforeEach(() => {
  speech.stopSpeaking();
  nav.userAgent = UA_IPHONE; nav.platform = "iPhone";
  speech.configure({ voiceUrl: "https://serveur.test", onAvis: (t) => avis.push(t) });
  dits.length = 0; requetes.length = 0; avis = [];
  sansVoix = new Set(["ja-JP"]);
});

test("iPhone, espagnol : lu par le serveur vocal, pas par la voix de l'iPhone", async () => {
  speech.speak("Hola, ¿qué tal?", ES);
  await attends();
  assert.deepEqual(requetes.map((r) => r.lang), ["es-ES"]);
  assert.deepEqual(dits, []);
});

test("hors iPhone, espagnol : la voix du navigateur, comme avant", async () => {
  nav.userAgent = UA_BUREAU; nav.platform = "Linux x86_64";
  speech.speak("Hola", ES);
  await attends();
  assert.deepEqual(requetes, []);
  assert.deepEqual(dits, ["Hola"]);
});

test("iPhone, japonais (pas de voix serveur) : repli sur l'iPhone, une seule requête, avis du mode silencieux", async () => {
  speech.speak("こんにちは。", { ...JA, queue: true });
  speech.speak("元気ですか。", { ...JA, queue: true });
  await attends();
  await attends();
  assert.equal(requetes.length, 1, "la langue sans voix n'est plus renvoyée au serveur");
  assert.deepEqual(dits, ["こんにちは。", "元気ですか。"]);
  assert.equal(avis.length, 1);
  assert.match(avis[0], /mode silencieux/);
  assert.doesNotMatch(avis[0], /injoignable/, "un 404 n'est pas une panne");
});

test("pause imposée par iOS : la file avance au lieu de rester bloquée", async () => {
  speech.speak("Primera frase.", { ...ES, queue: true });
  speech.speak("Segunda frase.", { ...ES, queue: true });
  await attends();
  assert.equal(requetes.length, 1);
  const lecteur = lecteurs[0];
  assert.equal(lecteur.paused, false);
  lecteur.suspendParIos(); // pas de `ended` : avant #129, la file s'arrêtait ici pour la séance
  await attends();
  assert.deepEqual(requetes.map((r) => r.text), ["Primera frase.", "Segunda frase."]);
  lecteur.finit();
  speech.speak("Tercera frase.", { ...ES, queue: true });
  await attends();
  assert.equal(requetes.length, 3);
});

test("fin naturelle (pause puis ended) : la phrase suivante n'est lue qu'une fois", async () => {
  speech.speak("Uno.", { ...ES, queue: true });
  speech.speak("Dos.", { ...ES, queue: true });
  speech.speak("Tres.", { ...ES, queue: true });
  await attends();
  lecteurs[0].finit();
  await attends();
  assert.deepEqual(requetes.map((r) => r.text), ["Uno.", "Dos."], "pause + ended ne sautent pas « Tres »");
});

test("stopSpeaking : la pause qu'il provoque ne relance pas la file", async () => {
  speech.speak("Uno.", { ...ES, queue: true });
  speech.speak("Dos.", { ...ES, queue: true });
  await attends();
  speech.stopSpeaking();
  await attends();
  assert.deepEqual(requetes.map((r) => r.text), ["Uno."]);
});

test("micro distant : la voix du tuteur est coupée avant l'enregistrement", async () => {
  nav.mediaDevices = { getUserMedia: async () => ({ getTracks: () => [] }) };
  globalThis.MediaRecorder = class { start() { this.state = "recording"; } stop() {} };
  speech.speak("Uno.", { ...ES, queue: true });
  speech.speak("Dos.", { ...ES, queue: true });
  await attends();
  const lecteur = lecteurs[0];
  assert.equal(lecteur.paused, false);
  const rec = speech.createRecognizer({ lang: "es-ES", support: "full" });
  await rec.start();
  await attends();
  assert.equal(lecteur.paused, true, "le tuteur se tait");
  assert.deepEqual(requetes.map((r) => r.text), ["Uno."], "et la file est vidée, pas reprise");
});
