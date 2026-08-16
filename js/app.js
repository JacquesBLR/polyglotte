/* Polyglotte — apprentissage des langues pour francophones.
 * Conversation orale : reconnaissance vocale (Web Speech API) → Claude → synthèse vocale.
 * L'appel API passe par le proxy local (server.py) quand il est disponible, sinon
 * directement depuis le navigateur (header anthropic-dangerous-direct-browser-access).
 */

"use strict";

const APP_VERSION = "0.2.0";

// ---------- Registre des langues ----------
// Ajouter une langue = ajouter une entrée ici (et une <option> dans index.html).
// stt : locale de reconnaissance vocale ; ttsPrefixes : préfixes de voix par ordre de
// préférence (le premier est la voix « native ») ; reading : type de translittération
// demandée au tuteur (null = alphabet latin, rien à fournir).
const LANGUAGES = {
  catalan: {
    label: "Catalan", langFr: "le catalan",
    tutor: { name: "Núria", city: "Barcelone", f: true },
    stt: "ca-ES", ttsPrefixes: ["ca", "es"],
    rtl: false, reading: null, support: "full",
    voiceHint: "Installe une voix catalane (« Montserrat » sur iOS/macOS) pour la meilleure synthèse ; repli sur une voix espagnole sinon.",
    promptExtra: "Sois attentive aux calques du français et de l'espagnol, fréquents chez les francophones.",
  },
  espagnol: {
    label: "Espagnol", langFr: "l'espagnol",
    tutor: { name: "Carmen", city: "Séville", f: true },
    stt: "es-ES", ttsPrefixes: ["es"],
    rtl: false, reading: null, support: "full", voiceHint: "",
    promptExtra: "Sois attentive aux faux amis français-espagnol et aux confusions ser/estar.",
  },
  anglais: {
    label: "Anglais (GB)", langFr: "l'anglais britannique",
    tutor: { name: "Oliver", city: "Londres", f: false },
    stt: "en-GB", ttsPrefixes: ["en-gb", "en"],
    rtl: false, reading: null, support: "full", voiceHint: "",
    promptExtra: "Utilise l'anglais britannique (vocabulaire, orthographe, expressions). Corrige les calques du français.",
  },
  allemand: {
    label: "Allemand", langFr: "l'allemand",
    tutor: { name: "Lena", city: "Berlin", f: true },
    stt: "de-DE", ttsPrefixes: ["de"],
    rtl: false, reading: null, support: "full", voiceHint: "",
    promptExtra: "Sois attentive aux déclinaisons, aux genres et à l'ordre des mots, difficultés classiques des francophones.",
  },
  suisse: {
    label: "Suisse allemand", langFr: "le suisse allemand",
    tutor: { name: "Reto", city: "Zurich", f: false },
    stt: "de-CH", ttsPrefixes: ["de"],
    rtl: false, reading: null, support: "partial",
    supportNote: "Le suisse allemand n'a pas de moteur vocal dédié : la reconnaissance comprend mieux l'allemand standard que le dialecte, et la voix de synthèse est allemande (prononciation approximative). La conversation écrite, elle, est pleinement en schwiizerdütsch.",
    voiceHint: "Voix allemande utilisée (pas de voix suisse-allemande existante).",
    promptExtra: "Écris en suisse allemand (dialecte zurichois), avec une orthographe dialectale courante. L'élève peut répondre en allemand standard : accepte-le, mais réponds toujours en dialecte. Les transcriptions vocales arrivent souvent déformées vers l'allemand standard : interprète avec bienveillance.",
  },
  ptpt: {
    label: "Portugais (Portugal)", langFr: "le portugais européen",
    tutor: { name: "Inês", city: "Lisbonne", f: true },
    stt: "pt-PT", ttsPrefixes: ["pt-pt", "pt"],
    rtl: false, reading: null, support: "full", voiceHint: "",
    promptExtra: "Utilise le portugais européen (prononciation, usage de « tu »/« você », vocabulaire du Portugal), pas le brésilien.",
  },
  ptbr: {
    label: "Portugais (Brésil)", langFr: "le portugais brésilien",
    tutor: { name: "João", city: "Rio de Janeiro", f: false },
    stt: "pt-BR", ttsPrefixes: ["pt-br", "pt"],
    rtl: false, reading: null, support: "full", voiceHint: "",
    promptExtra: "Utilise le portugais brésilien (« você », vocabulaire et tournures du Brésil).",
  },
  japonais: {
    label: "Japonais", langFr: "le japonais",
    tutor: { name: "Yuki", city: "Tokyo", f: true },
    stt: "ja-JP", ttsPrefixes: ["ja"],
    rtl: false, reading: "le rōmaji (transcription latine) de ta réplique", support: "full", voiceHint: "",
    promptExtra: "Écris en japonais normal (kanji et kana), avec des kanji adaptés au niveau (débutant : kana et kanji très courants uniquement). Utilise la forme polie (-masu/-desu) avec les débutants.",
  },
  arabe: {
    label: "Arabe standard", langFr: "l'arabe standard moderne",
    tutor: { name: "Amina", city: "Le Caire", f: true },
    stt: "ar-SA", ttsPrefixes: ["ar"],
    rtl: true, reading: "une translittération latine de ta réplique", support: "full", voiceHint: "",
    promptExtra: "Utilise l'arabe standard moderne (fusha) en écriture arabe. Pour les débutants, ajoute la voyellation (tachkil) sur les mots difficiles.",
  },
  tunisien: {
    label: "Tunisien (derja)", langFr: "le tunisien (derja)",
    tutor: { name: "Selma", city: "Tunis", f: true },
    stt: "ar-TN", ttsPrefixes: ["ar"],
    // rtl, reading et promptExtra sont résolus selon l'écriture choisie (langConfig).
    rtl: true, reading: null, support: "partial",
    supportNote: "La derja n'a pas de moteur vocal dédié : la reconnaissance passe par l'arabe (approximative pour le dialecte) et la voix de synthèse est en arabe standard. La conversation écrite, elle, est pleinement en tunisien.",
    voiceHint: "Voix arabe standard utilisée (pas de voix tunisienne existante).",
    promptExtraBase: "Tu parles le tunisien (derja), PAS l'arabe standard : vocabulaire et tournures typiquement tunisiens. Les transcriptions vocales de l'élève arrivent souvent déformées vers l'arabe standard : interprète avec bienveillance.",
  },
};

