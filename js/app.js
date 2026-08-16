/* Polyglotte — apprentissage des langues pour francophones.
 * Conversation orale : reconnaissance vocale (Web Speech API) → Claude → synthèse vocale.
 * L'appel API passe par le proxy local (server.py) quand il est disponible, sinon
 * directement depuis le navigateur (header anthropic-dangerous-direct-browser-access).
 */

"use strict";

const APP_VERSION = "0.5.0";

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
    scenarios: [
      { id: "calcotada", label: "🌍 Une calçotada entre amis", prompt: "Jeu de rôle : tu invites l'élève à une calçotada près de Tarragone. Fais-lui vivre le rituel : calçots grillés au feu, sauce romesco, porró de vi, mains noircies et grand bavoir. Vocabulaire de la fête et de la table." },
      { id: "santjordi", label: "🌍 Sant Jordi", prompt: "Jeu de rôle : c'est la diada de Sant Jordi à Barcelone, la Rambla est couverte de stands de livres et de roses. Explique la tradition, aide l'élève à choisir un livre et une rose, parlez de vos lectures." },
      { id: "castellers", label: "🌍 Une diada castellera", prompt: "Jeu de rôle : vous assistez à une exhibition de castellers. Explique les tours humaines (la pinya, le tronc, l'enxaneta), l'esprit d'équipe, et fais réagir l'élève au spectacle." },
    ],
  },
  espagnol: {
    label: "Espagnol", langFr: "l'espagnol",
    tutor: { name: "Carmen", city: "Séville", f: true },
    stt: "es-ES", ttsPrefixes: ["es"],
    rtl: false, reading: null, support: "full", voiceHint: "",
    promptExtra: "Sois attentive aux faux amis français-espagnol et aux confusions ser/estar.",
    scenarios: [
      { id: "tapas", label: "🌍 De tapas à Séville", prompt: "Jeu de rôle : tournée de tapas dans le centre de Séville, de bar en bar. Commander des raciones, partager, payer à la fin, ambiance andalouse." },
      { id: "feria", label: "🌍 La Feria de Abril", prompt: "Jeu de rôle : tu emmènes l'élève à la Feria de Abril de Séville : casetas, rebujito, sevillanas, tenues de flamenca. Fais-lui vivre la fête." },
      { id: "semanasanta", label: "🌍 La Semana Santa", prompt: "Jeu de rôle : processions de la Semana Santa à Séville : nazarenos, pasos, saetas. Explique les traditions et fais réagir l'élève à ce qu'il voit." },
    ],
  },
  anglais: {
    label: "Anglais (GB)", langFr: "l'anglais britannique",
    tutor: { name: "Oliver", city: "Londres", f: false },
    stt: "en-GB", ttsPrefixes: ["en-gb", "en"],
    rtl: false, reading: null, support: "full", voiceHint: "",
    promptExtra: "Utilise l'anglais britannique (vocabulaire, orthographe, expressions). Corrige les calques du français.",
    scenarios: [
      { id: "pub", label: "🌍 Au pub", prompt: "Jeu de rôle : un pub londonien classique. Commander au comptoir, payer sa tournée (a round), small talk sur la météo et le football, le rituel du last orders." },
      { id: "tube", label: "🌍 Dans le métro de Londres", prompt: "Jeu de rôle : se déplacer dans le Tube : Oyster card, mind the gap, demander sa ligne et sa correspondance, l'étiquette du métro londonien." },
      { id: "sundayroast", label: "🌍 Sunday roast", prompt: "Jeu de rôle : repas de Sunday roast au pub ou en famille : les plats traditionnels, la conversation du dimanche, la politesse britannique." },
    ],
  },
  allemand: {
    label: "Allemand", langFr: "l'allemand",
    tutor: { name: "Lena", city: "Berlin", f: true },
    stt: "de-DE", ttsPrefixes: ["de"],
    rtl: false, reading: null, support: "full", voiceHint: "",
    promptExtra: "Sois attentive aux déclinaisons, aux genres et à l'ordre des mots, difficultés classiques des francophones.",
    scenarios: [
      { id: "biergarten", label: "🌍 Au Biergarten", prompt: "Jeu de rôle : un Biergarten : commander une Maß et des Brezeln, partager une grande table avec des inconnus, trinquer (Prost!), bavarder." },
      { id: "amt", label: "🌍 Au Bürgeramt", prompt: "Jeu de rôle très berlinois : l'élève doit faire son Anmeldung au Bürgeramt. Prendre un ticket, attendre, expliquer sa situation, comprendre le vocabulaire administratif." },
      { id: "flohmarkt", label: "🌍 Flohmarkt au Mauerpark", prompt: "Jeu de rôle : chiner au marché aux puces du Mauerpark : demander les prix, marchander poliment, discuter des trouvailles." },
    ],
  },
  suisse: {
    label: "Suisse allemand", langFr: "le suisse allemand",
    tutor: { name: "Reto", city: "Zurich", f: false },
    stt: "de-CH", ttsPrefixes: ["de"],
    rtl: false, reading: null, support: "partial",
    supportNote: "Le suisse allemand n'a pas de moteur vocal dédié : la reconnaissance comprend mieux l'allemand standard que le dialecte, et la voix de synthèse est allemande (prononciation approximative). La conversation écrite, elle, est pleinement en schwiizerdütsch.",
    voiceHint: "Voix allemande utilisée (pas de voix suisse-allemande existante).",
    promptExtra: "Écris en suisse allemand (dialecte zurichois), avec une orthographe dialectale courante. L'élève peut répondre en allemand standard : accepte-le, mais réponds toujours en dialecte. Les transcriptions vocales arrivent souvent déformées vers l'allemand standard : interprète avec bienveillance.",
    scenarios: [
      { id: "kafi", label: "🌍 Kafi und Gipfeli", prompt: "Jeu de rôle : pause café à Zurich, es Kafi und es Gipfeli. Small talk suisse : la météo, les montagnes, la ponctualité — et les différences avec l'allemand d'Allemagne." },
      { id: "wandern", label: "🌍 Randonnée en montagne", prompt: "Jeu de rôle : préparer et vivre une Wanderung : itinéraire, météo, équipement, pique-nique, saluer les autres randonneurs (Grüezi mitenand!)." },
      { id: "migros", label: "🌍 Courses à la Migros", prompt: "Jeu de rôle : faire ses courses à la Migros : trouver les rayons, produits typiquement suisses, payer, la consigne et le recyclage." },
    ],
  },
  ptpt: {
    label: "Portugais (Portugal)", langFr: "le portugais européen",
    tutor: { name: "Inês", city: "Lisbonne", f: true },
    stt: "pt-PT", ttsPrefixes: ["pt-pt", "pt"],
    rtl: false, reading: null, support: "full", voiceHint: "",
    promptExtra: "Utilise le portugais européen (prononciation, usage de « tu »/« você », vocabulaire du Portugal), pas le brésilien.",
    scenarios: [
      { id: "pasteis", label: "🌍 Pastéis de Belém", prompt: "Jeu de rôle : la file des Pastéis de Belém : commander des pastéis de nata et une bica, canelle ou pas, discuter de la recette secrète." },
      { id: "fado", label: "🌍 Soirée fado à Alfama", prompt: "Jeu de rôle : une maison de fado dans l'Alfama : le silence pendant le chant, la saudade, commander à voix basse, parler musique entre deux fados." },
      { id: "electrico", label: "🌍 Le tram 28", prompt: "Jeu de rôle : traverser Lisbonne dans le mythique elétrico 28 : acheter son billet, demander l'arrêt, commenter les quartiers traversés." },
    ],
  },
  ptbr: {
    label: "Portugais (Brésil)", langFr: "le portugais brésilien",
    tutor: { name: "João", city: "Rio de Janeiro", f: false },
    stt: "pt-BR", ttsPrefixes: ["pt-br", "pt"],
    rtl: false, reading: null, support: "full", voiceHint: "",
    promptExtra: "Utilise le portugais brésilien (« você », vocabulaire et tournures du Brésil).",
    scenarios: [
      { id: "botequim", label: "🌍 Au botequim", prompt: "Jeu de rôle : un bar de quartier carioca : chope bien glacée, petiscos, conversation détendue, football et musique." },
      { id: "praia", label: "🌍 Plage de Copacabana", prompt: "Jeu de rôle : une journée à Copacabana : vendeurs ambulants (açaí, mate, biscoito Globo), louer une chaise et un parasol, baignade et altinha." },
      { id: "feira", label: "🌍 La feira du dimanche", prompt: "Jeu de rôle : un marché de rue brésilien : fruits tropicaux à goûter, pastel de feira, caldo de cana, marchander gentiment." },
    ],
  },
  japonais: {
    label: "Japonais", langFr: "le japonais",
    tutor: { name: "Yuki", city: "Tokyo", f: true },
    stt: "ja-JP", ttsPrefixes: ["ja"],
    rtl: false, reading: "le rōmaji (transcription latine) de ta réplique", support: "full", voiceHint: "",
    promptExtra: "Écris en japonais normal (kanji et kana), avec des kanji adaptés au niveau (débutant : kana et kanji très courants uniquement). Utilise la forme polie (-masu/-desu) avec les débutants.",
    scenarios: [
      { id: "konbini", label: "🌍 Au konbini", prompt: "Jeu de rôle : un konbini japonais : choisir un bentō et une boisson, le faire réchauffer, comprendre les formules ritualisées du personnel, payer." },
      { id: "izakaya", label: "🌍 À l'izakaya", prompt: "Jeu de rôle : soirée à l'izakaya : l'otōshi, commander plusieurs petits plats au fil de la soirée, trinquer (kanpai!), appeler le serveur (sumimasen!)." },
      { id: "onsen", label: "🌍 Aux onsen", prompt: "Jeu de rôle : séjour en ryokan avec onsen : les règles du bain (se laver avant, la petite serviette), le yukata, le vocabulaire du séjour." },
    ],
  },
  arabe: {
    label: "Arabe standard", langFr: "l'arabe standard moderne",
    tutor: { name: "Amina", city: "Le Caire", f: true },
    stt: "ar-SA", ttsPrefixes: ["ar"],
    rtl: true, reading: "une translittération latine de ta réplique", support: "full", voiceHint: "",
    promptExtra: "Utilise l'arabe standard moderne (fusha) en écriture arabe. Pour les débutants, ajoute la voyellation (tachkil) sur les mots difficiles.",
    scenarios: [
      { id: "ahwa", label: "🌍 Au café (ahwa) du Caire", prompt: "Jeu de rôle : un café populaire du Caire : thé à la menthe, café turc, chicha, backgammon, conversation de quartier." },
      { id: "khan", label: "🌍 Souk Khan el-Khalili", prompt: "Jeu de rôle : marchander un souvenir au Khan el-Khalili : prix de départ exagéré, contre-offres, thé offert, l'art de la négociation avec le sourire." },
      { id: "iftar", label: "🌍 Invitation à un iftar", prompt: "Jeu de rôle : l'élève est invité à un iftar pendant ramadan : salutations d'usage, plats servis, coutumes de la table, remerciements." },
    ],
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
    scenarios: [
      { id: "medina", label: "🌍 Dans la médina de Tunis", prompt: "Jeu de rôle : les souks de la médina de Tunis : chercher un artisan, marchander en derja, souffler autour d'un thé aux pins." },
      { id: "cafetn", label: "🌍 Au café tunisois", prompt: "Jeu de rôle : un café de quartier à Tunis : commander un direct ou un capucin, discussions foot et famille, expressions typiquement tunisoises." },
      { id: "mariage", label: "🌍 Un mariage tunisien", prompt: "Jeu de rôle : l'élève est invité à un mariage tunisien : les étapes de la fête, le henné, les tenues, présenter ses félicitations en derja." },
    ],
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
  // Progrès & révisions
  btnProgress: document.getElementById("btn-progress"),
  dueBadge: document.getElementById("due-badge"),
  progressModal: document.getElementById("progress-modal"),
  progressHome: document.getElementById("progress-home"),
  statsGrid: document.getElementById("stats-grid"),
  langStats: document.getElementById("lang-stats"),
  btnReview: document.getElementById("btn-review"),
  dueCount: document.getElementById("due-count"),
  btnExport: document.getElementById("btn-export"),
  deckList: document.getElementById("deck-list"),
  reviewArea: document.getElementById("review-area"),
  reviewTerm: document.getElementById("review-term"),
  reviewReading: document.getElementById("review-reading"),
  reviewAnswer: document.getElementById("review-answer"),
  btnReviewSpeak: document.getElementById("btn-review-speak"),
  btnReveal: document.getElementById("btn-reveal"),
  btnKnew: document.getElementById("btn-knew"),
  btnMissed: document.getElementById("btn-missed"),
  reviewProgress: document.getElementById("review-progress"),
  btnReviewBack: document.getElementById("btn-review-back"),
  btnProgressClose: document.getElementById("btn-progress-close"),
  // Test de niveau, compréhension orale, immersion
  btnAssess: document.getElementById("btn-assess"),
  listenMode: document.getElementById("listen-mode"),
  immersion: document.getElementById("immersion"),
  // Grammaire
  btnGrammar: document.getElementById("btn-grammar"),
  grammarModal: document.getElementById("grammar-modal"),
  grammarTopic: document.getElementById("grammar-topic"),
  btnGrammarFiche: document.getElementById("btn-grammar-fiche"),
  btnGrammarMap: document.getElementById("btn-grammar-map"),
  grammarStatus: document.getElementById("grammar-status"),
  grammarTitle: document.getElementById("grammar-title"),
  grammarResult: document.getElementById("grammar-result"),
  mindmapWrap: document.getElementById("mindmap-wrap"),
  btnGrammarClose: document.getElementById("btn-grammar-close"),
  // Exercices
  btnExercises: document.getElementById("btn-exercises"),
  exoModal: document.getElementById("exo-modal"),
  exoSetup: document.getElementById("exo-setup"),
  btnExoDictee: document.getElementById("btn-exo-dictee"),
  btnExoPrononciation: document.getElementById("btn-exo-prononciation"),
  exoArea: document.getElementById("exo-area"),
  exoProgress: document.getElementById("exo-progress"),
  exoSentence: document.getElementById("exo-sentence"),
  exoReading: document.getElementById("exo-reading"),
  btnExoSpeak: document.getElementById("btn-exo-speak"),
  btnExoMic: document.getElementById("btn-exo-mic"),
  exoInput: document.getElementById("exo-input"),
  btnExoCheck: document.getElementById("btn-exo-check"),
  btnExoRetry: document.getElementById("btn-exo-retry"),
  btnExoNext: document.getElementById("btn-exo-next"),
  exoFeedback: document.getElementById("exo-feedback"),
  exoStatus: document.getElementById("exo-status"),
  btnExoClose: document.getElementById("btn-exo-close"),
};

