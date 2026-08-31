// Progrès : statistiques, carnet de vocabulaire et révision espacée (portage v1 #23/#24).

import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { LANGUAGES } from "../core/languages";
import { RATINGS, reviewCard } from "../core/fsrs";
import { computeStreak, dueCards } from "../core/leitner";
import { saveTextFile } from "../export/export";
import * as speech from "../speech/speech";
import { loadJSON, saveJSON } from "../storage";
import { C, Chip, ui } from "./common";

// Format d'import Anki : une carte par ligne, champs séparés par des tabulations.
function deckToAnki(deck) {
  const lines = ["#separator:tab", "#html:false"];
  for (const c of deck) {
    lines.push([c.term, c.reading || "", c.translation, LANGUAGES[c.lang]?.label || c.lang]
      .map(v => String(v).replace(/\t/g, " ")).join("\t"));
  }
  return lines.join("\n");
}

export default function ProgressScreen({ settings, keys }) {
  const [deck, setDeck] = useState([]);
  const [history, setHistory] = useState([]);
  const [review, setReview] = useState(null); // { queue, index, revealed }
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadJSON(keys.deck, []).then(setDeck);
    loadJSON(keys.history, []).then(setHistory);
  }, [keys]);

  const exportDeck = async () => {
    if (!deck.length) return;
    try {
      setStatus(await saveTextFile("polyglotte-vocabulaire.txt", deckToAnki(deck)));
    } catch (err) {
      setStatus("❌ " + err.message);
    }
  };

  const due = dueCards(deck);

  const speakCard = (card) => {
    const cfg = LANGUAGES[card.lang];
    if (cfg) speech.speak(card.term, { ttsPrefixes: cfg.ttsPrefixes, rate: settings.rate });
  };

  const startReview = () => {
    if (!due.length) return;
    speech.primeSpeech();
    // Cartes inversées (réglage) : une carte sur deux présentée français → langue cible.
    const queue = due.map((card, i) => ({ card, inverse: !!settings.reversedCards && i % 2 === 1 }));
    setReview({ queue, index: 0, revealed: false });
    if (!queue[0].inverse) speakCard(queue[0].card);
  };

  const grade = (rating) => {
    const { card } = review.queue[review.index];
    const updated = reviewCard(card, rating);
    const nextDeck = deck.map(c => (c.id === card.id ? updated : c));
    setDeck(nextDeck);
    saveJSON(keys.deck, nextDeck);
    const i = review.index + 1;
    if (i >= review.queue.length) {
      setReview(null);
    } else {
      setReview({ queue: review.queue, index: i, revealed: false });
      if (!review.queue[i].inverse) speakCard(review.queue[i].card);
    }
  };

  const removeCard = (id) => {
    const nextDeck = deck.filter(c => c.id !== id);
    setDeck(nextDeck);
    saveJSON(keys.deck, nextDeck);
  };

  if (review) {
    const { card, inverse } = review.queue[review.index];
    const reveal = () => {
      setReview(r => ({ ...r, revealed: true }));
      if (inverse) speakCard(card); // en sens inverse, la réponse est dans la langue cible
    };
    return (
      <ScrollView contentContainerStyle={st.body}>
        <Text style={ui.sectionTitle}>
          Carte {review.index + 1} / {review.queue.length} — {LANGUAGES[card.lang]?.label || card.lang}
          {inverse ? " (inversée)" : ""}
        </Text>
        <View style={[ui.card, { alignItems: "center", paddingVertical: 28 }]}>
          <Pressable onPress={() => { if (!inverse || review.revealed) speakCard(card); }}>
            <Text style={st.term}>{inverse ? card.translation : card.term}</Text>
          </Pressable>
          {!inverse && !!card.reading && <Text style={st.reading}>{card.reading}</Text>}
          {review.revealed && (
            <Text style={st.answer}>
              {inverse ? `${card.term}${card.reading ? `  (${card.reading})` : ""}` : card.translation}
            </Text>
          )}
        </View>
        {!review.revealed ? (
          <Pressable onPress={reveal} style={ui.primaryBtn}>
            <Text style={ui.primaryBtnText}>Voir la réponse</Text>
          </Pressable>
        ) : (
          <View style={[ui.chipRow, { justifyContent: "center" }]}>
            <Pressable onPress={() => grade(RATINGS.again)} style={[ui.primaryBtn, st.grow, { backgroundColor: C.error }]}>
              <Text style={ui.primaryBtnText}>❌ À revoir</Text>
            </Pressable>
            <Pressable onPress={() => grade(RATINGS.hard)} style={[ui.primaryBtn, st.grow, { backgroundColor: "#b45309" }]}>
              <Text style={ui.primaryBtnText}>😅 Difficile</Text>
            </Pressable>
            <Pressable onPress={() => grade(RATINGS.good)} style={[ui.primaryBtn, st.grow, { backgroundColor: C.ok }]}>
              <Text style={ui.primaryBtnText}>✅ Bien</Text>
            </Pressable>
            <Pressable onPress={() => grade(RATINGS.easy)} style={[ui.primaryBtn, st.grow, { backgroundColor: C.primary }]}>
              <Text style={ui.primaryBtnText}>🚀 Facile</Text>
            </Pressable>
          </View>
        )}
        <Pressable onPress={() => setReview(null)}>
          <Text style={[ui.status, { textAlign: "center" }]}>✕ Arrêter la révision</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const byLang = {};
  for (const s of history) byLang[s.lang] = (byLang[s.lang] || 0) + 1;
  const langParts = Object.entries(byLang)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, n]) => `${LANGUAGES[lang]?.label || lang} : ${n} session${n > 1 ? "s" : ""}`);

  const stats = [
    [history.length, "sessions"],
    [computeStreak(history), "jours d'affilée"],
    [deck.length, "mots au carnet"],
    [due.length, "à réviser"],
  ];
  const recent = [...deck].sort((a, b) => b.addedAt - a.addedAt).slice(0, 50);

  return (
    <ScrollView contentContainerStyle={st.body}>
      <View style={st.statsGrid}>
        {stats.map(([value, label]) => (
          <View key={label} style={[ui.card, st.statCard]}>
            <Text style={st.statValue}>{value}</Text>
            <Text style={st.statLabel}>{label}</Text>
          </View>
        ))}
      </View>
      {langParts.length > 0 && <Text style={ui.status}>Pratique — {langParts.join(" · ")}</Text>}
      <Pressable onPress={startReview} disabled={!due.length} style={[ui.primaryBtn, !due.length && { opacity: 0.5 }]}>
        <Text style={ui.primaryBtnText}>🔁 Réviser ({due.length})</Text>
      </Pressable>
      <Pressable onPress={exportDeck} disabled={!deck.length} style={[ui.secondaryBtn, !deck.length && { opacity: 0.5 }]}>
        <Text style={ui.secondaryBtnText}>📤 Exporter le carnet (Anki)</Text>
      </Pressable>
      {!!status && <Text style={ui.status}>{status}</Text>}
      <Text style={ui.sectionTitle}>Carnet de vocabulaire</Text>
      {!deck.length && <Text style={ui.status}>Encore aucun mot — lance une conversation !</Text>}
      {recent.map(card => (
        <View key={card.id} style={st.deckRow}>
          <Text style={st.deckLang}>{LANGUAGES[card.lang]?.label || card.lang}</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.deckTerm}>{card.term}{card.reading ? `  (${card.reading})` : ""}</Text>
            <Text style={st.deckTranslation}>
              {card.translation}{card.stability ? ` · stabilité ${Math.round(card.stability)} j` : ""}
            </Text>
          </View>
          <Chip label="🔊" onPress={() => speakCard(card)} />
          <Pressable onPress={() => removeCard(card.id)} style={{ padding: 6 }}>
            <Text style={{ color: C.faint }}>✕</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  body: { padding: 16, gap: 10 },
  grow: { flexGrow: 1, paddingHorizontal: 16 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: { flexGrow: 1, flexBasis: "40%", alignItems: "center", paddingVertical: 14 },
  statValue: { fontSize: 26, fontWeight: "800", color: C.primary },
  statLabel: { fontSize: 12, color: C.muted },
  term: { fontSize: 26, fontWeight: "700", color: C.text, textAlign: "center" },
  reading: { fontSize: 15, color: C.muted, fontStyle: "italic", marginTop: 4 },
  answer: { fontSize: 18, color: C.ok, fontWeight: "600", marginTop: 12 },
  deckRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10 },
  deckLang: { fontSize: 11, color: C.muted, width: 62 },
  deckTerm: { fontSize: 15, color: C.text, fontWeight: "600" },
  deckTranslation: { fontSize: 13, color: C.muted },
});