// Résout la configuration effective de la langue choisie (gère l'écriture du tunisien).
function langConfig() {
  const base = LANGUAGES[el.language.value];
  if (el.language.value !== "tunisien") return base;
  const arabicScript = el.tnScript.value === "arabe";
  return {
    ...base,
    rtl: arabicScript,
    reading: arabicScript ? "la version arabizi (alphabet latin, chiffres 3/7/9 pour les sons arabes) de ta réplique" : null,
    promptExtra: base.promptExtraBase + (arabicScript
      ? " Écris tes répliques en écriture arabe."
      : " Écris tes répliques en arabizi : alphabet latin avec les chiffres usuels (3 pour ع, 7 pour ح, 9 pour ق…)."),
  };
}

// ---------- Éléments du DOM ----------
const el = {
  chat: document.getElementById("chat"),
  welcomeCard: document.getElementById("welcome-card"),
  compatWarning: document.getElementById("compat-warning"),
  supportNote: document.getElementById("support-note"),
  btnStart: document.getElementById("btn-start"),
  language: document.getElementById("language"),
  tnScriptRow: document.getElementById("tn-script-row"),
  tnScript: document.getElementById("tn-script"),
  level: document.getElementById("level"),
  scenario: document.getElementById("scenario"),
  inputBar: document.getElementById("input-bar"),
  btnMic: document.getElementById("btn-mic"),
  textInput: document.getElementById("text-input"),
  btnSend: document.getElementById("btn-send"),
  handsfree: document.getElementById("handsfree"),
  suggestions: document.getElementById("suggestions"),
  statusBar: document.getElementById("status-bar"),
  btnNewSession: document.getElementById("btn-new-session"),
  btnSettings: document.getElementById("btn-settings"),
  settingsModal: document.getElementById("settings-modal"),
  btnSettingsClose: document.getElementById("btn-settings-close"),
  apiKey: document.getElementById("api-key"),
  apiKeyLabel: document.getElementById("api-key-label"),
  proxyInfo: document.getElementById("proxy-info"),
  model: document.getElementById("model"),
  voiceRate: document.getElementById("voice-rate"),
  rateValue: document.getElementById("rate-value"),
  autospeak: document.getElementById("autospeak"),
  showTranslations: document.getElementById("show-translations"),
  voiceInfo: document.getElementById("voice-info"),
  appVersion: document.getElementById("app-version"),
  btnSummary: document.getElementById("btn-summary"),
  summaryModal: document.getElementById("summary-modal"),
  summaryContent: document.getElementById("summary-content"),
  btnSummaryClose: document.getElementById("btn-summary-close"),
};