// ---------- État ----------
const state = {
  history: [],          // [{role, content}] — côté assistant, seulement la réplique en langue cible
  started: false,
  mode: "chat",         // "chat" (conversation) | "eval" (test de niveau)
  busy: false,
  listening: false,
  recognition: null,
  transcriptHandler: null, // détourne la reconnaissance vocale (ex. exercice de prononciation)
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
  el.listenMode.checked = saved.listenMode === true;
  el.immersion.checked = saved.immersion === true;
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
    listenMode: el.listenMode.checked,
    immersion: el.immersion.checked,
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
    if (state.transcriptHandler) el.btnExoMic.classList.add("listening");
    setStatus(`🎤 Je t'écoute… parle en ${langConfig().label.toLowerCase()} !`);
  };
  rec.onresult = (event) => {
    let interim = "", final = "";
    for (const result of event.results) {
      if (result.isFinal) final += result[0].transcript;
      else interim += result[0].transcript;
    }
    if (interim) setStatus(`🎤 « ${interim} »`);
    if (final.trim()) (state.transcriptHandler || sendMessage)(final.trim());
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
  el.btnExoMic.classList.remove("listening");
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
  // Mode compréhension orale : le texte est flouté jusqu'à révélation (#20).
  if (el.listenMode.checked) {
    div.classList.add("masked");
    const reveal = document.createElement("button");
    reveal.className = "btn-reveal-text";
    reveal.textContent = "👁 Afficher";
    reveal.addEventListener("click", () => { div.classList.remove("masked"); reveal.remove(); });
    div.querySelector(".speaker").appendChild(reveal);
  }
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
  const deepen = document.createElement("button");
  deepen.className = "btn-deepen";
  deepen.textContent = "🧠 Approfondir";
  deepen.addEventListener("click", () => {
    el.grammarTopic.value =
      `Explique en détail cette erreur : « ${correction.original} » → « ${correction.corrected} » (${correction.explanation})`;
    openModal(el.grammarModal);
  });
  div.appendChild(deepen);
  el.chat.appendChild(div);
  scrollChat();
}

