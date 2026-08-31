// Polyglotte v2 — application universelle (iOS / Android / web) sur Expo.
// Navigation simple entre écrans, consommant le cœur partagé (app/core),
// l'abstraction vocale (app/speech) et les écrans (app/ui).

import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { callModel, hasCredentials } from "./core/api";
import { streamOrCallLocal, partialStringField, createSentenceStreamer } from "./core/stream";
import { BASE_SCENARIOS, LANGUAGES, langConfig } from "./core/languages";
import { addVocabulary } from "./core/leitner";
import { buildTutorPrompt, summaryRequest } from "./core/prompts";
import { ASSESS_SCHEMA, RESPONSE_SCHEMA } from "./core/schemas";
import { registerServiceWorker } from "./pwa/pwa";
import * as speech from "./speech/speech";
import {
  DEFAULT_PROFILE, keysFor, loadJSON, loadProfiles, removeProfileData, saveJSON, saveProfiles,
} from "./storage";
import { C, Chip, ui } from "./ui/common";
import ExercisesScreen from "./ui/ExercisesScreen";
import GrammarScreen from "./ui/GrammarScreen";
import ProgressScreen from "./ui/ProgressScreen";
import SettingsModal from "./ui/SettingsModal";

const DEFAULT_SETTINGS = {
  provider: "claude",
  apiKey: "",
  model: "claude-opus-5",
  localUrl: "",
  localKey: "",
  localModel: "",
  localModelAlt: "",
  autospeak: true,
  rate: 1,
  reversedCards: false,
};

const LEVELS = [
  ["debutant", "Débutant"],
  ["intermediaire", "Intermédiaire"],
  ["avance", "Avancé"],
];

// Niveau CECRL estimé par le test → niveau de l'app.
const CEFR_TO_LEVEL = { A1: "debutant", A2: "debutant", B1: "intermediaire", B2: "intermediaire", C1: "avance" };