// ---------- État ----------
const state = {
  history: [],          // [{role, content}] — côté assistant, seulement la réplique en langue cible
  started: false,
  busy: false,
  listening: false,
  recognition: null,
  voice: null,          // voix de synthèse retenue pour la langue courante
  voiceNative: false,   // true si la voix correspond au premier préfixe (langue native)
  proxyMode: false,     // true si server.py tourne avec une clé API configurée
};

function hasCredentials() {
  return state.proxyMode || !!el.apiKey.value.trim();
}

async function detectProxy() {
  try {
    const resp = await fetch("/api/health");
    if (!resp.ok) return;
    const health = await resp.json();
    if (health.ok && health.hasKey) {
      state.proxyMode = true;
      el.apiKeyLabel.classList.add("hidden");
      el.proxyInfo.classList.remove("hidden");
    }
  } catch (_) {
    // Pas de serveur local (ex. hébergement statique) : mode direct avec clé dans les réglages.
  }
}

// ---------- Réglages persistés ----------
const SETTINGS_KEY = "polyglotte-settings";
const LEGACY_SETTINGS_KEY = "parla-settings";

function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY))
         || JSON.parse(localStorage.getItem(LEGACY_SETTINGS_KEY)) || {};
  } catch (_) {}
  el.apiKey.value = saved.apiKey || "";
  el.model.value = saved.model || "claude-opus-5";
  el.voiceRate.value = saved.voiceRate || 0.9;
  el.rateValue.textContent = el.voiceRate.value;
  el.autospeak.checked = saved.autospeak !== false;
  el.showTranslations.checked = saved.showTranslations !== false;
  if (saved.language && LANGUAGES[saved.language]) el.language.value = saved.language;
  if (saved.tnScript) el.tnScript.value = saved.tnScript;
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    apiKey: el.apiKey.value.trim(),
    model: el.model.value,
    voiceRate: parseFloat(el.voiceRate.value),
    autospeak: el.autospeak.checked,
    showTranslations: el.showTranslations.checked,
    language: el.language.value,
    tnScript: el.tnScript.value,
  }));
}

// ---------- Synthèse vocale ----------
function refreshVoices() {
  const cfg = langConfig();
  const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  state.voice = null;
  state.voiceNative = false;
  for (let i = 0; i < cfg.ttsPrefixes.length && !state.voice; i++) {
    const prefix = cfg.ttsPrefixes[i];
    const found = voices.find(v => v.lang.toLowerCase().replace("_", "-").startsWith(prefix));
    if (found) {
      state.voice = found;
      state.voiceNative = i === 0;
    }
  }

  if (!window.speechSynthesis) {
    el.voiceInfo.textContent = "⚠️ Synthèse vocale non disponible dans ce navigateur.";
  } else if (!state.voice) {
    el.voiceInfo.textContent = `⚠️ Aucune voix trouvée pour ${cfg.label} — les réponses ne seront pas lues à voix haute.`;
  } else if (state.voiceNative) {
    el.voiceInfo.textContent = `✅ Voix : ${state.voice.name} (${state.voice.lang}). ${cfg.voiceHint || ""}`;
  } else {
    el.voiceInfo.textContent = `ℹ️ Voix de repli : ${state.voice.name} (${state.voice.lang}) — prononciation approximative. ${cfg.voiceHint || ""}`;
  }
}

