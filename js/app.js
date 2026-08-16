/* Parla! — tuteur de catalan pour francophones.
 * Conversation orale : reconnaissance vocale (Web Speech API) → Claude → synthèse vocale.
 * L'appel API se fait directement depuis le navigateur (header anthropic-dangerous-direct-browser-access) ;
 * la clé reste dans le localStorage de l'utilisateur.
 */

"use strict";

// ---------- Éléments du DOM ----------
const el = {
  chat: document.getElementById("chat"),
  welcomeCard: document.getElementById("welcome-card"),
  compatWarning: document.getElementById("compat-warning"),
  btnStart: document.getElementById("btn-start"),
  level: document.getElementById("level"),
  scenario: document.getElementById("scenario"),
  inputBar: document.getElementById("input-bar"),
  btnMic: document.getElementById("btn-mic"),
  textInput: document.getElementById("text-input"),
  btnSend: document.getElementById("btn-send"),
  handsfree: document.getElementById("handsfree"),
  suggestions: document.getElementById("suggestions"),
  statusBar: document.getElementById("status-bar"),
  btnSettings: document.getElementById("btn-settings"),
  settingsModal: document.getElementById("settings-modal"),
  btnSettingsClose: document.getElementById("btn-settings-close"),
  apiKey: document.getElementById("api-key"),
  model: document.getElementById("model"),
  voiceRate: document.getElementById("voice-rate"),
  rateValue: document.getElementById("rate-value"),
  autospeak: document.getElementById("autospeak"),
  showTranslations: document.getElementById("show-translations"),
  voiceInfo: document.getElementById("voice-info"),
  btnSummary: document.getElementById("btn-summary"),
  summaryModal: document.getElementById("summary-modal"),
  summaryContent: document.getElementById("summary-content"),
  btnSummaryClose: document.getElementById("btn-summary-close"),
};

// ---------- État ----------
const state = {
  history: [],          // [{role: "user"|"assistant", content: string}] — côté assistant, seulement la réplique catalane
  started: false,
  busy: false,
  listening: false,
  recognition: null,
  catalanVoice: null,
};

// ---------- Réglages persistés ----------
const SETTINGS_KEY = "parla-settings";

function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (_) {}
  el.apiKey.value = saved.apiKey || "";
  el.model.value = saved.model || "claude-opus-5";
  el.voiceRate.value = saved.voiceRate || 0.9;
  el.rateValue.textContent = el.voiceRate.value;
  el.autospeak.checked = saved.autospeak !== false;
  el.showTranslations.checked = saved.showTranslations !== false;
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    apiKey: el.apiKey.value.trim(),
    model: el.model.value,
    voiceRate: parseFloat(el.voiceRate.value),
    autospeak: el.autospeak.checked,
    showTranslations: el.showTranslations.checked,
  }));
}

// ---------- Synthèse vocale (catalan) ----------
function refreshVoices() {
  const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  state.catalanVoice =
    voices.find(v => v.lang.toLowerCase().startsWith("ca")) ||
    voices.find(v => v.lang.toLowerCase().startsWith("es")) ||
    null;

  if (!window.speechSynthesis) {
    el.voiceInfo.textContent = "⚠️ Synthèse vocale non disponible dans ce navigateur.";
  } else if (!state.catalanVoice) {
    el.voiceInfo.textContent = "⚠️ Aucune voix catalane ou espagnole trouvée — les réponses ne seront pas lues à voix haute.";
  } else if (state.catalanVoice.lang.toLowerCase().startsWith("ca")) {
    el.voiceInfo.textContent = `✅ Voix catalane : ${state.catalanVoice.name} (${state.catalanVoice.lang})`;
  } else {
    el.voiceInfo.textContent = `ℹ️ Pas de voix catalane installée ; repli sur une voix espagnole : ${state.catalanVoice.name}. La prononciation sera approximative.`;
  }
}

function speak(text, onEnd) {
  if (!window.speechSynthesis || !state.catalanVoice || !el.autospeak.checked) {
    if (onEnd) onEnd();
    return;
  }
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.voice = state.catalanVoice;
  utter.lang = state.catalanVoice.lang;
  utter.rate = parseFloat(el.voiceRate.value);
  utter.onend = () => { if (onEnd) onEnd(); };
  utter.onerror = () => { if (onEnd) onEnd(); };
  speechSynthesis.speak(utter);
}