const SCREEN_TITLES = { grammar: "🧠 Grammaire", exos: "✍️ Exercices", progress: "📊 Progrès" };

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [profiles, setProfiles] = useState({ list: [DEFAULT_PROFILE], current: DEFAULT_PROFILE });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [screen, setScreen] = useState("home");

  const [langId, setLangId] = useState("catalan");
  const [tnScript, setTnScript] = useState("arabe");
  const [level, setLevel] = useState("debutant");
  const [scenarioId, setScenarioId] = useState("libre");
  const [immersion, setImmersion] = useState(false);

  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState({ text: "", error: false });
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [input, setInput] = useState("");

  // Références stables pour la session en cours (pas besoin de re-render).
  const session = useRef({ cfg: null, mode: "chat", system: "", history: [], recognizer: null, id: null });
  const scrollRef = useRef(null);

  const keys = keysFor(profiles.current);

  useEffect(() => {
    registerServiceWorker();
    loadProfiles().then(async (p) => {
      setProfiles(p);
      const saved = await loadJSON(keysFor(p.current).settings, null);
      setSettings(saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS);
    });
  }, []);

  const saveSettings = (next) => {
    setSettings(next);
    saveJSON(keys.settings, next);
  };

  // Change de profil : recharge les réglages du profil visé (carnet et historique
  // sont relus par les écrans via `keys`).
  const switchProfile = async (name) => {
    const next = { ...profiles, current: name };
    setProfiles(next);
    saveProfiles(next);
    const saved = await loadJSON(keysFor(name).settings, null);
    setSettings(saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS);
    setSettingsOpen(false);
    setScreen("home");
    setStatus({ text: `Profil « ${name} » actif.`, error: false });
  };

  const addProfile = (name) => {
    const next = { list: [...profiles.list, name], current: name };
    setProfiles(next);
    saveProfiles(next);
    setSettings(DEFAULT_SETTINGS);
    setSettingsOpen(false);
    setScreen("home");
    setStatus({ text: `Profil « ${name} » créé — configure son moteur IA.`, error: false });
  };

  const deleteProfile = async (name) => {
    if (name === DEFAULT_PROFILE) return;
    await removeProfileData(name);
    const list = profiles.list.filter(n => n !== name);
    const next = { list, current: DEFAULT_PROFILE };
    setProfiles(next);
    saveProfiles(next);
    const saved = await loadJSON(keysFor(DEFAULT_PROFILE).settings, null);
    setSettings(saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS);
    setSettingsOpen(false);
    setScreen("home");
    setStatus({ text: `Profil « ${name} » supprimé.`, error: false });
  };

  const cfg = langConfig(langId, tnScript);
  const scenarios = [
    ...BASE_SCENARIOS,
    ...(cfg.scenarios || []).map(s => [s.id, s.label]),
  ];

  // ---------- Session ----------

  const startSession = (mode) => {
    if (!hasCredentials(settings)) {
      setSettingsOpen(true);
      setStatus({ text: "Configure d'abord ton moteur IA dans les réglages.", error: true });
      return;
    }
    speech.primeSpeech();
    const c = langConfig(langId, tnScript);
    session.current = {
      cfg: c,
      mode,
      system: buildTutorPrompt({ cfg: c, level, scenarioId, immersion, mode }),
      history: [],
      recognizer: null,
      id: mode === "chat" ? `${Date.now()}` : null,
    };
    setMessages([]);
    setSuggestions([]);
    setMicMuted(false);
    setScreen("chat");
    setStatus({ text: "", error: false });
    send("[START]");
  };

  const recordSessionTurn = async () => {
    const s = session.current;
    if (!s.id) return;
    const history = await loadJSON(keys.history, []);
    let entry = history.find(h => h.id === s.id);
    if (!entry) {
      entry = { id: s.id, date: Date.now(), lang: langId, level, scenario: scenarioId, turns: 0 };
      history.push(entry);
    }
    entry.turns++;
    entry.lastAt = Date.now();
    saveJSON(keys.history, history);
  };

  const endSession = async () => {
    speech.stopSpeaking();
    stopMic();
    const s = session.current;
    if (s.mode === "chat" && s.history.length >= 4 && !busy) {
      setBusy(true);
      setStatus({ text: "Je prépare ton résumé de session…", error: false });
      try {
        const text = await callModel(settings, {
          messages: [...s.history, { role: "user", content: summaryRequest({ cfg: s.cfg }) }],
          system: s.system,
          maxTokens: 1024,
        });
        setMessages(m => [...m, { role: "summary", text }]);
        setStatus({ text: "Résumé de session — reviens à l'accueil quand tu veux.", error: false });
      } catch (err) {
        setStatus({ text: err.message, error: true });
      }
      setBusy(false);
      setSuggestions([]);
      session.current.history = [];
    } else {
      setScreen("home");
    }
  };

  const send = async (rawText) => {
    const text = rawText.trim();
    if (!text || busy) return;
    const s = session.current;
    stopMic();
    setInput("");
    setBusy(true);
    if (text !== "[START]") {
      setMessages(m => [...m, { role: "user", text }]);
    }
    setSuggestions([]);
    setStatus({ text: `${s.cfg.tutor.name} réfléchit…`, error: false });
    s.history.push({ role: "user", content: text });
    // Streaming phrase par phrase (#43) : moteur compatible OpenAI, hors évaluation.
    const useStream = settings.provider === "local" && s.mode !== "eval";
    let streamed = false; // un message provisoire est affiché en cours de stream
    try {
      const opts = {
        messages: s.history,
        system: s.system,
        schema: s.mode === "eval" ? ASSESS_SCHEMA : RESPONSE_SCHEMA,
        maxTokens: 1024,
      };
      let raw;
      if (useStream) {
        const speaker = settings.autospeak
          ? createSentenceStreamer(sentence =>
              speech.speak(sentence, { ttsPrefixes: s.cfg.ttsPrefixes, rate: settings.rate, queue: true }))
          : null;
        opts.onDelta = (accumulated) => {
          const partial = partialStringField(accumulated, "reply");
          if (!partial || !partial.text) return;
          if (speaker) {
            speaker.push(partial.text);
            if (partial.complete) speaker.flush(partial.text);
          }
          setMessages(m => [...(streamed ? m.slice(0, -1) : m), { role: "tutor", text: partial.text, streaming: true }]);
          streamed = true;
          setStatus({ text: "", error: false });
        };
        raw = await streamOrCallLocal(settings, opts);
      } else {
        raw = await callModel(settings, opts);
      }
      const data = JSON.parse(raw);
      s.history.push({ role: "assistant", content: data.reply });
      if (s.mode === "eval") {
        setMessages(m => [...m, {
          role: "tutor",
          text: data.reply,
          reading: data.reading,
          translation: data.translation,
          assessed: data.done ? { level: data.level, explanation: data.explanation } : null,
        }]);
      } else {
        const correction = data.correction && data.correction.original !== data.correction.corrected
          ? data.correction : null;
        setMessages(m => [...(streamed ? m.slice(0, -1) : m), {
          role: "tutor",
          text: data.reply,
          reading: data.reading,
          translation: data.translation,
          correction,
          culturalNote: data.cultural_note,
        }]);
        setSuggestions(data.suggestions || []);
        recordSessionTurn();
        if (Array.isArray(data.vocabulary) && data.vocabulary.length) {
          loadJSON(keys.deck, []).then(deck => {
            const next = addVocabulary(deck, langId, data.vocabulary);
            if (next !== deck) saveJSON(keys.deck, next);
          });
        }
      }
      setStatus({ text: "", error: false });
      if (settings.autospeak && !streamed) {
        speech.speak(data.reply, {
          ttsPrefixes: s.cfg.ttsPrefixes,
          rate: settings.rate,
        });
      }
    } catch (err) {
      s.history.pop();
      if (streamed) setMessages(m => m.slice(0, -1));
      setStatus({ text: err.message, error: true });
    }
    setBusy(false);
  };

  const adoptLevel = (cefr) => {
    const lvl = CEFR_TO_LEVEL[cefr];
    if (lvl) {
      setLevel(lvl);
      setStatus({ text: `Niveau réglé sur « ${LEVELS.find(l => l[0] === lvl)[1]} ». Bonne pratique !`, error: false });
    }
    setScreen("home");
  };

  // ---------- Micro ----------

  const startMic = () => {
    if (busy || micMuted || listening) return;
    const s = session.current;
    if (!s.recognizer) {
      s.recognizer = speech.createRecognizer({
        lang: s.cfg.stt,
        onStart: () => setListening(true),
        onInterim: (t) => setStatus({ text: `🎤 « ${t} »`, error: false }),
        onResult: (t) => send(t),
        onError: (msg) => setStatus({ text: msg, error: true }),
        onEnd: () => setListening(false),
      });
    }
    if (!s.recognizer) {
      setStatus({
        text: "La reconnaissance vocale n'est pas disponible ici — écris tes réponses.",
        error: true,
      });
      return;
    }
    setStatus({ text: `🎤 Je t'écoute… parle en ${s.cfg.label.toLowerCase()} !`, error: false });
    s.recognizer.start();
  };

  const stopMic = () => {
    if (session.current.recognizer && listening) session.current.recognizer.stop();
  };

  const toggleMute = () => {
    const muted = !micMuted;
    setMicMuted(muted);
    if (muted) stopMic();
    setStatus({
      text: muted ? "🔇 Micro coupé — réactive-le quand tu veux." : "Micro réactivé.",
      error: false,
    });
  };

  // ---------- Rendu ----------

  const targetStyle = cfg.rtl ? { writingDirection: "rtl", textAlign: "right" } : null;

  if (screen === "home") {
    return (
      <View style={st.root}>
        <StatusBar style="light" />
        <View style={st.header}>
          <Text style={st.headerTitle}>Polyglotte</Text>
          <Pressable onPress={() => setSettingsOpen(true)}><Text style={st.headerBtn}>⚙️</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={st.homeBody}>
          <Text style={ui.sectionTitle}>Langue</Text>
          <View style={ui.chipRow}>
            {Object.entries(LANGUAGES).map(([id, l]) => (
              <Chip key={id} label={l.label} active={langId === id} onPress={() => { setLangId(id); setScenarioId("libre"); }} />
            ))}
          </View>
          {langId === "tunisien" && (
            <View style={ui.chipRow}>
              <Chip label="Écriture arabe" active={tnScript === "arabe"} onPress={() => setTnScript("arabe")} />
              <Chip label="Arabizi (latin)" active={tnScript === "arabizi"} onPress={() => setTnScript("arabizi")} />
            </View>
          )}
          <Text style={ui.sectionTitle}>Niveau</Text>
          <View style={ui.chipRow}>
            {LEVELS.map(([id, label]) => (
              <Chip key={id} label={label} active={level === id} onPress={() => setLevel(id)} />
            ))}
            <Chip label="🎓 Test de niveau" active={false} onPress={() => startSession("eval")} />
          </View>
          <Text style={ui.sectionTitle}>Scénario</Text>
          <View style={ui.chipRow}>
            {scenarios.map(([id, label]) => (
              <Chip key={id} label={label} active={scenarioId === id} onPress={() => setScenarioId(id)} />
            ))}
          </View>
          <View style={st.switchRow}>
            <Text style={ui.label}>Immersion totale (aucune correction affichée)</Text>
            <Switch value={immersion} onValueChange={setImmersion} trackColor={{ true: C.primary }} />
          </View>
          <Pressable onPress={() => startSession("chat")} style={[ui.primaryBtn, { marginTop: 20 }]}>
            <Text style={ui.primaryBtnText}>🎙️ Commencer la conversation</Text>
          </Pressable>
          <View style={[ui.chipRow, { marginTop: 12 }]}>
            <Pressable onPress={() => setScreen("grammar")} style={[ui.secondaryBtn, st.navBtn]}>
              <Text style={ui.secondaryBtnText}>🧠 Grammaire</Text>
            </Pressable>
            <Pressable onPress={() => setScreen("exos")} style={[ui.secondaryBtn, st.navBtn]}>
              <Text style={ui.secondaryBtnText}>✍️ Exercices</Text>
            </Pressable>
            <Pressable onPress={() => setScreen("progress")} style={[ui.secondaryBtn, st.navBtn]}>
              <Text style={ui.secondaryBtnText}>📊 Progrès</Text>
            </Pressable>
          </View>
          {!!status.text && <Text style={[ui.status, status.error && ui.statusError]}>{status.text}</Text>}
          <Text style={st.hint}>
            Version 2 (aperçu) — l'app complète reste disponible sur la page principale.
          </Text>
        </ScrollView>
        <SettingsModal
          visible={settingsOpen}
          settings={settings}
          profiles={profiles}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onSwitchProfile={switchProfile}
          onAddProfile={addProfile}
          onDeleteProfile={deleteProfile}
        />
      </View>
    );
  }

  if (screen !== "chat") {
    return (
      <View style={st.root}>
        <StatusBar style="light" />
        <View style={st.header}>
          <Pressable onPress={() => { speech.stopSpeaking(); setScreen("home"); }}>
            <Text style={st.headerBtn}>←</Text>
          </Pressable>
          <Text style={st.headerTitle}>{SCREEN_TITLES[screen]}</Text>
          <Pressable onPress={() => setSettingsOpen(true)}><Text style={st.headerBtn}>⚙️</Text></Pressable>
        </View>
        {screen === "grammar" && (
          <GrammarScreen settings={settings} cfg={cfg} level={level} onOpenSettings={() => setSettingsOpen(true)} />
        )}
        {screen === "exos" && (
          <ExercisesScreen settings={settings} cfg={cfg} langId={langId} level={level} onOpenSettings={() => setSettingsOpen(true)} />
        )}
        {screen === "progress" && <ProgressScreen settings={settings} keys={keys} />}
        <SettingsModal
          visible={settingsOpen}
          settings={settings}
          profiles={profiles}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onSwitchProfile={switchProfile}
          onAddProfile={addProfile}
          onDeleteProfile={deleteProfile}
        />
      </View>
    );
  }

  return (
    <View style={st.root}>
      <StatusBar style="light" />
      <View style={st.header}>
        <Pressable onPress={() => { speech.stopSpeaking(); stopMic(); setScreen("home"); }}>
          <Text style={st.headerBtn}>←</Text>
        </Pressable>
        <Text style={st.headerTitle}>
          {session.current.mode === "eval" ? "🎓 Test de niveau" : `${session.current.cfg?.tutor.name} · ${session.current.cfg?.tutor.city}`}
        </Text>
        <Pressable onPress={endSession}><Text style={st.headerBtn}>✅</Text></Pressable>
      </View>
      <ScrollView
        ref={scrollRef}
        style={st.chat}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m, i) => (
          <View key={i}>
            {m.role === "user" && (
              <View style={[st.bubble, st.bubbleUser]}>
                <Text style={st.bubbleUserText}>{m.text}</Text>
              </View>
            )}
            {m.role === "tutor" && (
              <View style={[st.bubble, st.bubbleTutor]}>
                <Pressable onPress={() => speech.speak(m.text, { ttsPrefixes: session.current.cfg.ttsPrefixes, rate: settings.rate })}>
                  <Text style={[st.targetText, targetStyle]}>{m.text}</Text>
                </Pressable>
                {!!m.reading && <Text style={st.reading}>{m.reading}</Text>}
                {!!m.translation && <Text style={st.translation}>{m.translation}</Text>}
                {m.correction && (
                  <View style={st.correction}>
                    <Text style={st.correctionTitle}>✏️ Correction</Text>
                    <Text style={st.correctionLine}>✗ {m.correction.original}</Text>
                    <Text style={st.correctionLineOk}>✓ {m.correction.corrected}</Text>
                    <Text style={st.correctionExpl}>{m.correction.explanation}</Text>
                  </View>
                )}
                {!!m.culturalNote && (
                  <View style={st.culture}>
                    <Text style={st.cultureText}>🌍 {m.culturalNote}</Text>
                  </View>
                )}
                {m.assessed && (
                  <View style={st.assessed}>
                    <Text style={st.assessedLevel}>Niveau estimé : {m.assessed.level}</Text>
                    <Text style={st.correctionExpl}>{m.assessed.explanation}</Text>
                    <Pressable onPress={() => adoptLevel(m.assessed.level)} style={[ui.primaryBtn, { marginTop: 8 }]}>
                      <Text style={ui.primaryBtnText}>Adopter ce niveau</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
            {m.role === "summary" && (
              <View style={[st.bubble, st.bubbleSummary]}>
                <Text style={st.summaryTitle}>📋 Résumé de session</Text>
                <Text style={st.summaryText}>{m.text}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      {suggestions.length > 0 && (
        <ScrollView horizontal style={st.suggestions} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
          {suggestions.map((sgt, i) => (
            <Chip key={i} label={sgt} active={false} onPress={() => send(sgt)} />
          ))}
        </ScrollView>
      )}
      {!!status.text && <Text style={[ui.status, { paddingHorizontal: 14 }, status.error && ui.statusError]}>{status.text}</Text>}
      <View style={st.inputRow}>
        <Pressable onPress={toggleMute} style={[st.roundBtn, micMuted && st.roundBtnMuted]}>
          <Text style={st.roundBtnText}>{micMuted ? "🔇" : "🔈"}</Text>
        </Pressable>
        <TextInput
          style={st.input}
          value={input}
          onChangeText={setInput}
          placeholder={`Écris en ${cfg.label.toLowerCase()} ou en français…`}
          placeholderTextColor={C.faint}
          onSubmitEditing={() => send(input)}
          editable={!busy}
        />
        <Pressable onPress={() => send(input)} style={st.roundBtn} disabled={busy}>
          <Text style={st.roundBtnText}>➤</Text>
        </Pressable>
        <Pressable
          onPress={listening ? stopMic : startMic}
          style={[st.roundBtn, st.micBtn, listening && st.micBtnActive]}
          disabled={busy || micMuted}
        >
          <Text style={st.roundBtnText}>🎤</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, ...(Platform.OS === "web" ? { maxWidth: 780, width: "100%", marginHorizontal: "auto" } : null) },
  header: {
    backgroundColor: C.primary,
    paddingTop: Platform.OS === "web" ? 14 : 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 19, fontWeight: "700" },
  headerBtn: { color: "#fff", fontSize: 22, paddingHorizontal: 4 },
  homeBody: { padding: 16, gap: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, gap: 10 },
  navBtn: { flexGrow: 1, paddingHorizontal: 10 },
  hint: { color: C.faint, fontSize: 12, marginTop: 16, textAlign: "center" },
  chat: { flex: 1 },
  bubble: { borderRadius: 14, padding: 12, maxWidth: "88%" },
  bubbleUser: { backgroundColor: C.primary, alignSelf: "flex-end" },
  bubbleUserText: { color: "#fff", fontSize: 16 },
  bubbleTutor: { backgroundColor: C.card, alignSelf: "flex-start", borderWidth: 1, borderColor: C.border, gap: 4 },
  targetText: { fontSize: 17, color: C.text, fontWeight: "500" },
  reading: { fontSize: 14, color: C.muted, fontStyle: "italic" },
  translation: { fontSize: 13, color: C.faint },
  correction: { backgroundColor: "#fff7ed", borderRadius: 8, padding: 8, marginTop: 6, gap: 2 },
  correctionTitle: { fontSize: 12, fontWeight: "700", color: C.primary },
  correctionLine: { fontSize: 14, color: C.error },
  correctionLineOk: { fontSize: 14, color: C.ok, fontWeight: "600" },
  correctionExpl: { fontSize: 13, color: "#57534e" },
  culture: { backgroundColor: "#eff6ff", borderRadius: 8, padding: 8, marginTop: 6 },
  cultureText: { fontSize: 13, color: "#1e40af" },
  assessed: { backgroundColor: "#f0fdf4", borderRadius: 8, padding: 10, marginTop: 6 },
  assessedLevel: { fontSize: 16, fontWeight: "800", color: C.ok },
  bubbleSummary: { backgroundColor: "#fffbeb", alignSelf: "stretch", maxWidth: "100%", borderWidth: 1, borderColor: "#fde68a" },
  summaryTitle: { fontWeight: "700", color: "#92400e", marginBottom: 6 },
  summaryText: { color: "#44403c", fontSize: 14, lineHeight: 21 },
  suggestions: { maxHeight: 44, marginBottom: 4 },
  inputRow: { flexDirection: "row", gap: 8, padding: 10, alignItems: "center", backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },
  input: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, fontSize: 15, color: C.text, backgroundColor: C.bg },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#f5f5f4", alignItems: "center", justifyContent: "center" },
  roundBtnMuted: { backgroundColor: "#fecaca" },
  micBtn: { backgroundColor: C.primary },
  micBtnActive: { backgroundColor: "#16a34a" },
  roundBtnText: { fontSize: 18 },
});