function speak(text, onEnd) {
  if (!window.speechSynthesis || !state.voice || !el.autospeak.checked) {
    if (onEnd) onEnd();
    return;
  }
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.voice = state.voice;
  utter.lang = state.voice.lang;
  utter.rate = parseFloat(el.voiceRate.value);
  utter.onend = () => { if (onEnd) onEnd(); };
  utter.onerror = () => { if (onEnd) onEnd(); };
  speechSynthesis.speak(utter);
}

function speakIgnoringAutospeak(text) {
  const wasChecked = el.autospeak.checked;
  el.autospeak.checked = true;
  speak(text);
  el.autospeak.checked = wasChecked;
}

// Safari iOS n'autorise la synthèse vocale qu'après un geste de l'utilisateur.
function unlockSpeechSynthesis() {
  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance("");
  utter.volume = 0;
  speechSynthesis.speak(utter);
}

// ---------- Reconnaissance vocale ----------
function initRecognition(sttLang) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = sttLang;
  rec.interimResults = true;
  rec.continuous = false;

  rec.onstart = () => {
    state.listening = true;
    el.btnMic.classList.add("listening");
    setStatus(`🎤 Je t'écoute… parle en ${langConfig().label.toLowerCase()} !`);
  };
  rec.onresult = (event) => {
    let interim = "", final = "";
    for (const result of event.results) {
      if (result.isFinal) final += result[0].transcript;
      else interim += result[0].transcript;
    }
    if (interim) setStatus(`🎤 « ${interim} »`);
    if (final.trim()) sendMessage(final.trim());
  };
  rec.onerror = (event) => {
    stopListeningUI();
    if (event.error === "not-allowed") {
      setStatus("Accès au micro refusé — autorise-le dans les réglages du navigateur, ou écris ta réponse.", true);
    } else if (event.error === "no-speech") {
      setStatus("Je n'ai rien entendu. Réessaie, ou écris ta réponse.");
    } else if (event.error === "language-not-supported") {
      setStatus("Ce navigateur ne reconnaît pas cette langue à l'oral. Écris tes réponses.", true);
    } else if (event.error !== "aborted") {
      setStatus(`Erreur du micro (${event.error}). Tu peux écrire ta réponse.`, true);
    }
  };
  rec.onend = () => stopListeningUI();
  return rec;
}

function stopListeningUI() {
  state.listening = false;
  el.btnMic.classList.remove("listening");
}

function startListening() {
  if (!state.recognition || state.listening || state.busy) return;
  if (window.speechSynthesis) speechSynthesis.cancel();
  try { state.recognition.start(); } catch (_) { /* déjà démarré */ }
}

function stopListening() {
  if (state.recognition && state.listening) state.recognition.stop();
}

// ---------- Interface ----------
function setStatus(text, isError = false) {
  el.statusBar.textContent = text || "";
  el.statusBar.classList.toggle("hidden", !text);
  el.statusBar.classList.toggle("error", isError);
}

function scrollChat() {
  el.chat.scrollTop = el.chat.scrollHeight;
}

function addUserBubble(text) {
  const div = document.createElement("div");
  div.className = "msg user";
  div.innerHTML = `<div class="speaker">Toi</div><div class="target-text" dir="auto"></div>`;
  div.querySelector(".target-text").textContent = text;
  el.chat.appendChild(div);
  scrollChat();
}

