// Exercices : dictée (écoute → écrit) et prononciation (lit → répète) — portage v1 #21/#22.

import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { callModel, hasCredentials } from "../core/api";
import { gradeAttempt } from "../core/diff";
import { exoSystemPrompt } from "../core/prompts";
import { EXO_SCHEMA } from "../core/schemas";
import * as speech from "../speech/speech";
import { C, Chip, ui } from "./common";

export default function ExercisesScreen({ settings, cfg, langId, level, onOpenSettings }) {
  const [kind, setKind] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState([]);
  const [feedback, setFeedback] = useState(null); // { grade, attemptText }
  const [input, setInput] = useState("");
  const [status, setStatus] = useState({ text: "", error: false });
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recognizer = useRef(null);

  const sentence = sentences[index];
  const finished = sentences.length > 0 && index >= sentences.length;

  const start = async (k) => {
    if (!hasCredentials(settings)) {
      onOpenSettings();
      setStatus({ text: "Configure d'abord ton moteur IA dans les réglages.", error: true });
      return;
    }
    if (k === "prononciation" && !speech.recognitionAvailable()) {
      setStatus({ text: "Reconnaissance vocale indisponible ici — utilise la dictée à la place.", error: true });
      return;
    }
    speech.primeSpeech();
    setBusy(true);
    setStatus({ text: "Préparation des phrases…", error: false });
    try {
      const raw = await callModel(settings, {
        messages: [{ role: "user", content: "Génère les 5 phrases de l'exercice." }],
        system: exoSystemPrompt({ cfg, level }),
        schema: EXO_SCHEMA,
      });
      const list = JSON.parse(raw).sentences.slice(0, 5);
      if (!list.length) throw new Error("Aucune phrase générée.");
      recognizer.current = null;
      setKind(k);
      setSentences(list);
      setIndex(0);
      setScores([]);
      setFeedback(null);
      setInput("");
      setStatus({ text: "", error: false });
      if (k === "dictee") speech.speak(list[0].text, { ttsPrefixes: cfg.ttsPrefixes, stt: cfg.stt, support: cfg.support, rate: settings.rate });
    } catch (err) {
      setStatus({ text: err.message, error: true });
    }
    setBusy(false);
  };

  const grade = (attemptText) => {
    const s = sentences[index];
    if (!s) return;
    const g = gradeAttempt(s.text, attemptText, langId);
    setScores(sc => { const n = [...sc]; n[index] = g.score; return n; });
    setFeedback({ grade: g, attemptText });
  };

  const startMic = () => {
    if (busy || listening) return;
    if (!recognizer.current) {
      recognizer.current = speech.createRecognizer({
        lang: cfg.stt,
        support: cfg.support,
        onStart: () => setListening(true),
        onInterim: (t) => setStatus({ text: `🎤 « ${t} »`, error: false }),
        onResult: (t) => { setStatus({ text: "", error: false }); grade(t); },
        onError: (msg) => setStatus({ text: msg, error: true }),
        onEnd: () => setListening(false),
      });
    }
    if (!recognizer.current) return;
    setStatus({ text: "🎤 Je t'écoute…", error: false });
    recognizer.current.start();
  };

  const next = () => {
    setFeedback(null);
    setInput("");
    const i = index + 1;
    setIndex(i);
    if (kind === "dictee" && sentences[i]) {
      speech.speak(sentences[i].text, { ttsPrefixes: cfg.ttsPrefixes, stt: cfg.stt, support: cfg.support, rate: settings.rate });
    }
  };

  const reset = () => {
    speech.stopSpeaking();
    if (recognizer.current && listening) recognizer.current.stop();
    setKind(null);
    setSentences([]);
    setFeedback(null);
    setStatus({ text: "", error: false });
  };

  if (!kind) {
    return (
      <ScrollView contentContainerStyle={st.body}>
        <Text style={ui.sectionTitle}>Choisis un exercice ({cfg.label})</Text>
        <Pressable onPress={() => start("dictee")} disabled={busy} style={ui.primaryBtn}>
          <Text style={ui.primaryBtnText}>🎧 Dictée — écoute puis écris</Text>
        </Pressable>
        <Pressable onPress={() => start("prononciation")} disabled={busy} style={ui.secondaryBtn}>
          <Text style={ui.secondaryBtnText}>🗣️ Prononciation — lis à voix haute</Text>
        </Pressable>
        {!!status.text && <Text style={[ui.status, status.error && ui.statusError]}>{status.text}</Text>}
        <Text style={{ color: C.faint, fontSize: 12, marginTop: 8 }}>
          5 phrases adaptées à ton niveau, notées mot à mot. La prononciation nécessite la
          reconnaissance vocale (navigateur web).
        </Text>
      </ScrollView>
    );
  }

  if (finished) {
    const done = scores.filter(s => s !== undefined);
    const avg = done.length ? Math.round(done.reduce((a, b) => a + b, 0) / done.length) : 0;
    return (
      <ScrollView contentContainerStyle={st.body}>
        <View style={ui.card}>
          <Text style={st.sentence}>Série terminée ! 🎉</Text>
          <Text style={st.scoreLine}>Score moyen : {avg} %</Text>
        </View>
        <Pressable onPress={reset} style={ui.primaryBtn}><Text style={ui.primaryBtnText}>↺ Autre exercice</Text></Pressable>
      </ScrollView>
    );
  }

  const g = feedback?.grade;
  return (
    <ScrollView contentContainerStyle={st.body}>
      <Text style={ui.sectionTitle}>
        {kind === "dictee" ? "Dictée" : "Prononciation"} — phrase {index + 1} / {sentences.length}
      </Text>
      <View style={ui.card}>
        {kind === "dictee" && !feedback ? (
          <Text style={st.sentence}>🎧 Écoute, puis écris la phrase.</Text>
        ) : (
          <Text style={[st.sentence, cfg.rtl && st.rtl]}>{sentence.text}</Text>
        )}
        {!!sentence.reading && (kind !== "dictee" || feedback) && (
          <Text style={st.reading}>{sentence.reading}</Text>
        )}
        <View style={ui.chipRow}>
          <Chip label="🔊 (Ré)écouter" onPress={() => speech.speak(sentence.text, { ttsPrefixes: cfg.ttsPrefixes, stt: cfg.stt, support: cfg.support, rate: settings.rate })} />
          {kind === "prononciation" && (
            <Chip label={listening ? "🎤 J'écoute…" : "🎤 Je répète"} active={listening} onPress={listening ? () => recognizer.current && recognizer.current.stop() : startMic} />
          )}
        </View>
      </View>
      {kind === "dictee" && !feedback && (
        <View style={{ gap: 8 }}>
          <TextInput
            style={ui.field}
            value={input}
            onChangeText={setInput}
            placeholder={`Écris ce que tu entends en ${cfg.label.toLowerCase()}…`}
            placeholderTextColor={C.faint}
            autoCapitalize="none"
            onSubmitEditing={() => input.trim() && grade(input)}
          />
          <Pressable onPress={() => input.trim() && grade(input)} style={ui.primaryBtn}>
            <Text style={ui.primaryBtnText}>Vérifier</Text>
          </Pressable>
        </View>
      )}
      {!!status.text && <Text style={[ui.status, status.error && ui.statusError]}>{status.text}</Text>}
      {feedback && (
        <View style={ui.card}>
          <Text style={ui.label}>
            Attendu :{" "}
            <Text style={cfg.rtl && st.rtl}>
              {g.tokens.map((tok, i) => (
                <Text key={i} style={g.matched.has(i) ? st.ok : st.miss}>
                  {tok}{!g.isCharBased && i < g.tokens.length - 1 ? " " : ""}
                </Text>
              ))}
            </Text>
          </Text>
          <Text style={ui.label}>Ta version : {feedback.attemptText}</Text>
          <Text style={st.scoreLine}>
            {g.score} % {g.score >= 90 ? "🎉" : g.score >= 60 ? "👍" : "💪 On réessaie ?"}
          </Text>
          <View style={ui.chipRow}>
            <Chip label="↺ Réessayer" onPress={() => { setFeedback(null); setInput(""); if (kind === "dictee") speech.speak(sentence.text, { ttsPrefixes: cfg.ttsPrefixes, stt: cfg.stt, support: cfg.support, rate: settings.rate }); }} />
            <Chip label="Phrase suivante →" active onPress={next} />
          </View>
        </View>
      )}
      <Pressable onPress={reset}><Text style={[ui.status, { textAlign: "center" }]}>✕ Arrêter l'exercice</Text></Pressable>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  body: { padding: 16, gap: 10 },
  sentence: { fontSize: 18, color: C.text, fontWeight: "500" },
  reading: { fontSize: 14, color: C.muted, fontStyle: "italic" },
  rtl: { writingDirection: "rtl", textAlign: "right" },
  ok: { color: C.ok, fontWeight: "600" },
  miss: { color: C.error, textDecorationLine: "underline" },
  scoreLine: { fontSize: 17, fontWeight: "700", color: C.primary },
});