function addCulturalNote(text) {
  const div = document.createElement("div");
  div.className = "culture-note";
  div.textContent = "💡 " + text;
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

// Scénarios génériques, complétés par les scénarios culturels de la langue (#23).
const BASE_SCENARIOS = [
  ["libre", "Conversation libre"],
  ["cafe", "Au café / restaurant"],
  ["marche", "Au marché"],
  ["directions", "Demander son chemin"],
  ["presentations", "Se présenter / rencontres"],
  ["voyage", "Voyage"],
  ["travail", "Au travail"],
];

function updateScenarioOptions() {
  const cfg = langConfig();
  const previous = el.scenario.value;
  el.scenario.innerHTML = "";
  for (const [value, label] of BASE_SCENARIOS) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    el.scenario.appendChild(opt);
  }
  if (cfg.scenarios && cfg.scenarios.length) {
    const group = document.createElement("optgroup");
    group.label = `Scénarios culturels — ${cfg.label}`;
    for (const s of cfg.scenarios) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.label;
      group.appendChild(opt);
    }
    el.scenario.appendChild(group);
  }
  el.scenario.value = [...el.scenario.options].some(o => o.value === previous) ? previous : "libre";
}

function updateWelcomeForLanguage() {
  const isTunisian = el.language.value === "tunisien";
  el.tnScriptRow.classList.toggle("hidden", !isTunisian);
  const cfg = langConfig();
  el.supportNote.textContent = cfg.supportNote || "";
  el.supportNote.classList.toggle("hidden", !cfg.supportNote);
  updateScenarioOptions();
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

// Difficulté adaptative (#18) : ajoutée aux instructions de niveau.
const ADAPTIVE_INSTRUCTION = `Dans les limites de ce niveau, adapte la difficulté en continu :
si l'élève répond avec aisance sur plusieurs tours, enrichis progressivement vocabulaire et structures ;
s'il peine (réponses très courtes, erreurs fréquentes, signes d'incompréhension), simplifie immédiatement.`;

function scenarioInstructions(cfg) {
  const cultural = (cfg.scenarios || []).find(s => s.id === el.scenario.value);
  if (cultural) {
    return cultural.prompt + " Ancre le vocabulaire, les usages et les références dans ce contexte culturel.";
  }
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

// Prompt du test de positionnement (#17).
function buildAssessmentPrompt() {
  const cfg = langConfig();
  const role = cfg.tutor.f ? "une évaluatrice bienveillante" : "un évaluateur bienveillant";
  return `Tu es ${cfg.tutor.name}, ${role} de ${cfg.langFr}, chargé(e) d'estimer le niveau CECRL d'un élève
francophone par une courte conversation. Tes réponses seront lues à voix haute : texte prononçable uniquement.

Déroulé :
- Le message spécial "[START]" démarre le test : explique le principe en UNE phrase en français, puis pose
  ta première question, très simple (niveau A1), en ${cfg.langFr}.
- Une seule question à la fois. Augmente ou diminue progressivement la difficulté selon la qualité des
  réponses (richesse, précision grammaticale, aisance). Ne corrige pas pendant le test.
- Spécificités de la langue : ${cfg.promptExtra}
- Après 5 à 8 échanges, quand ton estimation est stable, conclus.

Champs :
- "reply" : ta question ou ta conclusion en ${cfg.langFr} (1 à 2 phrases).
- "translation" : traduction française de reply.
- "reading" : ${cfg.reading ? cfg.reading : "toujours null"}.
- "done" : false tant que le test continue ; true quand tu conclus.
- "level" : null tant que done est false ; sinon le niveau estimé parmi "A1", "A2", "B1", "B2", "C1".
- "explanation" : null tant que done est false ; sinon 2 à 3 phrases EN FRANÇAIS justifiant le niveau
  (points forts, points à travailler).`;
}

function buildSystemPrompt() {
  if (state.mode === "eval") return buildAssessmentPrompt();
  const cfg = langConfig();
  const role = cfg.tutor.f ? "une tutrice chaleureuse et encourageante" : "un tuteur chaleureux et encourageant";
  const readingRule = cfg.reading
    ? `- "reading" : ${cfg.reading}.`
    : `- "reading" : mets toujours null (langue à alphabet latin).`;
  return `Tu es ${cfg.tutor.name}, ${role}, spécialiste de ${cfg.langFr}, et tu vis à ${cfg.tutor.city}.
Ton élève est francophone et apprend ${cfg.langFr} par la CONVERSATION ORALE. Tes réponses seront lues à voix haute
par une synthèse vocale : écris uniquement du texte prononçable (pas de listes, pas d'astérisques, pas d'emojis dans "reply").

${LEVEL_INSTRUCTIONS[el.level.value]}
${ADAPTIVE_INSTRUCTION}

${scenarioInstructions(cfg)}

Spécificités de la langue : ${cfg.promptExtra}

Règles :
- "reply" : ta réplique EN ${cfg.langFr.toUpperCase().replace(/^L[E'’A]\s*/, "")} uniquement, 1 à 3 phrases, qui se termine le plus souvent par une question pour relancer l'élève.
- "translation" : la traduction française fidèle de "reply".
${readingRule}
${el.immersion.checked
    ? `- MODE IMMERSION TOTALE : "correction" est TOUJOURS null. Corrige par REFORMULATION naturelle : si l'élève
  fait une erreur, reprends simplement la forme correcte au fil de ta réplique, comme le ferait un natif
  (exemple : il dit « jo veig vi », tu réponds « Ah, tu beus vi! I beus vi negre o blanc? »).
- "cultural_note" : toujours null en immersion.`
    : `- "correction" : si le dernier message de l'élève contient une erreur (grammaire, vocabulaire, calque du français),
  remplis l'objet correction avec la phrase erronée, la version corrigée et une explication BRÈVE en français.
  Ne corrige que si tu es certain de l'erreur ET de la correction : dans le doute, ou si "original" et "corrected"
  seraient identiques, mets correction à null. S'il n'y a pas d'erreur significative, ou si l'élève a écrit en
  français, mets correction à null. Une seule correction à la fois : la plus importante.
- "cultural_note" : occasionnellement (au plus un tour sur trois), une note culturelle brève EN FRANÇAIS en lien
  avec l'échange — coutume, usage, contexte local. Sinon null. Jamais artificielle.`}
- "suggestions" : 2 ou 3 réponses possibles courtes dans la langue cible que l'élève pourrait te dire ensuite, adaptées à son niveau.
- "vocabulary" : 0 à 2 mots ou expressions importants et NOUVEAUX de cet échange (issus de ta réplique ou du message
  de l'élève), utiles à mémoriser : terme en langue cible, traduction française, translittération latine si l'écriture
  n'est pas latine (sinon null). Tableau vide si rien de notable — ne remplis jamais artificiellement.
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
    cultural_note: {
      anyOf: [
        { type: "null" },
        { type: "string", description: "Brève note culturelle en français (1-2 phrases) liée à l'échange. Rare : au plus un tour sur trois." },
      ],
    },
    vocabulary: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string", description: "Mot ou expression en langue cible." },
          translation: { type: "string", description: "Traduction française." },
          reading: {
            anyOf: [
              { type: "null" },
              { type: "string", description: "Translittération latine si écriture non latine." },
            ],
          },
        },
        required: ["term", "translation", "reading"],
        additionalProperties: false,
      },
      description: "0 à 2 mots/expressions importants et nouveaux de cet échange, à mémoriser. Vide si rien de notable.",
    },
  },
  required: ["reply", "translation", "reading", "correction", "suggestions", "vocabulary", "cultural_note"],
  additionalProperties: false,
};