function addTutorBubble(reply, translation, reading) {
  const cfg = langConfig();
  const div = document.createElement("div");
  div.className = "msg tutor";
  div.innerHTML = `<div class="speaker"></div><div class="target-text" dir="auto"></div>`;
  div.querySelector(".speaker").textContent = cfg.tutor.name;
  const target = div.querySelector(".target-text");
  target.textContent = reply + " ";
  const btn = document.createElement("button");
  btn.className = "btn-speak";
  btn.title = "Réécouter";
  btn.textContent = "🔊";
  btn.addEventListener("click", () => speakIgnoringAutospeak(reply));
  target.appendChild(btn);
  if (reading) {
    const rd = document.createElement("div");
    rd.className = "reading";
    rd.textContent = reading;
    div.appendChild(rd);
  }
  if (translation && el.showTranslations.checked) {
    const tr = document.createElement("div");
    tr.className = "translation";
    tr.textContent = "🇫🇷 " + translation;
    div.appendChild(tr);
  }
  el.chat.appendChild(div);
  scrollChat();
}

function addCorrection(correction) {
  const div = document.createElement("div");
  div.className = "correction";
  div.innerHTML = `<span class="corr-title">✏️ Correction :</span> <del dir="auto"></del> → <ins dir="auto"></ins><br>`;
  div.querySelector("del").textContent = correction.original;
  div.querySelector("ins").textContent = correction.corrected;
  const expl = document.createElement("span");
  expl.textContent = correction.explanation;
  div.appendChild(expl);
  el.chat.appendChild(div);
  scrollChat();
}

function addSystemNote(text) {
  const div = document.createElement("div");
  div.className = "msg system";
  div.textContent = text;
  el.chat.appendChild(div);
  scrollChat();
}

function showSuggestions(list) {
  el.suggestions.innerHTML = "";
  if (!list || !list.length) { el.suggestions.classList.add("hidden"); return; }
  for (const s of list) {
    const chip = document.createElement("button");
    chip.className = "suggestion-chip";
    chip.dir = "auto";
    chip.textContent = "💬 " + s;
    chip.addEventListener("click", () => sendMessage(s));
    el.suggestions.appendChild(chip);
  }
  el.suggestions.classList.remove("hidden");
}

function updateWelcomeForLanguage() {
  const isTunisian = el.language.value === "tunisien";
  el.tnScriptRow.classList.toggle("hidden", !isTunisian);
  const cfg = langConfig();
  el.supportNote.textContent = cfg.supportNote || "";
  el.supportNote.classList.toggle("hidden", !cfg.supportNote);
  refreshVoices();
}

// ---------- Prompt système ----------
const LEVEL_INSTRUCTIONS = {
  debutant: `L'élève est DÉBUTANT (A1–A2). Utilise des phrases très courtes et simples, les temps
les plus basiques, du vocabulaire de base. Une seule question à la fois.`,
  intermediaire: `L'élève est INTERMÉDIAIRE (B1–B2). Utilise des phrases naturelles de longueur moyenne,
temps du passé et du futur inclus. Introduis progressivement du vocabulaire nouveau et des expressions courantes.`,
  avance: `L'élève est AVANCÉ (C1). Parle comme avec un natif : registres variés, expressions
idiomatiques, structures complexes, sujets riches. Corrige aussi les nuances de style et les calques du français.`,
};

function scenarioInstructions(cfg) {
  const city = cfg.tutor.city;
  const server = cfg.tutor.f ? "serveuse" : "serveur";
  const merchant = cfg.tutor.f ? "marchande" : "marchand";
  return {
    libre: "Conversation libre : choisis des sujets de la vie quotidienne qui font parler l'élève.",
    cafe: `Jeu de rôle : tu es ${server} dans un café/restaurant de ${city}, l'élève est client. Fais-le commander, poser des questions sur le menu, payer.`,
    marche: `Jeu de rôle : tu es ${merchant} sur un marché de ${city}, l'élève fait ses courses (produits, quantités, prix).`,
    directions: `Jeu de rôle : l'élève est perdu à ${city} et te demande son chemin. Travaille les directions, les lieux, les transports.`,
    presentations: "Jeu de rôle : première rencontre. Travaille les présentations : nom, origine, métier, goûts, famille.",
    voyage: `Jeu de rôle : l'élève prépare ou vit un voyage à ${city} (hôtel, billets, visites, restaurants).`,
    travail: `Jeu de rôle : contexte professionnel à ${city} (réunions, collègues, petites conversations de bureau).`,
  }[el.scenario.value];
}

