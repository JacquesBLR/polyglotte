// Progrès : statistiques, carnet de vocabulaire et révision espacée (portage v1 #23/#24).

import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { LANGUAGES } from "../core/languages";
import { computeStreak, dueCards, gradeCard } from "../core/leitner";
import * as speech from "../speech/speech";
import { KEYS, loadJSON, saveJSON } from "../storage";
import { C, Chip, ui } from "./common";

export default function ProgressScreen({ settings }) {
  const [deck, setDeck] = useState([]);
  const [history, setHistory] = useState([]);
  const [review, setReview] = useState(null); // { queue, index, revealed }

  useEffect(() => {
    loadJSON(KEYS.deck, []).then(setDeck);
    loadJSON(KEYS.history, []).then(setHistory);
  }, []);

  const due = dueCards(deck);

  const speakCard = (card) => {
    const cfg = LANGUAGES[card.lang];
    if (cfg) speech.speak(card.term, { ttsPrefixes: cfg.ttsPrefixes, rate: settings.rate });
  };

  const startReview = () => {
    if (!due.length) return;
    speech.primeSpeech();
    const queue = [...due];
    setReview({ queue, index: 0, revealed: false });
    speakCard(queue[0]);
  };

  const grade = (knew) => {
    const card = review.queue[review.index];
    const updated = gradeCard(card, knew);
    const nextDeck = deck.map(c => (c.id === card.id ? updated : c));
    setDeck(nextDeck);
    saveJSON(KEYS.deck, nextDeck);
    const i = review.index + 1;
    if (i >= review.queue.length) {
      setReview(null);
    } else {
      setReview({ queue: review.queue, index: i, revealed: false });
      speakCard(review.queue[i]);
    }
  };

  const removeCard = (id) => {
    const nextDeck = deck.filter(c => c.id !== id);
    setDeck(nextDeck);
    saveJSON(KEYS.deck, nextDeck);
  };

  if (review) {
    const card = review.queue[review.index];
    return (
      <ScrollView contentContainerStyle={st.body}>
        <Text style={ui.sectionTitle}>
          Carte {review.index + 1} / {review.queue.length} — {LANGUAGES[card.lang]?.label || card.lang}
        </Text>
        <View style={[ui.card, { alignItems: "center", paddingVertical: 28 }]}>
          <Pressable onPress={() => speakCard(card)}>
            <Text style={st.term}>{card.term}</Text>
          </Pressable>
          {!!card.reading && <Text style={st.reading}>{card.reading}</Text>}
          {review.revealed && <Text style={st.answer}>{card.translation}</Text>}
        </View>
        {!review.revealed ? (
          <Pressable onPress={() => setReview(r => ({ ...r, revealed: true }))} style={ui.primaryBtn}>
            <Text style={ui.primaryBtnText}>Voir la réponse</Text>
          </Pressable>
        ) : (
          <View style={[ui.chipRow, { justifyContent: "center" }]}>
            <Pressable onPress={() => grade(true)} style={[ui.primaryBtn, st.grow, { backgroundColor: C.ok }]}>
              <Text style={ui.primaryBtnText}>✅ Je savais</Text>
            </Pressable>
            <Pressable onPress={() => grade(false)} style={[ui.primaryBtn, st.grow, { backgroundColor: C.error }]}>
              <Text style={ui.primaryBtnText}>❌ À revoir</Text>
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
      <Text style={ui.sectionTitle}>Carnet de vocabulaire</Text>
      {!deck.length && <Text style={ui.status}>Encore aucun mot — lance une conversation !</Text>}
      {recent.map(card => (
        <View key={card.id} style={st.deckRow}>
          <Text style={st.deckLang}>{LANGUAGES[card.lang]?.label || card.lang}</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.deckTerm}>{card.term}{card.reading ? `  (${card.reading})` : ""}</Text>
            <Text style={st.deckTranslation}>{card.translation} · boîte {card.box}</Text>
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