const READING_FIELD = {
  anyOf: [
    { type: "null" },
    { type: "string", description: "Translittération latine si écriture non latine." },
  ],
};

// Schéma du test de positionnement (#17).
const ASSESS_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Question ou conclusion en langue cible, prononçable." },
    translation: { type: "string", description: "Traduction française de reply." },
    reading: READING_FIELD,
    done: { type: "boolean", description: "true quand le test est terminé." },
    level: {
      anyOf: [
        { type: "null" },
        { type: "string", enum: ["A1", "A2", "B1", "B2", "C1"] },
      ],
    },
    explanation: {
      anyOf: [{ type: "null" }, { type: "string", description: "Justification en français." }],
    },
  },
  required: ["reply", "translation", "reading", "done", "level", "explanation"],
  additionalProperties: false,
};

// Schémas de l'écran Grammaire (#19). Pas de récursion : la carte mentale est une
// liste plate id/parent (parent 0 = racine), reconstruite côté client.
const GRAMMAR_FICHE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Titre court de la fiche." },
    content: {
      type: "string",
      description: "Fiche en texte simple : explication en français, tableaux de conjugaison alignés en texte, exemples en langue cible avec traduction. Sauts de ligne pour la structure, pas de Markdown.",
    },
  },
  required: ["title", "content"],
  additionalProperties: false,
};

const GRAMMAR_MAP_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Concept central de la carte mentale (court)." },
    nodes: {
      type: "array",
      description: "10 à 20 nœuds. parent = 0 pour les branches principales, sinon l'id d'un nœud déjà défini. Profondeur maximale : 3 niveaux.",
      items: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Identifiant unique ≥ 1, croissant." },
          parent: { type: "integer", description: "0 pour la racine, sinon id du parent." },
          label: { type: "string", description: "Libellé très court (4 mots max)." },
          note: {
            anyOf: [{ type: "null" }, { type: "string", description: "Détail ou exemple (info-bulle)." }],
          },
        },
        required: ["id", "parent", "label", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "nodes"],
  additionalProperties: false,
};

// Schéma des exercices (#21, #22).
const EXO_SCHEMA = {
  type: "object",
  properties: {
    sentences: {
      type: "array",
      description: "Exactement 5 phrases variées de la vie quotidienne, adaptées au niveau, prononçables.",
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "Phrase en langue cible." },
          reading: READING_FIELD,
        },
        required: ["text", "reading"],
        additionalProperties: false,
      },
    },
  },
  required: ["sentences"],
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

