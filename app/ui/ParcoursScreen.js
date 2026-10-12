// Parcours guidé (#111) : le programme d'un niveau, leçon par leçon, avec ce qui est validé.
// Rien n'est verrouillé — la prochaine leçon est mise en avant, toutes se lancent. Chaque
// leçon peut se préparer : 5 phrases clés à écouter avant de parler (#116).

import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { callModel, hasCredentials } from "../core/api";
import {
  CECRL_PAR_NIVEAU, avancement, bilanNiveau, demandePhrasesCles, leconsDuNiveau, niveauApp, numero, phrasesClesValides,
  prochaineLecon, schemaPhrasesCles,
} from "../core/parcours";
import { exoSystemPrompt } from "../core/prompts";
import * as speech from "../speech/speech";
import { C, Chip, ui } from "./common";

const NIVEAUX = [["debutant", "Débutant"], ["intermediaire", "Intermédiaire"], ["avance", "Avancé"]];

export default function ParcoursScreen({ settings, cfg, level, validees, niveauxOk = new Set(), onStart, onOpenSettings }) {
  const [niveau, setNiveau] = useState(level);
  const [prep, setPrep] = useState(null); // { lecon, etat: "chargement"|"ok"|"erreur", phrases, message }
  const dire = (t) => speech.speak(t, { ttsPrefixes: cfg.ttsPrefixes, stt: cfg.stt, support: cfg.support, voixServeur: cfg.voixServeur, langue: cfg.label, rate: settings?.rate });

  // Jeton de la préparation en cours : une réponse tardive (retour au programme, ou autre
  // leçon préparée entre-temps) est ignorée au lieu de réafficher une préparation périmée.
  const jeton = useRef(0);
  const preparer = async (lecon) => {
    if (!hasCredentials(settings)) { onOpenSettings?.(); return; }
    speech.primeSpeech();
    const mien = ++jeton.current;
    const pose = (etat) => { if (jeton.current === mien) setPrep(etat); };
    setPrep({ lecon, etat: "chargement" });
    try {
      const raw = await callModel(settings, {
        messages: [{ role: "user", content: demandePhrasesCles(lecon, cfg) }],
        system: exoSystemPrompt({ cfg, level: niveauApp(lecon.cecrl) }),
        schema: schemaPhrasesCles({ lecture: !!cfg.reading }),
        maxTokens: 1500,
      });
      let phrases = null;
      try { phrases = phrasesClesValides(JSON.parse(raw), lecon.missions.length); } catch (_) { phrases = null; }
      if (!phrases) throw new Error("Le tuteur n'a pas su préparer les phrases — réessaie, ou lance directement la conversation.");
      pose({ lecon, etat: "ok", phrases });
    } catch (err) {
      pose({ lecon, etat: "erreur", message: err.message });
    }
  };

  if (prep) {
    const { lecon } = prep;
    return (
      <ScrollView contentContainerStyle={st.body}>
        <Text style={st.titre}>📖 {numero(lecon)} · {lecon.titre}</Text>
        {lecon.missions.map((m, i) => <Text key={i} style={st.objectif}>{i + 1}. {m}</Text>)}
        {prep.etat === "chargement" && <Text style={ui.status}>{cfg.tutor.name} prépare les phrases clés…</Text>}
        {prep.etat === "erreur" && <Text style={[ui.status, ui.statusError]}>{prep.message}</Text>}
        {prep.etat === "ok" && (
          <>
            <Text style={ui.status}>Écoute chaque phrase et répète-la à voix haute. Tu pourras les dire pendant la conversation.</Text>
            {prep.phrases.map((p, i) => (
              <View key={i} style={ui.card}>
                <Pressable onPress={() => dire(p.phrase)}>
                  <Text style={[st.phrase, cfg.rtl && st.rtl]}>🔊 {p.phrase}</Text>
                </Pressable>
                {!!p.reading && <Text style={st.detail}>{p.reading}</Text>}
                {!!p.traduction && <Text style={st.objectif}>🇫🇷 {p.traduction}</Text>}
                {!!p.usage && <Text style={st.detail}>💡 {p.usage}{p.mission ? ` (mission ${p.mission})` : ""}</Text>}
              </View>
            ))}
          </>
        )}
        <Pressable
          onPress={() => { jeton.current++; onStart(prep.etat === "ok" ? { ...lecon, phrasesCles: prep.phrases } : lecon); }}
          disabled={prep.etat === "chargement"}
          style={[ui.primaryBtn, prep.etat === "chargement" && { opacity: 0.5 }]}
        >
          <Text style={ui.primaryBtnText}>▶ Commencer la conversation</Text>
        </Pressable>
        <Pressable onPress={() => { speech.stopSpeaking(); jeton.current++; setPrep(null); }}>
          <Text style={[ui.status, { textAlign: "center" }]}>← Retour au programme</Text>
        </Pressable>
      </ScrollView>
    );
  }
  const lecons = leconsDuNiveau(niveau);
  const suivante = prochaineLecon(niveau, validees);
  const av = avancement(niveau, validees);

  return (
    <ScrollView contentContainerStyle={st.body}>
      <View style={ui.chipRow}>
        {NIVEAUX.map(([id, label]) => <Chip key={id} label={label} active={niveau === id} onPress={() => setNiveau(id)} />)}
      </View>
      <Text style={ui.status}>
        {cfg.label} — {av.faites} / {av.total} leçons validées. Une leçon est validée quand ses trois objectifs
        sont cochés pendant la conversation avec {cfg.tutor.name}.
      </Text>
      {CECRL_PAR_NIVEAU[niveau].map(cecrl => (
        <View key={cecrl} style={{ gap: 8 }}>
          <Text style={ui.sectionTitle}>Niveau {cecrl}</Text>
          {lecons.filter(u => u.cecrl === cecrl).map(u => {
            const faite = validees.has(u.id);
            const enAvant = suivante && suivante.id === u.id;
            return (
              <View key={u.id} style={[ui.card, enAvant && st.enAvant]}>
                <Text style={st.titre}>{faite ? "✅" : enAvant ? "▶" : "○"} {numero(u)} · {u.titre}</Text>
                {u.missions.map((m, i) => <Text key={i} style={st.objectif}>• Je peux : {m.charAt(0).toLowerCase() + m.slice(1)}</Text>)}
                <Text style={st.detail}>Grammaire : {u.grammaire}</Text>
                <Text style={st.detail}>Lexique : {u.lexique.replaceAll("{ville}", cfg.tutor.city)}</Text>
                <View style={ui.chipRow}>
                  <Chip label="📖 Préparer" onPress={() => preparer(u)} />
                  <Chip label="▶ Parler" active={enAvant} onPress={() => onStart(u)} />
                </View>
              </View>
            );
          })}
          {(() => {
            // Bilan de fin de niveau (#114) : mis en avant quand les six leçons sont validées.
            const pret = lecons.filter(u => u.cecrl === cecrl).every(u => validees.has(u.id));
            const ok = niveauxOk.has(cecrl);
            return (
              <Pressable onPress={() => onStart(bilanNiveau(cecrl))} style={[ui.card, st.bilan, pret && !ok && st.enAvant]}>
                <Text style={st.titre}>{ok ? `🏅 Niveau ${cecrl} validé` : `🏅 Bilan ${cecrl}`}</Text>
                <Text style={st.detail}>
                  {ok ? "Tu peux repasser le bilan quand tu veux : les missions sont tirées à nouveau."
                    : `Trois missions tirées dans trois leçons ${cecrl} différentes, enchaînées dans une même conversation. Réussi = niveau ${cecrl} validé.`}
                </Text>
              </Pressable>
            );
          })()}
        </View>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  body: { padding: 16, gap: 10 },
  enAvant: { borderColor: C.primary, borderWidth: 2 },
  bilan: { backgroundColor: "#fffbeb" },
  titre: { fontSize: 16, fontWeight: "700", color: C.text },
  objectif: { fontSize: 14, color: "#44403c" },
  detail: { fontSize: 13, color: C.muted },
  phrase: { fontSize: 17, color: C.text, fontWeight: "500" },
  rtl: { writingDirection: "rtl", textAlign: "right" },
});
