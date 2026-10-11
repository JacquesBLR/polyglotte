// Progrès : objectif de la semaine (#89), statistiques, carnet de vocabulaire et révision
// espacée (portage v1 #23/#24), carnet d'erreurs et sa révision (#87).

import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { erreursDues } from "../core/erreurs";
import { LANGUAGES } from "../core/languages";
import { RATINGS, reviewCard } from "../core/fsrs";
import { computeStreak, dueCards } from "../core/leitner";
import { nbMissionsAccomplies } from "../core/mission";
import { JOURS_COURTS, bilanHebdo, messageHebdo, semainesTenues } from "../core/objectif";
import { tendanceNiveau } from "../core/resume";
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
  const [erreurs, setErreurs] = useState([]);
  const [revueErreurs, setRevueErreurs] = useState(null); // { queue, index, revealed }
  const [seanceOuverte, setSeanceOuverte] = useState(null); // id de la séance dont le bilan est déplié (#93)
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadJSON(keys.deck, []).then(setDeck);
    loadJSON(keys.history, []).then(setHistory);
    loadJSON(keys.erreurs, []).then(setErreurs);
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
    if (cfg) speech.speak(card.term, { ttsPrefixes: cfg.ttsPrefixes, stt: cfg.stt, support: cfg.support, rate: settings.rate });
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

  // ---------- Carnet d'erreurs (#87) ----------

  const duesErreurs = erreursDues(erreurs);

  const speakErreur = (e) => {
    const cfg = LANGUAGES[e.lang];
    if (cfg) speech.speak(e.corrected, { ttsPrefixes: cfg.ttsPrefixes, stt: cfg.stt, support: cfg.support, voixServeur: cfg.voixServeur, langue: cfg.label, rate: settings.rate });
  };

  const startRevueErreurs = () => {
    if (!duesErreurs.length) return;
    speech.primeSpeech();
    setRevueErreurs({ queue: duesErreurs, index: 0, revealed: false });
  };

  const gradeErreur = (rating) => {
    const e = revueErreurs.queue[revueErreurs.index];
    const updated = reviewCard(e, rating);
    const next = erreurs.map(x => (x.id === e.id ? updated : x));
    setErreurs(next);
    saveJSON(keys.erreurs, next);
    const i = revueErreurs.index + 1;
    if (i >= revueErreurs.queue.length) setRevueErreurs(null);
    else setRevueErreurs({ queue: revueErreurs.queue, index: i, revealed: false });
  };

  const removeErreur = (id) => {
    const next = erreurs.filter(e => e.id !== id);
    setErreurs(next);
    saveJSON(keys.erreurs, next);
  };

  if (revueErreurs) {
    const e = revueErreurs.queue[revueErreurs.index];
    const reveal = () => {
      setRevueErreurs(r => ({ ...r, revealed: true }));
      speakErreur(e); // la forme correcte, entendue au moment où elle est révélée
    };
    return (
      <ScrollView contentContainerStyle={st.body}>
        <Text style={ui.sectionTitle}>
          Erreur {revueErreurs.index + 1} / {revueErreurs.queue.length} — {LANGUAGES[e.lang]?.label || e.lang}
        </Text>
        <View style={[ui.card, { alignItems: "center", paddingVertical: 24, gap: 8 }]}>
          <Text style={st.erreurOriginal}>✗ {e.original}</Text>
          {!revueErreurs.revealed && <Text style={st.reading}>Comment le dire correctement ? Formule-le, à voix haute ou dans ta tête.</Text>}
          {revueErreurs.revealed && (
            <>
              <Pressable onPress={() => speakErreur(e)}>
                <Text style={st.answer}>✓ {e.corrected}</Text>
              </Pressable>
              {!!e.explanation && <Text style={st.erreurExplication}>{e.explanation}</Text>}
            </>
          )}
        </View>
        {!revueErreurs.revealed ? (
          <Pressable onPress={reveal} style={ui.primaryBtn}>
            <Text style={ui.primaryBtnText}>Voir la correction</Text>
          </Pressable>
        ) : (
          <View style={[ui.chipRow, { justifyContent: "center" }]}>
            <Pressable onPress={() => gradeErreur(RATINGS.again)} style={[ui.primaryBtn, st.grow, { backgroundColor: C.error }]}>
              <Text style={ui.primaryBtnText}>❌ À revoir</Text>
            </Pressable>
            <Pressable onPress={() => gradeErreur(RATINGS.hard)} style={[ui.primaryBtn, st.grow, { backgroundColor: "#b45309" }]}>
              <Text style={ui.primaryBtnText}>😅 Difficile</Text>
            </Pressable>
            <Pressable onPress={() => gradeErreur(RATINGS.good)} style={[ui.primaryBtn, st.grow, { backgroundColor: C.ok }]}>
              <Text style={ui.primaryBtnText}>✅ Bien</Text>
            </Pressable>
            <Pressable onPress={() => gradeErreur(RATINGS.easy)} style={[ui.primaryBtn, st.grow, { backgroundColor: C.primary }]}>
              <Text style={ui.primaryBtnText}>🚀 Facile</Text>
            </Pressable>
          </View>
        )}
        <Pressable onPress={() => setRevueErreurs(null)}>
          <Text style={[ui.status, { textAlign: "center" }]}>✕ Arrêter la révision</Text>
        </Pressable>
      </ScrollView>
    );
  }

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
    [nbMissionsAccomplies(history), "missions accomplies"],
    [deck.length, "mots au carnet"],
    [due.length, "à réviser"],
    [erreurs.length, "erreurs au carnet"],
    [duesErreurs.length, "erreurs à revoir"],
  ];
  const recent = [...deck].sort((a, b) => b.addedAt - a.addedAt).slice(0, 50);
  const erreursRecentes = [...erreurs].sort((a, b) => b.addedAt - a.addedAt).slice(0, 30);

  // Objectif de la semaine (#89) : calculé à chaque rendu depuis l'historique.
  const hebdo = bilanHebdo(history, settings.objectifJours);
  const tenues = semainesTenues(history, settings.objectifJours);

  // Dernières séances et niveau observé (#93).
  const seances = [...history].filter(h => h && Number.isFinite(h.date)).sort((a, b) => b.date - a.date).slice(0, 8);
  const tendance = tendanceNiveau(history);
  const dateCourte = (ms) => new Date(ms).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

  return (
    <ScrollView contentContainerStyle={st.body}>
      <View style={ui.card}>
        <Text style={st.semaineTitre}>🎯 Cette semaine — {hebdo.pratiques} / {hebdo.cible} jours</Text>
        <View style={st.frise}>
          {hebdo.jours.map((ok, i) => (
            <View key={i} style={[st.pastille, ok && st.pastilleOk, i === hebdo.aujourdhui && st.pastilleAujourdhui]}>
              <Text style={[st.pastilleTexte, ok && st.pastilleTexteOk]}>{JOURS_COURTS[i]}</Text>
            </View>
          ))}
        </View>
        <Text style={ui.status}>
          {messageHebdo(hebdo)}
          {hebdo.minutes > 0 ? ` · ≈ ${hebdo.minutes} min` : ""}
          {tenues > 0 ? ` · ${tenues} semaine${tenues > 1 ? "s" : ""} tenue${tenues > 1 ? "s" : ""} d'affilée` : ""}
        </Text>
      </View>
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
      <Pressable onPress={startRevueErreurs} disabled={!duesErreurs.length} style={[ui.primaryBtn, { backgroundColor: "#b45309" }, !duesErreurs.length && { opacity: 0.5 }]}>
        <Text style={ui.primaryBtnText}>🩹 Revoir mes erreurs ({duesErreurs.length})</Text>
      </Pressable>
      <Pressable onPress={exportDeck} disabled={!deck.length} style={[ui.secondaryBtn, !deck.length && { opacity: 0.5 }]}>
        <Text style={ui.secondaryBtnText}>📤 Exporter le carnet (Anki)</Text>
      </Pressable>
      {!!status && <Text style={ui.status}>{status}</Text>}
      {seances.length > 0 && (
        <>
          <Text style={ui.sectionTitle}>Dernières séances</Text>
          {tendance && (
            <Text style={ui.status}>
              🎓 Niveau observé : {tendance.de} → {tendance.a} sur les {tendance.n} dernières séances évaluées
              {tendance.sens > 0 ? " — ça monte !" : tendance.sens < 0 ? " — une séance plus difficile, ça arrive." : " — stable."}
            </Text>
          )}
          {seances.map(h => {
            const ouverte = seanceOuverte === h.id;
            const details = [
              `${h.turns || 0} tour${(h.turns || 0) > 1 ? "s" : ""}`,
              h.missions?.total ? `missions ${h.missions.atteintes}/${h.missions.total}` : null,
              h.niveauObserve ? `niveau ${h.niveauObserve}` : null,
            ].filter(Boolean).join(" · ");
            return (
              <Pressable key={h.id} onPress={() => setSeanceOuverte(ouverte ? null : h.id)} style={st.seance}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={st.deckLang}>{dateCourte(h.date)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={st.deckTerm}>{LANGUAGES[h.lang]?.label || h.lang} · {h.scenario || "libre"}</Text>
                    <Text style={st.deckTranslation}>{details}</Text>
                  </View>
                  {!!h.resume && <Text style={{ color: C.faint }}>{ouverte ? "▴" : "▾"}</Text>}
                </View>
                {ouverte && !!h.resume && (
                  <View style={st.bilan}>
                    <Text style={st.bilanTexte}>{h.resume.texte}</Text>
                    {h.resume.pointsForts?.length > 0 && <Text style={st.bilanExtra}>👍 {h.resume.pointsForts.join(" · ")}</Text>}
                    {!!h.resume.conseil && <Text style={st.bilanExtra}>💡 {h.resume.conseil}</Text>}
                  </View>
                )}
              </Pressable>
            );
          })}
        </>
      )}
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
      <Text style={ui.sectionTitle}>Carnet d'erreurs</Text>
      {!erreurs.length && <Text style={ui.status}>Aucune erreur retenue — elles s'ajoutent à chaque correction du tuteur.</Text>}
      {erreursRecentes.map(e => (
        <View key={e.id} style={st.deckRow}>
          <Text style={st.deckLang}>{LANGUAGES[e.lang]?.label || e.lang}</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.erreurLigne}>✗ {e.original}</Text>
            <Text style={st.deckTerm}>✓ {e.corrected}</Text>
            {!!e.explanation && <Text style={st.deckTranslation}>{e.explanation}</Text>}
          </View>
          <Chip label="🔊" onPress={() => speakErreur(e)} />
          <Pressable onPress={() => removeErreur(e.id)} style={{ padding: 6 }}>
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
  semaineTitre: { fontSize: 15, fontWeight: "700", color: C.text },
  frise: { flexDirection: "row", justifyContent: "space-between", gap: 6, marginVertical: 4 },
  pastille: { flex: 1, aspectRatio: 1, maxWidth: 44, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  pastilleOk: { backgroundColor: C.ok, borderColor: C.ok },
  pastilleAujourdhui: { borderColor: C.primary, borderWidth: 2 },
  pastilleTexte: { fontSize: 13, fontWeight: "700", color: C.muted },
  pastilleTexteOk: { color: "#fff" },
  erreurOriginal: { fontSize: 20, fontWeight: "600", color: C.error, textAlign: "center" },
  erreurExplication: { fontSize: 14, color: "#57534e", textAlign: "center", marginTop: 4 },
  erreurLigne: { fontSize: 14, color: C.error },
  seance: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, gap: 6 },
  bilan: { backgroundColor: "#fffbeb", borderRadius: 8, padding: 10, gap: 6 },
  bilanTexte: { color: "#44403c", fontSize: 13, lineHeight: 19 },
  bilanExtra: { color: "#78350f", fontSize: 13, lineHeight: 19 },
});
