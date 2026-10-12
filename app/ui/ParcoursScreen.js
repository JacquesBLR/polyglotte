// Parcours guidé (#111) : le programme d'un niveau, leçon par leçon, avec ce qui est validé.
// Rien n'est verrouillé — la prochaine leçon est mise en avant, toutes se lancent.

import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CECRL_PAR_NIVEAU, avancement, bilanNiveau, leconsDuNiveau, numero, prochaineLecon } from "../core/parcours";
import { C, Chip, ui } from "./common";

const NIVEAUX = [["debutant", "Débutant"], ["intermediaire", "Intermédiaire"], ["avance", "Avancé"]];

export default function ParcoursScreen({ cfg, level, validees, niveauxOk = new Set(), onStart }) {
  const [niveau, setNiveau] = useState(level);
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
              <Pressable key={u.id} onPress={() => onStart(u)} style={[ui.card, enAvant && st.enAvant]}>
                <Text style={st.titre}>{faite ? "✅" : enAvant ? "▶" : "○"} {numero(u)} · {u.titre}</Text>
                {u.missions.map((m, i) => <Text key={i} style={st.objectif}>• Je peux : {m.charAt(0).toLowerCase() + m.slice(1)}</Text>)}
                <Text style={st.detail}>Grammaire : {u.grammaire}</Text>
                <Text style={st.detail}>Lexique : {u.lexique.replaceAll("{ville}", cfg.tutor.city)}</Text>
              </Pressable>
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
});