function buildSystemPrompt() {
  const cfg = langConfig();
  const role = cfg.tutor.f ? "une tutrice chaleureuse et encourageante" : "un tuteur chaleureux et encourageant";
  const readingRule = cfg.reading
    ? `- "reading" : ${cfg.reading}.`
    : `- "reading" : mets toujours null (langue à alphabet latin).`;
  return `Tu es ${cfg.tutor.name}, ${role}, spécialiste de ${cfg.langFr}, et tu vis à ${cfg.tutor.city}.
Ton élève est francophone et apprend ${cfg.langFr} par la CONVERSATION ORALE. Tes réponses seront lues à voix haute
par une synthèse vocale : écris uniquement du texte prononçable (pas de listes, pas d'astérisques, pas d'emojis dans "reply").

${LEVEL_INSTRUCTIONS[el.level.value]}

${scenarioInstructions(cfg)}

Spécificités de la langue : ${cfg.promptExtra}

Règles :
- "reply" : ta réplique EN ${cfg.langFr.toUpperCase().replace(/^L[E'’A]\s*/, "")} uniquement, 1 à 3 phrases, qui se termine le plus souvent par une question pour relancer l'élève.
- "translation" : la traduction française fidèle de "reply".
${readingRule}
- "correction" : si le dernier message de l'élève contient une erreur (grammaire, vocabulaire, calque du français),
  remplis l'objet correction avec la phrase erronée, la version corrigée et une explication BRÈVE en français.
  Ne corrige que si tu es certain de l'erreur ET de la correction : dans le doute, ou si "original" et "corrected"
  seraient identiques, mets correction à null. S'il n'y a pas d'erreur significative, ou si l'élève a écrit en
  français, mets correction à null. Une seule correction à la fois : la plus importante.
- "suggestions" : 2 ou 3 réponses possibles courtes dans la langue cible que l'élève pourrait te dire ensuite, adaptées à son niveau.
- Si l'élève parle français, réponds quand même dans la langue cible (simplement), sans le pénaliser.
- Le message spécial "[START]" signifie que l'élève démarre la conversation : salue-le dans la langue cible et lance le scénario.
- Note : l'historique ne contient que tes répliques dans la langue cible, sans les traductions ni corrections précédentes.`;
}

// ---------- Appels à l'API Claude ----------
const API_URL = "https://api.anthropic.com/v1/messages";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Réplique du tuteur dans la langue cible, 1 à 3 phrases prononçables." },
    translation: { type: "string", description: "Traduction française de reply." },
    reading: {
      anyOf: [
        { type: "null" },
        { type: "string", description: "Translittération latine de reply (rōmaji, arabizi…) pour les langues à écriture non latine." },
      ],
    },
    correction: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            original: { type: "string", description: "Ce que l'élève a dit, avec l'erreur." },
            corrected: { type: "string", description: "La version correcte dans la langue cible." },
            explanation: { type: "string", description: "Explication brève en français." },
          },
          required: ["original", "corrected", "explanation"],
          additionalProperties: false,
        },
      ],
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
      description: "2 ou 3 réponses possibles dans la langue cible pour l'élève.",
    },
  },
  required: ["reply", "translation", "reading", "correction", "suggestions"],
  additionalProperties: false,
};

