// Polyglotte v2 — application universelle (iOS / Android / web) sur Expo.
// Écran de conversation MVP consommant le cœur partagé (app/core) et
// l'abstraction vocale multi-plateforme (app/speech).

import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { LANGUAGES, BASE_SCENARIOS, langConfig } from "./core/languages";
import { buildTutorPrompt, summaryRequest } from "./core/prompts";
import { RESPONSE_SCHEMA } from "./core/schemas";
import { callModel, hasCredentials } from "./core/api";
import { addVocabulary } from "./core/leitner";
import * as speech from "./speech/speech";

const SETTINGS_KEY = "polyglotte.v2::settings";
const DECK_KEY = "polyglotte.v2::deck";

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
};

const LEVELS = [
  ["debutant", "Débutant"],
  ["intermediaire", "Intermédiaire"],
  ["avance", "Avancé"],
];

function Chip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[st.chip, active && st.chipActive]}>
      <Text style={[st.chipText, active && st.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
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
  const session = useRef({ cfg: null, system: "", history: [], recognizer: null });
  const scrollRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      if (raw) setSettings(s => ({ ...s, ...JSON.parse(raw) }));
    }).catch(() => {});
  }, []);

  const saveSettings = (next) => {
    setSettings(next);
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
  };

  const cfg = langConfig(langId, tnScript);
  const scenarios = [
    ...BASE_SCENARIOS,
    ...(cfg.scenarios || []).map(s => [s.id, s.label]),
  ];

  // ---------- Session ----------

  const startSession = () => {
    if (!hasCredentials(settings)) {
      setSettingsOpen(true);
      setStatus({ text: "Configure d'abord ton moteur IA dans les réglages.", error: true });
      return;
    }
    speech.primeSpeech();
    const c = langConfig(langId, tnScript);
    session.current = {
      cfg: c,
      system: buildTutorPrompt({ cfg: c, level, scenarioId, immersion, mode: "chat" }),
      history: [],
      recognizer: null,
    };
    setMessages([]);
    setSuggestions([]);
    setMicMuted(false);
    setScreen("chat");
    setStatus({ text: "", error: false });
    send("[START]");
  };

  const endSession = async () => {
    speech.stopSpeaking();
    stopMic();
    const s = session.current;
    if (s.history.length >= 4 && !busy) {
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
    try {
      const raw = await callModel(settings, {
        messages: s.history,
        system: s.system,
        schema: RESPONSE_SCHEMA,
        maxTokens: 1024,
      });
      const data = JSON.parse(raw);
      s.history.push({ role: "assistant", content: data.reply });
      const correction = data.correction && data.correction.original !== data.correction.corrected
        ? data.correction : null;
      setMessages(m => [...m, {
        role: "tutor",
        text: data.reply,
        reading: data.reading,
        translation: data.translation,
        correction,
        culturalNote: data.cultural_note,
      }]);
      setSuggestions(data.suggestions || []);
      setStatus({ text: "", error: false });
      if (Array.isArray(data.vocabulary) && data.vocabulary.length) {
        AsyncStorage.getItem(DECK_KEY).then(rawDeck => {
          const deck = rawDeck ? JSON.parse(rawDeck) : [];
          const next = addVocabulary(deck, langId, data.vocabulary);
          if (next !== deck) AsyncStorage.setItem(DECK_KEY, JSON.stringify(next));
        }).catch(() => {});
      }
      if (settings.autospeak) {
        speech.speak(data.reply, {
          ttsPrefixes: s.cfg.ttsPrefixes,
          rate: settings.rate,
          onEnd: () => {},
        });
      }
    } catch (err) {
      s.history.pop();
      setStatus({ text: err.message, error: true });
    }
    setBusy(false);
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
          <Text style={st.sectionTitle}>Langue</Text>
          <View style={st.chipRow}>
            {Object.entries(LANGUAGES).map(([id, l]) => (
              <Chip key={id} label={l.label} active={langId === id} onPress={() => { setLangId(id); setScenarioId("libre"); }} />
            ))}
          </View>
          {langId === "tunisien" && (
            <View style={st.chipRow}>
              <Chip label="Écriture arabe" active={tnScript === "arabe"} onPress={() => setTnScript("arabe")} />
              <Chip label="Arabizi (latin)" active={tnScript === "arabizi"} onPress={() => setTnScript("arabizi")} />
            </View>
          )}
          <Text style={st.sectionTitle}>Niveau</Text>
          <View style={st.chipRow}>
            {LEVELS.map(([id, label]) => (
              <Chip key={id} label={label} active={level === id} onPress={() => setLevel(id)} />
            ))}
          </View>
          <Text style={st.sectionTitle}>Scénario</Text>
          <View style={st.chipRow}>
            {scenarios.map(([id, label]) => (
              <Chip key={id} label={label} active={scenarioId === id} onPress={() => setScenarioId(id)} />
            ))}
          </View>
          <View style={st.switchRow}>
            <Text style={st.label}>Immersion totale (aucune correction affichée)</Text>
            <Switch value={immersion} onValueChange={setImmersion} trackColor={{ true: "#c2410c" }} />
          </View>
          <Pressable onPress={startSession} style={st.primaryBtn}>
            <Text style={st.primaryBtnText}>🎙️ Commencer la conversation</Text>
          </Pressable>
          {!!status.text && <Text style={[st.status, status.error && st.statusError]}>{status.text}</Text>}
          <Text style={st.hint}>
            Version 2 (aperçu) — l'app complète reste disponible sur la page principale.
          </Text>
        </ScrollView>
        <SettingsModal
          visible={settingsOpen}
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
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
        <Text style={st.headerTitle}>{session.current.cfg?.tutor.name} · {session.current.cfg?.tutor.city}</Text>
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
      {!!status.text && <Text style={[st.status, status.error && st.statusError]}>{status.text}</Text>}
      <View style={st.inputRow}>
        <Pressable onPress={toggleMute} style={[st.roundBtn, micMuted && st.roundBtnMuted]}>
          <Text style={st.roundBtnText}>{micMuted ? "🔇" : "🔈"}</Text>
        </Pressable>
        <TextInput
          style={st.input}
          value={input}
          onChangeText={setInput}
          placeholder={`Écris en ${cfg.label.toLowerCase()} ou en français…`}
          placeholderTextColor="#a8a29e"
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

function SettingsModal({ visible, settings, onClose, onSave }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => { if (visible) setDraft(settings); }, [visible]);
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.modalOverlay}>
        <View style={st.modalCard}>
          <ScrollView contentContainerStyle={{ gap: 10 }}>
            <Text style={st.modalTitle}>⚙️ Réglages</Text>
            <Text style={st.sectionTitle}>Moteur IA</Text>
            <View style={st.chipRow}>
              <Chip label="Claude (Anthropic)" active={draft.provider === "claude"} onPress={() => set("provider", "claude")} />
              <Chip label="Serveur local / Nous" active={draft.provider === "local"} onPress={() => set("provider", "local")} />
            </View>
            {draft.provider === "claude" ? (
              <>
                <Text style={st.label}>Clé API Anthropic</Text>
                <TextInput style={st.field} value={draft.apiKey} onChangeText={v => set("apiKey", v)} secureTextEntry autoCapitalize="none" placeholder="sk-ant-…" placeholderTextColor="#a8a29e" />
              </>
            ) : (
              <>
                <Text style={st.label}>URL du serveur (compatible OpenAI)</Text>
                <TextInput style={st.field} value={draft.localUrl} onChangeText={v => set("localUrl", v)} autoCapitalize="none" placeholder="https://inference-api.nousresearch.com/v1" placeholderTextColor="#a8a29e" />
                <Text style={st.label}>Clé API (si requise)</Text>
                <TextInput style={st.field} value={draft.localKey} onChangeText={v => set("localKey", v)} secureTextEntry autoCapitalize="none" />
                <Text style={st.label}>Modèle principal</Text>
                <TextInput style={st.field} value={draft.localModel} onChangeText={v => set("localModel", v)} autoCapitalize="none" placeholder="anthropic/claude-sonnet-4.6" placeholderTextColor="#a8a29e" />
                <Text style={st.label}>Modèle secondaire (corrections, résumés)</Text>
                <TextInput style={st.field} value={draft.localModelAlt} onChangeText={v => set("localModelAlt", v)} autoCapitalize="none" placeholder="openai/gpt-oss-120b" placeholderTextColor="#a8a29e" />
              </>
            )}
            <View style={st.switchRow}>
              <Text style={st.label}>Lire les réponses à voix haute</Text>
              <Switch value={draft.autospeak} onValueChange={v => set("autospeak", v)} trackColor={{ true: "#c2410c" }} />
            </View>
            <Text style={st.label}>Vitesse de lecture</Text>
            <View style={st.chipRow}>
              {[[0.7, "Lente"], [0.85, "Posée"], [1, "Normale"]].map(([r, label]) => (
                <Chip key={label} label={label} active={draft.rate === r} onPress={() => set("rate", r)} />
              ))}
            </View>
            <View style={[st.chipRow, { justifyContent: "flex-end", marginTop: 8 }]}>
              <Pressable onPress={onClose} style={st.secondaryBtn}><Text style={st.secondaryBtnText}>Annuler</Text></Pressable>
              <Pressable onPress={() => { onSave(draft); onClose(); }} style={st.primaryBtnSmall}>
                <Text style={st.primaryBtnText}>Enregistrer</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#faf7f2", ...(Platform.OS === "web" ? { maxWidth: 780, width: "100%", marginHorizontal: "auto" } : null) },
  header: {
    backgroundColor: "#c2410c",
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
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#78716c", textTransform: "uppercase", marginTop: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: "#e7e5e4", backgroundColor: "#fff", borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  chipActive: { backgroundColor: "#c2410c", borderColor: "#c2410c" },
  chipText: { color: "#44403c", fontSize: 14 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, gap: 10 },
  label: { color: "#44403c", fontSize: 14, flexShrink: 1 },
  primaryBtn: { backgroundColor: "#c2410c", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  primaryBtnSmall: { backgroundColor: "#c2410c", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  secondaryBtnText: { color: "#78716c", fontSize: 16 },
  hint: { color: "#a8a29e", fontSize: 12, marginTop: 16, textAlign: "center" },
  chat: { flex: 1 },
  bubble: { borderRadius: 14, padding: 12, maxWidth: "88%" },
  bubbleUser: { backgroundColor: "#c2410c", alignSelf: "flex-end" },
  bubbleUserText: { color: "#fff", fontSize: 16 },
  bubbleTutor: { backgroundColor: "#fff", alignSelf: "flex-start", borderWidth: 1, borderColor: "#e7e5e4", gap: 4 },
  targetText: { fontSize: 17, color: "#1c1917", fontWeight: "500" },
  reading: { fontSize: 14, color: "#78716c", fontStyle: "italic" },
  translation: { fontSize: 13, color: "#a8a29e" },
  correction: { backgroundColor: "#fff7ed", borderRadius: 8, padding: 8, marginTop: 6, gap: 2 },
  correctionTitle: { fontSize: 12, fontWeight: "700", color: "#c2410c" },
  correctionLine: { fontSize: 14, color: "#b91c1c" },
  correctionLineOk: { fontSize: 14, color: "#15803d", fontWeight: "600" },
  correctionExpl: { fontSize: 13, color: "#57534e" },
  culture: { backgroundColor: "#eff6ff", borderRadius: 8, padding: 8, marginTop: 6 },
  cultureText: { fontSize: 13, color: "#1e40af" },
  bubbleSummary: { backgroundColor: "#fffbeb", alignSelf: "stretch", maxWidth: "100%", borderWidth: 1, borderColor: "#fde68a" },
  summaryTitle: { fontWeight: "700", color: "#92400e", marginBottom: 6 },
  summaryText: { color: "#44403c", fontSize: 14, lineHeight: 21 },
  suggestions: { maxHeight: 44, marginBottom: 4 },
  status: { paddingHorizontal: 14, paddingVertical: 4, color: "#78716c", fontSize: 13 },
  statusError: { color: "#b91c1c" },
  inputRow: { flexDirection: "row", gap: 8, padding: 10, alignItems: "center", backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e7e5e4" },
  input: { flex: 1, borderWidth: 1, borderColor: "#e7e5e4", borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, fontSize: 15, color: "#1c1917", backgroundColor: "#faf7f2" },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#f5f5f4", alignItems: "center", justifyContent: "center" },
  roundBtnMuted: { backgroundColor: "#fecaca" },
  micBtn: { backgroundColor: "#c2410c" },
  micBtnActive: { backgroundColor: "#16a34a" },
  roundBtnText: { fontSize: 18 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#faf7f2", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: "88%" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1c1917" },
});
