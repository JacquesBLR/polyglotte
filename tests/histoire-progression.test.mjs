// Histoires avancées (#125) : longueur bornée et progression pendant la génération.
// Sur 2.0.0-beta.44, une histoire avancée en japonais, arabe ou tunisien prenait 74 à 100 s
// (993 à 1 283 jetons, 4 appels réels en parallèle via gw) sous un statut fixe.
import { test } from "node:test";
import assert from "node:assert/strict";

import { LONGUEUR, MOTS_MAX, demandeHistoire, progressionHistoire } from "../app/core/histoire.js";
import { progressionTrous } from "../app/core/trous.js";
import { langConfig } from "../app/core/languages.js";

test("demandeHistoire : plafond de mots par niveau, en caractères pour le japonais", () => {
  for (const lvl of Object.keys(LONGUEUR)) {
    assert.match(LONGUEUR[lvl], new RegExp(`${MOTS_MAX[lvl]} mots au plus`));
    assert.match(demandeHistoire({ cfg: langConfig("espagnol"), level: lvl }), /ne dépasse pas ce plafond/);
  }
  assert.ok(MOTS_MAX.debutant < MOTS_MAX.intermediaire && MOTS_MAX.intermediaire < MOTS_MAX.avance);
  assert.ok(MOTS_MAX.avance <= 100, "l'avancé reste borné");
  assert.match(demandeHistoire({ cfg: langConfig("japonais"), level: "avance" }), /en japonais : 250 caractères au plus/);
  assert.doesNotMatch(demandeHistoire({ cfg: langConfig("arabe"), level: "avance" }), /caractères au plus/);
  assert.match(demandeHistoire({ cfg: langConfig("arabe"), level: "inconnu" }), /40 mots au plus/);
});

const J = (o) => JSON.stringify(o);

test("progressionHistoire : étapes dans l'ordre du schéma, part croissante, jamais 100 %", () => {
  const opts = { lecture: true, level: "intermediaire", ecriture: "japonais" };
  const texte = "雨が降っていました。ゆきさんは傘を持っていませんでした。";
  const complet = J({ titre: "Le parapluie", texte, reading: "Ame ga futte imashita. Yuki-san wa kasa o motte imasen deshita.",
    traduction: "Il pleuvait. Yuki n'avait pas de parapluie.", questions: [
      { question: "Quel temps ?", choix: ["pluie", "soleil", "neige"], bonne: 0 },
      { question: "Qui ?", choix: ["Yuki", "Aki", "Ken"], bonne: 0 },
      { question: "Quoi ?", choix: ["parapluie", "sac", "clé"], bonne: 0 }] });
  const parts = [];
  let etapes = [];
  for (let n = 0; n <= complet.length; n += 7) {
    const p = progressionHistoire(complet.slice(0, n), opts);
    parts.push(p.part);
    if (etapes.at(-1) !== p.libelle) etapes.push(p.libelle);
  }
  assert.deepEqual(etapes, ["réfléchit à l'histoire", "écrit l'histoire", "écrit la transcription", "traduit l'histoire", "prépare les questions"]);
  for (let i = 1; i < parts.length; i++) assert.ok(parts[i] >= parts[i - 1], `part décroissante en ${i}`);
  assert.ok(parts.at(-1) <= 0.99 && parts.at(-1) > 0.9);
});

test("progressionHistoire : sans translittération (alphabet latin), trois étapes ; entrées vides", () => {
  const p = progressionHistoire(J({ titre: "t", texte: "Hola", traduction: "Bonjour" }).slice(0, -2), { lecture: false, level: "avance" });
  assert.equal(p.libelle, "traduit l'histoire");
  assert.ok(p.part > 0.3 && p.part < 0.8);
  assert.deepEqual(progressionHistoire(null), { etape: 0, libelle: "réfléchit à l'histoire", part: 0 });
  assert.deepEqual(progressionHistoire(undefined, { level: "inconnu", ecriture: "inconnue" }).part, 0);
  // reading null (anyOf) : l'étape suivante prend le relais.
  assert.equal(progressionHistoire('{"titre":"t","texte":"Hola","reading":null,"traduction":"Bon', { lecture: true }).libelle, "traduit l'histoire");
});

test("progressionTrous : phrases complètes reçues sur 5", () => {
  const ph = (i) => ({ phrase: `p${i} ___`, reponse: "r", indice: "i", traduction: "t", reading: "x" });
  const b = J({ phrases: [ph(1), ph(2)] }).slice(0, -3);
  assert.deepEqual(progressionTrous(b), { faites: 2, part: 0.4 });
  assert.deepEqual(progressionTrous(J({ phrases: [ph(1)] }), { lecture: false }), { faites: 1, part: 0.2 });
  assert.deepEqual(progressionTrous(J({ phrases: [1, 2, 3, 4, 5, 6].map(ph) })), { faites: 5, part: 0.99 });
  assert.deepEqual(progressionTrous(""), { faites: 0, part: 0 });
});