async function callClaude({ messages, system, schema, maxTokens = 2048 }) {
  const model = el.model.value;
  const body = {
    model,
    max_tokens: maxTokens,
    system,
    messages,
  };
  if (model === "claude-opus-5") {
    body.fallbacks = "default";
  }
  const outputConfig = {};
  // "effort" n'est pas supporté par Haiku 4.5 (la requête serait rejetée).
  if (model !== "claude-haiku-4-5") outputConfig.effort = "low";
  if (schema) outputConfig.format = { type: "json_schema", schema };
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
    const raw = await callClaude({
      messages: state.history,
      system: buildSystemPrompt(),
      schema: state.mode === "eval" ? ASSESS_SCHEMA : RESPONSE_SCHEMA,
    });
    const parsed = JSON.parse(raw);

    // On ne garde dans l'historique que la réplique en langue cible (concis + naturel).
    state.history.push({ role: "assistant", content: parsed.reply });

    const immersion = el.immersion.checked && state.mode === "chat";
    // Filet de sécurité contre les corrections « à vide » (original == corrigé).
    if (!immersion && parsed.correction &&
        parsed.correction.original.trim().toLowerCase() !== parsed.correction.corrected.trim().toLowerCase()) {
      addCorrection(parsed.correction);
    }
    addTutorBubble(parsed.reply, immersion ? null : parsed.translation, parsed.reading);
    if (!immersion && parsed.cultural_note) addCulturalNote(parsed.cultural_note);
    showSuggestions(parsed.suggestions);
    addVocabulary(parsed.vocabulary);
    recordSessionTurn();
    updateDueBadge();
    setStatus("");
    el.btnSummary.disabled = false;

    // Fin du test de positionnement : applique le niveau estimé (#17).
    if (state.mode === "eval" && parsed.done && parsed.level) {
      const mapped = { A1: "debutant", A2: "debutant", B1: "intermediaire", B2: "intermediaire", C1: "avance" }[parsed.level];
      if (mapped) el.level.value = mapped;
      saveSettings();
      addSystemNote(`🎯 Niveau estimé : ${parsed.level} — ${parsed.explanation || ""}`);
      addSystemNote(`Le niveau « ${el.level.options[el.level.selectedIndex].text} » est appliqué. Lance une 🔄 Nouvelle session pour converser.`);
    }

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
    el.summaryContent.textContent = await callClaude({ messages, system: buildSystemPrompt() });
  } catch (err) {
    el.summaryContent.textContent = "Erreur : " + err.message;
  }
}

// ---------- Modales ----------
function openModal(modal) { modal.classList.remove("hidden"); }
function closeModal(modal) { modal.classList.add("hidden"); }

// ---------- Carnet de vocabulaire (répétition espacée, boîtes de Leitner) ----------
const DECK_KEY = "polyglotte-deck";
const HISTORY_KEY = "polyglotte-history";
const DAY_MS = 24 * 60 * 60 * 1000;
// Intervalle avant la prochaine révision, par boîte (1 → 5).
const LEITNER_DAYS = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

function loadDeck() { try { return JSON.parse(localStorage.getItem(DECK_KEY)) || []; } catch (_) { return []; } }
function saveDeck(deck) { localStorage.setItem(DECK_KEY, JSON.stringify(deck)); }
function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (_) { return []; } }
function saveHistory(h) { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); }

function addVocabulary(items) {
  if (!Array.isArray(items) || !items.length) return;
  const deck = loadDeck();
  const lang = el.language.value;
  let added = false;
  for (const it of items) {
    if (!it || !it.term || !it.translation) continue;
    const key = it.term.trim().toLowerCase();
    if (deck.some(c => c.lang === lang && c.term.trim().toLowerCase() === key)) continue;
    deck.push({
      id: Date.now() + Math.random(),
      lang, term: it.term.trim(), translation: it.translation.trim(),
      reading: it.reading || null,
      box: 1, nextReview: Date.now(), addedAt: Date.now(),
    });
    added = true;
  }
  if (added) saveDeck(deck);
}

function dueCards() {
  const now = Date.now();
  return loadDeck().filter(c => c.nextReview <= now);
}

function updateDueBadge() {
  const n = dueCards().length;
  el.dueBadge.textContent = n;
  el.dueBadge.classList.toggle("hidden", n === 0);
}

// ---------- Historique des sessions et statistiques ----------
let currentSessionId = null;

function recordSessionTurn() {
  if (!currentSessionId) return;
  const history = loadHistory();
  let session = history.find(s => s.id === currentSessionId);
  if (!session) {
    session = {
      id: currentSessionId, date: Date.now(),
      lang: el.language.value, level: el.level.value, scenario: el.scenario.value,
      turns: 0,
    };
    history.push(session);
  }
  session.turns++;
  session.lastAt = Date.now();
  saveHistory(history);
}