// ---------- Reconnaissance vocale (catalan) ----------
function initRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = "ca-ES";
  rec.interimResults = true;
  rec.continuous = false;

  rec.onstart = () => {
    state.listening = true;
    el.btnMic.classList.add("listening");
    setStatus("🎤 Je t'écoute… parle en catalan !");
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
  div.innerHTML = `<div class="speaker">Toi</div><div class="catalan"></div>`;
  div.querySelector(".catalan").textContent = text;
  el.chat.appendChild(div);
  scrollChat();
}

function addTutorBubble(reply, translation) {
  const div = document.createElement("div");
  div.className = "msg tutor";
  div.innerHTML = `<div class="speaker">Núria</div><div class="catalan"></div>`;
  const cat = div.querySelector(".catalan");
  cat.textContent = reply + " ";
  const btn = document.createElement("button");
  btn.className = "btn-speak";
  btn.title = "Réécouter";
  btn.textContent = "🔊";
  btn.addEventListener("click", () => speakIgnoringAutospeak(reply));
  cat.appendChild(btn);
  if (translation && el.showTranslations.checked) {
    const tr = document.createElement("div");
    tr.className = "translation";
    tr.textContent = "🇫🇷 " + translation;
    div.appendChild(tr);
  }
  el.chat.appendChild(div);
  scrollChat();
}

function speakIgnoringAutospeak(text) {
  const wasChecked = el.autospeak.checked;
  el.autospeak.checked = true;
  speak(text);
  el.autospeak.checked = wasChecked;
}

function addCorrection(correction) {
  const div = document.createElement("div");
  div.className = "correction";
  div.innerHTML = `<span class="corr-title">✏️ Correction :</span> <del></del> → <ins></ins><br>`;
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
    chip.textContent = "💬 " + s;
    chip.addEventListener("click", () => sendMessage(s));
    el.suggestions.appendChild(chip);
  }
  el.suggestions.classList.remove("hidden");
}

// ---------- Prompt système ----------
const LEVEL_INSTRUCTIONS = {
  debutant: `L'élève est DÉBUTANT (A1–A2). Utilise des phrases très courtes et simples, le présent de l'indicatif,
du vocabulaire de base. Parle lentement (phrases courtes). Une seule question à la fois.`,
  intermediaire: `L'élève est INTERMÉDIAIRE (B1–B2). Utilise des phrases naturelles de longueur moyenne, passé et futur inclus.
Introduis progressivement du vocabulaire nouveau et des expressions idiomatiques courantes.`,
  avance: `L'élève est AVANCÉ (C1). Parle comme avec un natif : registres variés, expressions idiomatiques, subjonctif,
sujets de discussion riches. Corrige aussi les nuances de style et les calques du français ou de l'espagnol.`,
};

const SCENARIO_INSTRUCTIONS = {
  libre: "Conversation libre : choisis des sujets de la vie quotidienne qui font parler l'élève.",
  cafe: "Jeu de rôle : tu es serveuse dans un café/restaurant de Barcelone, l'élève est client. Fais-le commander, poser des questions sur le menu, payer.",
  marche: "Jeu de rôle : tu es marchande au marché de la Boqueria, l'élève fait ses courses (fruits, légumes, quantités, prix).",
  directions: "Jeu de rôle : l'élève est perdu à Barcelone et te demande son chemin. Travaille les directions, les lieux, les transports.",
  presentations: "Jeu de rôle : première rencontre. Travaille les présentations : nom, origine, métier, goûts, famille.",
  voyage: "Jeu de rôle : l'élève prépare ou vit un voyage à Barcelone (hôtel, billets, visites, restaurants).",
  travail: "Jeu de rôle : contexte professionnel en Catalogne (réunions, collègues, petites conversations de bureau).",
};