function apiHeaders(model) {
  const headers = { "content-type": "application/json" };
  if (!state.proxyMode) {
    headers["x-api-key"] = el.apiKey.value.trim();
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  }
  // Repli serveur recommandé sur Opus 5 (transmis par server.py en mode proxy).
  if (model === "claude-opus-5") {
    headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
  }
  return headers;
}

async function callClaude({ messages, structured }) {
  const model = el.model.value;
  const body = {
    model,
    max_tokens: 2048,
    system: buildSystemPrompt(),
    messages,
  };
  if (model === "claude-opus-5") {
    body.fallbacks = "default";
  }
  const outputConfig = {};
  // "effort" n'est pas supporté par Haiku 4.5 (la requête serait rejetée).
  if (model !== "claude-haiku-4-5") outputConfig.effort = "low";
  if (structured) outputConfig.format = { type: "json_schema", schema: RESPONSE_SCHEMA };
  if (Object.keys(outputConfig).length) body.output_config = outputConfig;

  const resp = await fetch(state.proxyMode ? "/api/chat" : API_URL, {
    method: "POST",
    headers: apiHeaders(model),
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    let detail = "";
    try { detail = (await resp.json()).error?.message || ""; } catch (_) {}
    if (resp.status === 401) throw new Error("Clé API invalide. Vérifie-la dans les réglages ⚙️.");
    if (resp.status === 429) throw new Error("Limite de requêtes atteinte. Attends un instant puis réessaie.");
    if (detail.includes("credit balance")) {
      throw new Error("Crédits API épuisés : recharge sur console.anthropic.com → Plans & Billing.");
    }
    throw new Error(`Erreur API (${resp.status})${detail ? " : " + detail : ""}`);
  }

  const data = await resp.json();
  if (data.stop_reason === "refusal") {
    throw new Error("La requête a été refusée par les filtres de sécurité du modèle. Reformule et réessaie.");
  }
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  if (!text) throw new Error("Réponse vide du modèle.");
  return text;
}

// ---------- Logique de conversation ----------
async function sendMessage(userText, { display = true } = {}) {
  if (state.busy) return;
  if (!hasCredentials()) {
    setStatus("Ajoute d'abord ta clé API Anthropic dans les réglages ⚙️ (ou lance server.py avec ANTHROPIC_API_KEY).", true);
    openModal(el.settingsModal);
    return;
  }

  stopListening();
  state.busy = true;
  el.btnSend.disabled = true;
  el.btnMic.disabled = true;
  showSuggestions(null);
  if (display) addUserBubble(userText);
  setStatus(`${langConfig().tutor.name} réfléchit…`);

  state.history.push({ role: "user", content: userText });

  try {
    const raw = await callClaude({ messages: state.history, structured: true });
    const parsed = JSON.parse(raw);

    // On ne garde dans l'historique que la réplique en langue cible (concis + naturel).
    state.history.push({ role: "assistant", content: parsed.reply });

    // Filet de sécurité contre les corrections « à vide » (original == corrigé).
    if (parsed.correction &&
        parsed.correction.original.trim().toLowerCase() !== parsed.correction.corrected.trim().toLowerCase()) {
      addCorrection(parsed.correction);
    }
    addTutorBubble(parsed.reply, parsed.translation, parsed.reading);
    showSuggestions(parsed.suggestions);
    setStatus("");
    el.btnSummary.disabled = false;

    speak(parsed.reply, () => {
      if (el.handsfree.checked && state.started) startListening();
    });
  } catch (err) {
    // On retire le tour utilisateur non abouti pour pouvoir renvoyer proprement.
    if (state.history[state.history.length - 1]?.role === "user") state.history.pop();
    setStatus(err.message, true);
  } finally {
    state.busy = false;
    el.btnSend.disabled = false;
    el.btnMic.disabled = false;
  }
}

async function generateSummary() {
  openModal(el.summaryModal);
  el.summaryContent.textContent = "Génération du résumé…";
  try {
    const cfg = langConfig();
    const messages = [
      ...state.history,
      {
        role: "user",
        content: `[Fin de session] En FRANÇAIS, fais un résumé pédagogique de notre conversation :
1. Le vocabulaire important vu aujourd'hui en ${cfg.langFr} (mot → traduction française${cfg.reading ? ", avec translittération latine" : ""}).
2. Les erreurs que j'ai faites et les points de grammaire à retenir.
3. Deux ou trois phrases utiles à réviser.
Réponds en texte simple, sans tableau.`,
      },
    ];
    el.summaryContent.textContent = await callClaude({ messages, structured: false });
  } catch (err) {
    el.summaryContent.textContent = "Erreur : " + err.message;
  }
}

// ---------- Modales ----------
function openModal(modal) { modal.classList.remove("hidden"); }
function closeModal(modal) { modal.classList.add("hidden"); }

// ---------- Démarrage ----------
function startConversation() {
  unlockSpeechSynthesis();
  if (!hasCredentials()) {
    openModal(el.settingsModal);
    setStatus("Ajoute d'abord ta clé API Anthropic, puis relance la conversation.", true);
    return;
  }
  const cfg = langConfig();
  state.started = true;
  state.history = [];
  saveSettings();

  // La reconnaissance est (ré)initialisée avec la locale de la langue choisie.
  state.recognition = initRecognition(cfg.stt);
  refreshVoices();

  el.welcomeCard.classList.add("hidden");
  el.inputBar.classList.remove("hidden");
  el.btnNewSession.classList.remove("hidden");
  const levelLabel = el.level.options[el.level.selectedIndex].text;
  const scenarioLabel = el.scenario.options[el.scenario.selectedIndex].text;
  addSystemNote(`Session — ${cfg.label} · ${levelLabel} · ${scenarioLabel} — avec ${cfg.tutor.name} (${cfg.tutor.city})`);
  if (cfg.support !== "full" && cfg.supportNote) addSystemNote("⚠️ " + cfg.supportNote);
  sendMessage("[START]", { display: false });
}

function init() {
  el.appVersion.textContent = "v" + APP_VERSION;
  loadSettings();
  detectProxy();

  // Compatibilité navigateur
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    el.compatWarning.textContent =
      "⚠️ La reconnaissance vocale n'est pas disponible dans ce navigateur (utilise Chrome, Edge ou Safari). Tu pourras quand même écrire tes réponses.";
    el.compatWarning.classList.remove("hidden");
    el.btnMic.disabled = true;
    el.handsfree.disabled = true;
  }
  if (window.speechSynthesis) {
    refreshVoices();
    speechSynthesis.onvoiceschanged = refreshVoices;
  } else {
    refreshVoices();
  }
  updateWelcomeForLanguage();

  // Événements
  el.btnStart.addEventListener("click", startConversation);
  el.btnNewSession.addEventListener("click", () => location.reload());
  el.language.addEventListener("change", () => { updateWelcomeForLanguage(); saveSettings(); });
  el.tnScript.addEventListener("change", () => { updateWelcomeForLanguage(); saveSettings(); });
  el.btnMic.addEventListener("click", () => (state.listening ? stopListening() : startListening()));
  el.btnSend.addEventListener("click", () => {
    const text = el.textInput.value.trim();
    if (text) { el.textInput.value = ""; sendMessage(text); }
  });
  el.textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") el.btnSend.click();
  });

  el.btnSettings.addEventListener("click", () => openModal(el.settingsModal));
  el.btnSettingsClose.addEventListener("click", () => { saveSettings(); closeModal(el.settingsModal); });
  el.voiceRate.addEventListener("input", () => { el.rateValue.textContent = el.voiceRate.value; });
  for (const input of [el.apiKey, el.model, el.autospeak, el.showTranslations, el.voiceRate]) {
    input.addEventListener("change", saveSettings);
  }

  el.btnSummary.addEventListener("click", generateSummary);
  el.btnSummaryClose.addEventListener("click", () => closeModal(el.summaryModal));
}

init();
