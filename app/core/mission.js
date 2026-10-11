// Missions de scénario (#91) — fonctions pures.
//
// Un scénario donnait un décor au tuteur, pas de but à l'élève : il répondait aux questions
// jusqu'à décider d'arrêter. Le tuteur propose désormais trois missions au premier tour,
// graduées au niveau, et coche celles que l'élève accomplit au fil des tours — comme les
// objectifs des Roleplays de Speak, le but affiché du Roleplay de Duolingo Max ou les
// scenario goals de Praktika. L'app ne juge rien elle-même : elle valide et cumule ce que
// le modèle déclare, et ne perd jamais une mission déjà cochée.

export const NB_MISSIONS = 3;

// Gradation CECRL : ce qu'une mission demande selon le niveau de l'app.
export const MISSION_PAR_NIVEAU = {
  debutant: "des actes de parole élémentaires du scénario — saluer, se présenter, commander, demander un prix ou un chemin, remercier ; une phrase compréhensible suffit pour réussir",
  intermediaire: "obtenir quelque chose dans le scénario — se renseigner, expliquer un problème, négocier, raconter ce qui s'est passé ; plusieurs échanges sont nécessaires",
  avance: "des nuances — convaincre, nuancer un avis, plaisanter, réagir à un imprévu, tenir le registre (formel ou familier) que la situation demande",
};

// Consigne de prompt : chaîne vide pour un niveau inconnu (le prompt reste alors inchangé).
//
// Deux temps. Avant le premier tour, le tuteur choisit les missions. Dès qu'il les a
// annoncées, l'app les **réinjecte** dans le prompt système (`missions`) : l'historique ne
// contient que ses répliques, pas le JSON, et sans cela le modèle oublie sa propre liste
// dès le deuxième tour — sondé sur le résident : il en réinventait une autre et cochait
// contre celle-là.
export function blocMissionsPrompt(level, missions = []) {
  const gradation = MISSION_PAR_NIVEAU[level];
  if (!gradation) return "";
  const liste = missionsValides(missions);
  const choix = liste.length
    ? `- MISSIONS de cette conversation (déjà annoncées — "missions" reste un tableau VIDE) :
${liste.map((m, i) => `  ${i + 1}. ${m}`).join("\n")}
  Ne les récite pas dans "reply" : amène au fil de la conversation les situations qui les appellent, une à la fois.`
    : `- MISSIONS : au message "[START]", choisis ${NB_MISSIONS} missions concrètes pour ce scénario, EN FRANÇAIS, à l'infinitif
  (3 à 8 mots chacune), graduées au niveau de l'élève : ${gradation}. Mets-les dans "missions" — tableau vide à tous
  les autres tours. Ne les récite pas dans "reply" : amène au fil de la conversation les situations qui les appellent, une à la fois.`;
  return `${choix}
- "missions_accomplies" : numéros (1 à ${NB_MISSIONS}) des missions que l'élève vient d'ACCOMPLIR dans son dernier message, dans la
  langue cible et de façon compréhensible même avec des fautes. N'invente aucune réussite ; tableau vide s'il n'a rien
  accompli de nouveau. Quand toutes sont accomplies, félicite-le brièvement dans "reply" et propose de conclure.`;
}

// Missions annoncées par le modèle : chaînes non vides, nettoyées, NB_MISSIONS au plus.
export function missionsValides(liste) {
  if (!Array.isArray(liste)) return [];
  return liste
    .filter(m => typeof m === "string" && m.trim())
    .map(m => m.trim().replace(/\s+/g, " "))
    .slice(0, NB_MISSIONS);
}

// Cumule les missions accomplies : identifiants entiers dans 1..total, dédoublonnés, triés ;
// une mission déjà cochée ne se décoche jamais.
export function fusionneAtteints(precedents, nouveaux, total) {
  const ok = new Set((precedents || []).filter(n => Number.isInteger(n) && n >= 1 && n <= total));
  for (const n of Array.isArray(nouveaux) ? nouveaux : []) {
    if (Number.isInteger(n) && n >= 1 && n <= total) ok.add(n);
  }
  return [...ok].sort((a, b) => a - b);
}

export function missionAccomplie(missions, atteints) {
  return missions.length > 0 && atteints.length >= missions.length;
}

// Message d'étape, ou null quand il n'y a rien de neuf à dire.
export function messageMission(missions, atteints, nouvelles) {
  if (!missions.length || nouvelles <= 0) return null;
  if (missionAccomplie(missions, atteints)) return "🎉 Toutes les missions sont accomplies ! Appuie sur ✅ quand tu veux ton résumé.";
  return `✔ Mission accomplie (${atteints.length} / ${missions.length}).`;
}

// Sessions de l'historique dont toutes les missions ont été accomplies.
export function nbMissionsAccomplies(history) {
  return (history || []).filter(h => h && h.missions && h.missions.total > 0 && h.missions.atteintes >= h.missions.total).length;
}
