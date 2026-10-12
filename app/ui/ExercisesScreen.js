// Exercices : dictée (écoute → écrit) et prononciation (lit → répète) — portage v1 #21/#22 —,
// histoire à écouter avec questions de compréhension (#113) et texte à trous ciblé sur un
// point de grammaire (#115).

import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { callModel, hasCredentials } from "../core/api";
import { gradeAttempt } from "../core/diff";
import { demandeHistoire, histoireValide, schemaHistoire, scoreHistoire } from "../core/histoire";
import { exoSystemPrompt } from "../core/prompts";
import { TROU, corrigeTrou, demandeTrous, phraseComplete, schemaTrous, scoreTrous, trousValides } from "../core/trous";
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
  // Histoire à écouter (#113) : texte masqué tant que l'élève ne le demande pas.
  const [histoire, setHistoire] = useState(null);
  const [reponses, setReponses] = useState([]);
  const [texteVisible, setTexteVisible] = useState(false);
  // Texte à trous (#115) : point de grammaire facultatif, résultats par phrase.
  const [point, setPoint] = useState("");
  const [trous, setTrous] = useState(null);
  const [resultats, setResultats] = useState([]);
  const dire = (texte) => speech.speak(texte, { ttsPrefixes: cfg.ttsPrefixes, stt: cfg.stt, support: cfg.support, voixServeur: cfg.voixServeur, langue: cfg.label, rate: settings.rate });

  const startHistoire = async () => {
    speech.primeSpeech();
    setBusy(true);
    setStatus({ text: `${cfg.tutor.name} prépare une histoire…`, error: false });
    try {
      const raw = await callModel(settings, {
        messages: [{ role: "user", content: demandeHistoire({ cfg, level }) }],
        system: exoSystemPrompt({ cfg, level }),
        schema: schemaHistoire({ lecture: !!cfg.reading }),
        maxTokens: 2000,
      });
      let h = null;
      try { h = histoireValide(JSON.parse(raw)); } catch (_) { h = null; }
      if (!h) throw new Error("Le tuteur n'a pas su écrire l'histoire — réessaie.");
      setHistoire(h);
      setReponses([]);
      setTexteVisible(false);
      setKind("histoire");
      setStatus({ text: "", error: false });
      dire(h.texte);
    } catch (err) {
      setStatus({ text: err.message, error: true });
    }
    setBusy(false);
  };

  const startTrous = async () => {
    speech.primeSpeech();
    setBusy(true);
    setStatus({ text: "Préparation du texte à trous…", error: false });
    try {
      const raw = await callModel(settings, {
        messages: [{ role: "user", content: demandeTrous({ cfg, point }) }],
        system: exoSystemPrompt({ cfg, level }),
        schema: schemaTrous({ lecture: !!cfg.reading }),
        maxTokens: 1500,
      });
      let t = null;
      try { t = trousValides(JSON.parse(raw), { charBased: langId === "japonais", ecriture: cfg.ecriture }); } catch (_) { t = null; }
      if (!t) throw new Error("Le tuteur n'a pas su préparer de phrases à trous — réessaie.");
      setTrous(t);
      setResultats([]);
      setIndex(0);
      setInput("");
      setKind("trous");
      setStatus({ text: "", error: false });
    } catch (err) {
      setStatus({ text: err.message, error: true });
    }
    setBusy(false);
  };

  const verifieTrou = () => {
    const p = trous?.[index];
    if (!p || !input.trim() || resultats[index]) return;
    const r = corrigeTrou(p.reponse, input, { charBased: langId === "japonais" });
    setResultats(rs => { const n = [...rs]; n[index] = r; return n; });
    dire(phraseComplete(p));
  };

  const sentence = sentences[index];
  const finished = sentences.length > 0 && index >= sentences.length;

  const start = async (k) => {
    if (!hasCredentials(settings)) {
      onOpenSettings();
      setStatus({ text: "Configure d'abord ton moteur IA dans les réglages.", error: true });
      return;
    }
    if (k === "histoire") return startHistoire();
    if (k === "trous") return startTrous();
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
    setHistoire(null);
    setTrous(null);
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
        <Pressable onPress={() => start("histoire")} disabled={busy} style={ui.secondaryBtn}>
          <Text style={ui.secondaryBtnText}>📖 Histoire à écouter — puis 3 questions</Text>
        </Pressable>
        <Text style={ui.sectionTitle}>Texte à trous</Text>
        <TextInput
          style={ui.field}
          value={point}
          onChangeText={setPoint}
          placeholder="Point à travailler (facultatif) : ex. le passé, les pronoms…"
          placeholderTextColor={C.faint}
        />
        <Pressable onPress={() => start("trous")} disabled={busy} style={ui.secondaryBtn}>
          <Text style={ui.secondaryBtnText}>🧩 Texte à trous — complète la forme</Text>
        </Pressable>
        {!!status.text && <Text style={[ui.status, status.error && ui.statusError]}>{status.text}</Text>}
        <Text style={{ color: C.faint, fontSize: 12, marginTop: 8 }}>
          Dictée et prononciation : 5 phrases adaptées à ton niveau, notées mot à mot (la
          prononciation demande la reconnaissance vocale). Histoire : écoute d'abord, le texte
          ne s'affiche que si tu le demandes.
        </Text>
      </ScrollView>
    );
  }

  if (kind === "histoire" && histoire) {
    const repondues = reponses.filter(r => r !== undefined).length;
    const fini = repondues >= histoire.questions.length;
    const sc = scoreHistoire(histoire, reponses);
    return (
      <ScrollView contentContainerStyle={st.body}>
        <Text style={ui.sectionTitle}>📖 {histoire.titre}</Text>
        <View style={ui.card}>
          <View style={ui.chipRow}>
            <Chip label="🔊 (Ré)écouter" onPress={() => dire(histoire.texte)} />
            <Chip label={texteVisible ? "🙈 Masquer le texte" : "👁 Afficher le texte"} active={texteVisible} onPress={() => setTexteVisible(v => !v)} />
          </View>
          {texteVisible || fini ? (
            <>
              <Text style={[st.histoire, cfg.rtl && st.rtl]}>{histoire.texte}</Text>
              {!!histoire.reading && <Text style={st.reading}>{histoire.reading}</Text>}
            </>
          ) : (
            <Text style={st.reading}>Écoute l'histoire, puis réponds. Le texte reste caché : c'est ton oreille qui travaille.</Text>
          )}
          {fini && !!histoire.traduction && <Text style={st.traduction}>🇫🇷 {histoire.traduction}</Text>}
        </View>
        {histoire.questions.map((q, i) => {
          const choisi = reponses[i];
          const repondu = choisi !== undefined;
          return (
            <View key={i} style={ui.card}>
              <Text style={st.question}>{i + 1}. {q.question}</Text>
              {q.choix.map((c, k) => {
                const marque = repondu && (k === q.bonne ? "✓ " : k === choisi ? "✗ " : "");
                return (
                  <Pressable
                    key={k}
                    disabled={repondu}
                    onPress={() => setReponses(r => { const n = [...r]; n[i] = k; return n; })}
                    style={[st.choix, repondu && k === q.bonne && st.choixOk, repondu && k === choisi && k !== q.bonne && st.choixKo]}
                  >
                    <Text style={st.choixTexte}>{marque}{c}</Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
        {fini && (
          <View style={ui.card}>
            <Text style={st.scoreLine}>
              {sc.justes} / {sc.total} bonnes réponses {sc.pourcent === 100 ? "🎉" : sc.pourcent >= 60 ? "👍" : "💪 Réécoute et relis le texte"}
            </Text>
          </View>
        )}
        <Pressable onPress={reset} style={fini ? ui.primaryBtn : null}>
          <Text style={fini ? ui.primaryBtnText : [ui.status, { textAlign: "center" }]}>{fini ? "↺ Autre exercice" : "✕ Arrêter l'exercice"}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (kind === "trous" && trous) {
    const p = trous[index];
    if (!p) {
      const sc = scoreTrous(resultats);
      return (
        <ScrollView contentContainerStyle={st.body}>
          <View style={ui.card}>
            <Text style={st.sentence}>Texte à trous terminé ! 🎉</Text>
            <Text style={st.scoreLine}>{sc.justes} / {sc.total} formes justes</Text>
            {trous.map((t, i) => (
              <Text key={i} style={[st.reading, cfg.rtl && st.rtl]}>
                {resultats[i] === "faux" ? "✗" : "✓"} {phraseComplete(t)}
              </Text>
            ))}
          </View>
          <Pressable onPress={reset} style={ui.primaryBtn}><Text style={ui.primaryBtnText}>↺ Autre exercice</Text></Pressable>
        </ScrollView>
      );
    }
    const r = resultats[index];
    const [avant, apres] = p.phrase.split(TROU);
    return (
      <ScrollView contentContainerStyle={st.body}>
        <Text style={ui.sectionTitle}>Texte à trous — phrase {index + 1} / {trous.length}</Text>
        <View style={ui.card}>
          <Text style={[st.sentence, cfg.rtl && st.rtl]}>
            {avant}<Text style={r ? (r === "faux" ? st.miss : st.ok) : st.trou}>{r ? p.reponse : " ____ "}</Text>{apres}
          </Text>
          {!!p.indice && <Text style={st.reading}>💡 {p.indice}</Text>}
          {r && !!p.reading && <Text style={st.reading}>{p.reading}</Text>}
          {r && !!p.traduction && <Text style={st.reading}>🇫🇷 {p.traduction}</Text>}
        </View>
        {!r ? (
          <View style={{ gap: 8 }}>
            <TextInput
              style={ui.field}
              value={input}
              onChangeText={setInput}
              placeholder="La forme qui manque…"
              placeholderTextColor={C.faint}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={verifieTrou}
            />
            <Pressable onPress={verifieTrou} style={ui.primaryBtn}><Text style={ui.primaryBtnText}>Vérifier</Text></Pressable>
          </View>
        ) : (
          <View style={ui.card}>
            <Text style={st.scoreLine}>
              {r === "juste" ? "✓ Juste !" : r === "accent" ? "✓ Juste — attention aux accents et signes diacritiques" : `✗ La forme attendue : ${p.reponse}`}
            </Text>
            {r !== "juste" && <Text style={ui.label}>Ta réponse : {input}</Text>}
            <View style={ui.chipRow}>
              <Chip label="🔊 Réécouter" onPress={() => dire(phraseComplete(p))} />
              <Chip label="Phrase suivante →" active onPress={() => { setIndex(i => i + 1); setInput(""); }} />
            </View>
          </View>
        )}
        <Pressable onPress={reset}><Text style={[ui.status, { textAlign: "center" }]}>✕ Arrêter l'exercice</Text></Pressable>
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
  histoire: { fontSize: 17, color: C.text, lineHeight: 25 },
  traduction: { fontSize: 14, color: C.muted, lineHeight: 21 },
  question: { fontSize: 15, fontWeight: "600", color: C.text },
  choix: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 },
  choixOk: { borderColor: C.ok, backgroundColor: "#f0fdf4" },
  choixKo: { borderColor: C.error, backgroundColor: "#fef2f2" },
  choixTexte: { fontSize: 15, color: "#44403c" },
  trou: { color: C.primary, fontWeight: "700", textDecorationLine: "underline" },
});