function computeStreak(history) {
  const days = new Set(history.map(s => new Date(s.date).toDateString()));
  let streak = 0;
  const d = new Date();
  // La série n'est pas cassée si on n'a simplement pas encore pratiqué aujourd'hui.
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

function renderProgress() {
  const deck = loadDeck();
  const history = loadHistory();
  const due = dueCards().length;

  const stats = [
    { value: history.length, label: "sessions" },
    { value: computeStreak(history), label: "jours d'affilée" },
    { value: deck.length, label: "mots au carnet" },
    { value: due, label: "à réviser" },
  ];
  el.statsGrid.innerHTML = "";
  for (const s of stats) {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<div class="stat-value"></div><div class="stat-label"></div>`;
    card.querySelector(".stat-value").textContent = s.value;
    card.querySelector(".stat-label").textContent = s.label;
    el.statsGrid.appendChild(card);
  }

  const byLang = {};
  for (const s of history) {
    byLang[s.lang] = (byLang[s.lang] || 0) + 1;
  }
  const parts = Object.entries(byLang)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, n]) => `${LANGUAGES[lang]?.label || lang} : ${n} session${n > 1 ? "s" : ""}`);
  el.langStats.textContent = parts.length ? "Pratique — " + parts.join(" · ") : "";

  el.dueCount.textContent = due;
  el.btnReview.disabled = due === 0;
  el.btnExport.disabled = deck.length === 0;

  el.deckList.innerHTML = "";
  if (!deck.length) {
    el.deckList.innerHTML = `<div class="deck-empty">Encore aucun mot — lance une conversation !</div>`;
    return;
  }
  const recent = [...deck].sort((a, b) => b.addedAt - a.addedAt).slice(0, 100);
  for (const card of recent) {
    const row = document.createElement("div");
    row.className = "deck-row";
    row.innerHTML = `<span class="deck-lang"></span><span class="deck-term" dir="auto"></span>
      <span class="deck-reading"></span><span class="deck-translation"></span>
      <button class="deck-delete" title="Supprimer">✕</button>`;
    row.querySelector(".deck-lang").textContent = LANGUAGES[card.lang]?.label || card.lang;
    row.querySelector(".deck-term").textContent = card.term;
    row.querySelector(".deck-reading").textContent = card.reading || "";
    row.querySelector(".deck-translation").textContent = card.translation;
    row.querySelector(".deck-delete").addEventListener("click", () => {
      saveDeck(loadDeck().filter(c => c.id !== card.id));
      renderProgress();
      updateDueBadge();
    });
    el.deckList.appendChild(row);
  }
}

// ---------- Révision (flashcards) ----------
const review = { queue: [], index: 0 };

function voiceForLang(langId) {
  const cfg = LANGUAGES[langId];
  if (!cfg || !window.speechSynthesis) return null;
  const voices = speechSynthesis.getVoices();
  for (const prefix of cfg.ttsPrefixes) {
    const found = voices.find(v => v.lang.toLowerCase().replace("_", "-").startsWith(prefix));
    if (found) return found;
  }
  return null;
}

function speakCard(card) {
  const voice = voiceForLang(card.lang);
  if (!voice) return;
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(card.term);
  utter.voice = voice;
  utter.lang = voice.lang;
  utter.rate = parseFloat(el.voiceRate.value);
  speechSynthesis.speak(utter);
}

function startReview() {
  review.queue = dueCards().sort(() => Math.random() - 0.5);
  review.index = 0;
  if (!review.queue.length) return;
  el.progressHome.classList.add("hidden");
  el.reviewArea.classList.remove("hidden");
  showReviewCard();
}

function showReviewCard() {
  const card = review.queue[review.index];
  if (!card) { endReview(); return; }
  el.reviewTerm.textContent = card.term;
  el.reviewReading.textContent = card.reading || "";
  el.reviewAnswer.textContent = card.translation;
  el.reviewAnswer.classList.add("hidden");
  el.btnReveal.classList.remove("hidden");
  el.btnKnew.classList.add("hidden");
  el.btnMissed.classList.add("hidden");
  el.reviewProgress.textContent = `Carte ${review.index + 1} / ${review.queue.length} — ${LANGUAGES[card.lang]?.label || card.lang}`;
  speakCard(card);
}

function revealAnswer() {
  el.reviewAnswer.classList.remove("hidden");
  el.btnReveal.classList.add("hidden");
  el.btnKnew.classList.remove("hidden");
  el.btnMissed.classList.remove("hidden");
}

function gradeCard(knew) {
  const card = review.queue[review.index];
  const deck = loadDeck();
  const stored = deck.find(c => c.id === card.id);
  if (stored) {
    stored.box = knew ? Math.min(5, stored.box + 1) : 1;
    stored.nextReview = Date.now() + LEITNER_DAYS[stored.box] * DAY_MS;
    saveDeck(deck);
  }
  review.index++;
  updateDueBadge();
  if (review.index >= review.queue.length) endReview(true);
  else showReviewCard();
}

function endReview(finished = false) {
  el.reviewArea.classList.add("hidden");
  el.progressHome.classList.remove("hidden");
  renderProgress();
  if (finished) setStatus("Révision terminée 🎉");
}

// ---------- Grammaire & conjugaison (#19) ----------
function setGrammarStatus(text, isError = false) {
  el.grammarStatus.textContent = text || "";
  el.grammarStatus.classList.toggle("hidden", !text);
  el.grammarStatus.classList.toggle("error", isError);
}

function grammarSystemPrompt() {
  const cfg = langConfig();
  return `Tu es professeur de ${cfg.langFr} pour francophones. Réponds au niveau de l'élève :
${LEVEL_INSTRUCTIONS[el.level.value]}
Explications EN FRANÇAIS ; tous les exemples sont en ${cfg.langFr}, chacun suivi de sa traduction française
${cfg.reading ? "et d'une translittération latine" : ""}. Spécificités : ${cfg.promptExtra}`;
}

async function requestGrammar(kind) {
  const topic = el.grammarTopic.value.trim();
  if (!topic) { setGrammarStatus("Indique d'abord un sujet.", true); return; }
  if (!hasCredentials()) { setGrammarStatus("Ajoute d'abord ta clé API dans les réglages ⚙️.", true); return; }
  el.btnGrammarFiche.disabled = el.btnGrammarMap.disabled = true;
  el.grammarResult.classList.add("hidden");
  el.mindmapWrap.classList.add("hidden");
  el.grammarTitle.classList.add("hidden");
  setGrammarStatus(kind === "map" ? "Construction de la carte mentale…" : "Rédaction de la fiche…");
  try {
    const request = kind === "map"
      ? `Construis une carte mentale pédagogique sur : ${topic}`
      : `Rédige une fiche pédagogique complète sur : ${topic}`;
    const raw = await callClaude({
      messages: [{ role: "user", content: request }],
      system: grammarSystemPrompt(),
      schema: kind === "map" ? GRAMMAR_MAP_SCHEMA : GRAMMAR_FICHE_SCHEMA,
      maxTokens: 4096,
    });
    const parsed = JSON.parse(raw);
    el.grammarTitle.textContent = parsed.title;
    el.grammarTitle.classList.remove("hidden");
    if (kind === "map") {
      renderMindmap(el.mindmapWrap, parsed.title, parsed.nodes);
      el.mindmapWrap.classList.remove("hidden");
    } else {
      el.grammarResult.textContent = parsed.content;
      el.grammarResult.classList.remove("hidden");
    }
    setGrammarStatus("");
  } catch (err) {
    setGrammarStatus(err.message, true);
  } finally {
    el.btnGrammarFiche.disabled = el.btnGrammarMap.disabled = false;
  }
}

// Rendu SVG d'un arbre horizontal (racine à gauche). Liste plate id/parent,
// profondeur bornée, protection contre les cycles.
function renderMindmap(container, title, nodes) {
  const SVG = "http://www.w3.org/2000/svg";
  const COL_W = 200, ROW_H = 46, PAD = 14;
  const children = new Map([[0, []]]);
  for (const n of nodes) if (!children.has(n.id)) children.set(n.id, []);
  for (const n of nodes) {
    const parent = children.has(n.parent) ? n.parent : 0;
    children.get(parent).push(n);
  }
  const byId = new Map(nodes.map(n => [n.id, n]));
  const pos = new Map();
  let leaf = 0, maxDepth = 0;
  const visited = new Set();
  function layout(id, depth) {
    if (visited.has(id)) return leaf;               // garde anti-cycle
    visited.add(id);
    maxDepth = Math.max(maxDepth, depth);
    const kids = (children.get(id) || []).slice(0, 8);
    if (!kids.length || depth >= 3) { pos.set(id, { depth, row: leaf }); return leaf++; }
    const rows = kids.map(k => layout(k.id, depth + 1));
    const row = (Math.min(...rows) + Math.max(...rows)) / 2;
    pos.set(id, { depth, row });
    return row;
  }
  layout(0, 0);

  const width = (maxDepth + 1) * COL_W + PAD * 2;
  const height = Math.max(leaf, 1) * ROW_H + PAD * 2;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);

  const x = d => PAD + d * COL_W;
  const y = r => PAD + r * ROW_H + ROW_H / 2;

  function drawNode(id, label, note) {
    const p = pos.get(id);
    if (!p) return;
    const g = document.createElementNS(SVG, "g");
    const textW = Math.min(24, Math.max(6, label.length)) * 7.2 + 18;
    const rect = document.createElementNS(SVG, "rect");
    rect.setAttribute("x", x(p.depth));
    rect.setAttribute("y", y(p.row) - 15);
    rect.setAttribute("width", textW);
    rect.setAttribute("height", 30);
    rect.setAttribute("rx", 9);
    rect.setAttribute("class", `mm-node mm-depth-${p.depth}`);
    const text = document.createElementNS(SVG, "text");
    text.setAttribute("x", x(p.depth) + textW / 2);
    text.setAttribute("y", y(p.row) + 4);
    text.setAttribute("text-anchor", "middle");
    if (id === 0) text.setAttribute("class", "mm-root-text");
    text.textContent = label.length > 26 ? label.slice(0, 25) + "…" : label;
    g.appendChild(rect);
    g.appendChild(text);
    if (note) {
      const tip = document.createElementNS(SVG, "title");
      tip.textContent = note;
      g.appendChild(tip);
    }
    svg.appendChild(g);
  }

  function drawLink(fromId, toId) {
    const a = pos.get(fromId), b = pos.get(toId);
    if (!a || !b) return;
    const x1 = x(a.depth) + 150, y1 = y(a.row), x2 = x(b.depth), y2 = y(b.row);
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", `M ${x1} ${y1} C ${x1 + 28} ${y1}, ${x2 - 28} ${y2}, ${x2} ${y2}`);
    path.setAttribute("class", "mm-link");
    svg.appendChild(path);
  }

  for (const id of visited) {
    if (id === 0) continue;
    const n = byId.get(id);
    if (n) drawLink(children.has(n.parent) && visited.has(n.parent) ? n.parent : 0, id);
  }
  drawNode(0, title, null);
  for (const id of visited) {
    if (id === 0) continue;
    const n = byId.get(id);
    if (n) drawNode(id, n.label, n.note);
  }

  container.innerHTML = "";
  container.appendChild(svg);
}

// ---------- Exercices : dictée (#21) et prononciation (#22) ----------
const exo = { kind: null, sentences: [], index: 0, scores: [] };

function setExoStatus(text, isError = false) {
  el.exoStatus.textContent = text || "";
  el.exoStatus.classList.toggle("hidden", !text);
  el.exoStatus.classList.toggle("error", isError);
}

function exoSystemPrompt() {
  const cfg = langConfig();
  return `Tu es ${cfg.tutor.name}, professeur de ${cfg.langFr} pour francophones.
${LEVEL_INSTRUCTIONS[el.level.value]}
Spécificités de la langue : ${cfg.promptExtra}`;
}

async function startExercise(kind) {
  if (!hasCredentials()) { setExoStatus("Ajoute d'abord ta clé API dans les réglages ⚙️.", true); return; }
  const cfg = langConfig();
  unlockSpeechSynthesis();
  exo.kind = kind;
  exo.sentences = [];
  exo.index = 0;
  exo.scores = [];
  el.btnExoDictee.disabled = el.btnExoPrononciation.disabled = true;
  setExoStatus("Préparation des phrases…");
  try {
    const raw = await callClaude({
      messages: [{ role: "user", content: "Génère les 5 phrases de l'exercice." }],
      system: exoSystemPrompt(),
      schema: EXO_SCHEMA,
    });
    exo.sentences = JSON.parse(raw).sentences.slice(0, 5);
    if (!exo.sentences.length) throw new Error("Aucune phrase générée.");
    // Reconnaissance pour la prononciation (indépendante d'une conversation en cours).
    if (kind === "prononciation") {
      state.recognition = initRecognition(cfg.stt);
      state.transcriptHandler = (text) => gradeExoAttempt(text);
      if (!state.recognition) {
        setExoStatus("Reconnaissance vocale indisponible dans ce navigateur — utilise la dictée à la place.", true);
        el.btnExoDictee.disabled = el.btnExoPrononciation.disabled = false;
        return;
      }
    }
    refreshVoices();
    el.exoSetup.classList.add("hidden");
    el.exoArea.classList.remove("hidden");
    setExoStatus("");
    showExoSentence();
  } catch (err) {
    setExoStatus(err.message, true);
  } finally {
    el.btnExoDictee.disabled = el.btnExoPrononciation.disabled = false;
  }
}

function currentExoSentence() { return exo.sentences[exo.index]; }

function speakExoSentence() {
  const s = currentExoSentence();
  if (s) speakIgnoringAutospeak(s.text);
}

function showExoSentence() {
  const s = currentExoSentence();
  if (!s) { endExercise(); return; }
  el.exoProgress.textContent = `Phrase ${exo.index + 1} / ${exo.sentences.length}`;
  el.exoFeedback.classList.add("hidden");
  el.btnExoRetry.classList.add("hidden");
  el.btnExoNext.classList.add("hidden");
  if (exo.kind === "dictee") {
    el.exoSentence.textContent = "🎧 Écoute, puis écris la phrase.";
    el.exoReading.textContent = "";
    el.exoInput.value = "";
    el.exoInput.classList.remove("hidden");
    el.btnExoCheck.classList.remove("hidden");
    el.btnExoMic.classList.add("hidden");
    speakExoSentence();
    el.exoInput.focus();
  } else {
    el.exoSentence.textContent = s.text;
    el.exoReading.textContent = s.reading || "";
    el.exoInput.classList.add("hidden");
    el.btnExoCheck.classList.add("hidden");
    el.btnExoMic.classList.remove("hidden");
  }
}

// Normalisation avant comparaison : casse, ponctuation, diacritiques arabes ;
// comparaison par caractère pour le japonais (pas d'espaces).
function normalizeTokens(text) {
  let t = text.toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/[.,;:!?¿¡«»"“”'’‘…()\-—、。，！？「」・]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (el.language.value === "japonais") return [...t.replace(/ /g, "")];
  return t ? t.split(" ") : [];
}

// Indices des jetons de `target` retrouvés dans `attempt` (alignement LCS).
function lcsMatchedIndices(target, attempt) {
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

function gradeExoAttempt(attemptText) {
  const s = currentExoSentence();
  if (!s) return;
  const isJa = el.language.value === "japonais";
  const target = normalizeTokens(s.text);
  const attempt = normalizeTokens(attemptText);
  const matched = lcsMatchedIndices(target, attempt);
  const score = target.length ? Math.round((matched.size / target.length) * 100) : 0;
  exo.scores[exo.index] = score;

  el.exoFeedback.innerHTML = "";
  const expected = document.createElement("div");
  expected.className = "exo-line";
  expected.append("Attendu : ");
  const span = document.createElement("span");
  span.dir = "auto";
  target.forEach((tok, i) => {
    const w = document.createElement("span");
    w.className = matched.has(i) ? "exo-ok" : "exo-miss";
    w.textContent = tok;
    span.appendChild(w);
    if (!isJa && i < target.length - 1) span.append(" ");
  });
  expected.appendChild(span);
  const yours = document.createElement("div");
  yours.className = "exo-line";
  yours.textContent = `Ta version : ${attemptText}`;
  const scoreLine = document.createElement("div");
  scoreLine.className = "exo-score";
  scoreLine.textContent = `${score} % ${score >= 90 ? "🎉" : score >= 60 ? "👍" : "💪 On réessaie ?"}`;
  el.exoFeedback.append(expected, yours, scoreLine);
  if (exo.kind === "dictee") {
    const full = document.createElement("div");
    full.className = "exo-line";
    full.append(`Phrase complète : ${s.text}`);
    if (s.reading) full.append(` (${s.reading})`);
    el.exoFeedback.appendChild(full);
  }
  el.exoFeedback.classList.remove("hidden");
  el.btnExoRetry.classList.remove("hidden");
  el.btnExoNext.classList.remove("hidden");
  el.btnExoCheck.classList.add("hidden");
}

function nextExoSentence() {
  exo.index++;
  if (exo.index >= exo.sentences.length) {
    const done = exo.scores.filter(s => s !== undefined);
    const avg = done.length ? Math.round(done.reduce((a, b) => a + b, 0) / done.length) : 0;
    el.exoProgress.textContent = "Série terminée !";
    el.exoSentence.textContent = `Score moyen : ${avg} %`;
    el.exoReading.textContent = "";
    el.exoFeedback.classList.add("hidden");
    el.exoInput.classList.add("hidden");
    el.btnExoCheck.classList.add("hidden");
    el.btnExoMic.classList.add("hidden");
    el.btnExoRetry.classList.add("hidden");
    el.btnExoNext.classList.add("hidden");
    return;
  }
  showExoSentence();
}

function endExercise() {
  stopListening();
  state.transcriptHandler = null;
  el.exoArea.classList.add("hidden");
  el.exoSetup.classList.remove("hidden");
  setExoStatus("");
}

// ---------- Export Anki ----------
function exportDeck() {
  const deck = loadDeck();
  if (!deck.length) return;
  const lines = ["#separator:tab", "#html:false"];
  for (const c of deck) {
    lines.push([c.term, c.reading || "", c.translation, LANGUAGES[c.lang]?.label || c.lang]
      .map(v => String(v).replace(/\t/g, " ")).join("\t"));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "polyglotte-vocabulaire.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

// ---------- Démarrage ----------
function startSession(mode) {
  unlockSpeechSynthesis();
  if (!hasCredentials()) {
    openModal(el.settingsModal);
    setStatus("Ajoute d'abord ta clé API Anthropic, puis relance la conversation.", true);
    return;
  }
  const cfg = langConfig();
  state.started = true;
  state.mode = mode;
  state.history = [];
  currentSessionId = Date.now();
  saveSettings();

  // La reconnaissance est (ré)initialisée avec la locale de la langue choisie.
  state.recognition = initRecognition(cfg.stt);
  refreshVoices();

  el.welcomeCard.classList.add("hidden");
  el.inputBar.classList.remove("hidden");
  el.btnNewSession.classList.remove("hidden");
  const levelLabel = el.level.options[el.level.selectedIndex].text;
  const scenarioLabel = el.scenario.options[el.scenario.selectedIndex].text;
  if (mode === "eval") {
    addSystemNote(`🎯 Test de niveau — ${cfg.label} — avec ${cfg.tutor.name} (${cfg.tutor.city})`);
  } else {
    addSystemNote(`Session — ${cfg.label} · ${levelLabel} · ${scenarioLabel}${el.immersion.checked ? " · 🌊 Immersion" : ""} — avec ${cfg.tutor.name} (${cfg.tutor.city})`);
  }
  if (cfg.support !== "full" && cfg.supportNote) addSystemNote("⚠️ " + cfg.supportNote);
  sendMessage("[START]", { display: false });
}

function startConversation() { startSession("chat"); }
function startAssessment() { startSession("eval"); }

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
  el.immersion.addEventListener("change", saveSettings);
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
  for (const input of [el.apiKey, el.model, el.autospeak, el.showTranslations, el.listenMode, el.voiceRate]) {
    input.addEventListener("change", saveSettings);
  }

  // Test de niveau, grammaire, exercices
  el.btnAssess.addEventListener("click", startAssessment);
  el.btnGrammar.addEventListener("click", () => openModal(el.grammarModal));
  el.btnGrammarClose.addEventListener("click", () => closeModal(el.grammarModal));
  el.btnGrammarFiche.addEventListener("click", () => requestGrammar("fiche"));
  el.btnGrammarMap.addEventListener("click", () => requestGrammar("map"));
  el.grammarTopic.addEventListener("keydown", (e) => { if (e.key === "Enter") requestGrammar("fiche"); });

  el.btnExercises.addEventListener("click", () => { endExercise(); openModal(el.exoModal); });
  el.btnExoClose.addEventListener("click", () => { endExercise(); closeModal(el.exoModal); });
  el.btnExoDictee.addEventListener("click", () => startExercise("dictee"));
  el.btnExoPrononciation.addEventListener("click", () => startExercise("prononciation"));
  el.btnExoSpeak.addEventListener("click", speakExoSentence);
  el.btnExoMic.addEventListener("click", () => (state.listening ? stopListening() : startListening()));
  el.btnExoCheck.addEventListener("click", () => {
    const value = el.exoInput.value.trim();
    if (value) gradeExoAttempt(value);
  });
  el.exoInput.addEventListener("keydown", (e) => { if (e.key === "Enter") el.btnExoCheck.click(); });
  el.btnExoRetry.addEventListener("click", () => {
    el.exoFeedback.classList.add("hidden");
    el.btnExoRetry.classList.add("hidden");
    el.btnExoNext.classList.add("hidden");
    if (exo.kind === "dictee") {
      el.exoInput.value = "";
      el.btnExoCheck.classList.remove("hidden");
      speakExoSentence();
    }
  });
  el.btnExoNext.addEventListener("click", nextExoSentence);

  el.btnSummary.addEventListener("click", generateSummary);
  el.btnSummaryClose.addEventListener("click", () => closeModal(el.summaryModal));

  // Progrès & révisions
  updateDueBadge();
  el.btnProgress.addEventListener("click", () => { renderProgress(); endReviewUIReset(); openModal(el.progressModal); });
  el.btnProgressClose.addEventListener("click", () => closeModal(el.progressModal));
  el.btnReview.addEventListener("click", startReview);
  el.btnReviewBack.addEventListener("click", () => endReview());
  el.btnReveal.addEventListener("click", revealAnswer);
  el.btnKnew.addEventListener("click", () => gradeCard(true));
  el.btnMissed.addEventListener("click", () => gradeCard(false));
  el.btnReviewSpeak.addEventListener("click", () => {
    const card = review.queue[review.index];
    if (card) speakCard(card);
  });
  el.btnExport.addEventListener("click", exportDeck);
}

// L'ouverture de la modale repart toujours de l'écran d'accueil du progrès.
function endReviewUIReset() {
  el.reviewArea.classList.add("hidden");
  el.progressHome.classList.remove("hidden");
}

init();