function buildSystemPrompt() {
  return `Tu es la Núria, une tutrice de catalan chaleureuse et encourageante, originaire de Barcelone.
Ton élève est francophone et apprend le catalan par la CONVERSATION ORALE. Tes réponses seront lues à voix haute
par une synthèse vocale : écris uniquement du texte prononçable (pas de listes, pas d'astérisques, pas d'emojis dans "reply").

${LEVEL_INSTRUCTIONS[el.level.value]}

${SCENARIO_INSTRUCTIONS[el.scenario.value]}

Règles :
- "reply" : ta réplique EN CATALAN uniquement, 1 à 3 phrases, qui se termine le plus souvent par une question pour relancer l'élève.
- "translation" : la traduction française fidèle de "reply".
- "correction" : si le dernier message de l'élève contient une erreur de catalan (grammaire, vocabulaire, calque du français
  ou de l'espagnol), remplis l'objet correction avec la phrase erronée, la version corrigée et une explication BRÈVE en français.
  S'il n'y a pas d'erreur significative, ou si l'élève a écrit en français, mets correction à null. Une seule correction à la fois :
  la plus importante.
- "suggestions" : 2 ou 3 réponses possibles courtes EN CATALAN que l'élève pourrait te dire ensuite, adaptées à son niveau.
- Si l'élève parle français, réponds quand même en catalan (simple), sans le pénaliser.
- Le message spécial "[COMENCEM]" signifie que l'élève démarre la conversation : salue-le en catalan et lance le scénario.
- Note : l'historique ne contient que tes répliques catalanes, sans les traductions ni corrections précédentes.`;
}

// ---------- Appels à l'API Claude ----------
const API_URL = "https://api.anthropic.com/v1/messages";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Réplique de la tutrice en catalan, 1 à 3 phrases prononçables." },
    translation: { type: "string", description: "Traduction française de reply." },
    correction: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            original: { type: "string", description: "Ce que l'élève a dit, avec l'erreur." },
            corrected: { type: "string", description: "La version correcte en catalan." },
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
      description: "2 ou 3 réponses possibles en catalan pour l'élève.",
    },
  },
  required: ["reply", "translation", "correction", "suggestions"],
  additionalProperties: false,
};

function apiHeaders(model) {
  const headers = {
    "content-type": "application/json",
    "x-api-key": el.apiKey.value.trim(),
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
  // Repli serveur recommandé sur Opus 5 : en cas de refus des classificateurs,
  // la requête est rejouée automatiquement sur le modèle de repli.
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

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: apiHeaders(model),
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    let detail = "";
    try { detail = (await resp.json()).error?.message || ""; } catch (_) {}
    if (resp.status === 401) throw new Error("Clé API invalide. Vérifie-la dans les réglages ⚙️.");
    if (resp.status === 429) throw new Error("Limite de requêtes atteinte. Attends un instant puis réessaie.");
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
  if (!el.apiKey.value.trim()) {
    setStatus("Ajoute d'abord ta clé API Anthropic dans les réglages ⚙️.", true);
    openModal(el.settingsModal);
    return;
  }

  stopListening();
  state.busy = true;
  el.btnSend.disabled = true;
  el.btnMic.disabled = true;
  showSuggestions(null);
  if (display) addUserBubble(userText);
  setStatus("La Núria réfléchit…");

  state.history.push({ role: "user", content: userText });

  try {
    const raw = await callClaude({ messages: state.history, structured: true });
    const parsed = JSON.parse(raw);

    // On ne garde dans l'historique que la réplique catalane (concis + naturel).
    state.history.push({ role: "assistant", content: parsed.reply });

    if (parsed.correction) addCorrection(parsed.correction);
    addTutorBubble(parsed.reply, parsed.translation);
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
    const messages = [
      ...state.history,
      {
        role: "user",
        content: `[Fin de session] En FRANÇAIS, fais un résumé pédagogique de notre conversation :
1. Le vocabulaire catalan important vu aujourd'hui (mot catalan → traduction française).
2. Les erreurs que j'ai faites et les points de grammaire à retenir.
3. Deux ou trois phrases catalanes utiles à réviser.
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
  if (!el.apiKey.value.trim()) {
    openModal(el.settingsModal);
    setStatus("Ajoute d'abord ta clé API Anthropic, puis relance la conversation.", true);
    return;
  }
  state.started = true;
  el.welcomeCard.classList.add("hidden");
  el.inputBar.classList.remove("hidden");
  const levelLabel = el.level.options[el.level.selectedIndex].text;
  const scenarioLabel = el.scenario.options[el.scenario.selectedIndex].text;
  addSystemNote(`Session démarrée — ${levelLabel} · ${scenarioLabel}`);
  sendMessage("[COMENCEM]", { display: false });
}

function init() {
  loadSettings();

  // Compatibilité navigateur
  state.recognition = initRecognition();
  if (!state.recognition) {
    el.compatWarning.textContent =
      "⚠️ La reconnaissance vocale n'est pas disponible dans ce navigateur (utilise Chrome ou Edge). Tu pourras quand même écrire tes réponses.";
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

  // Événements
  el.btnStart.addEventListener("click", startConversation);
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
