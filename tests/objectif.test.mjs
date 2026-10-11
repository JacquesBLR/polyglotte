// Tests de l'objectif hebdomadaire (#89).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  JOURS_COURTS, OBJECTIF_JOURS_DEFAUT, OBJECTIFS_JOURS, bilanHebdo, debutSemaine, indexJour, messageHebdo,
  normaliseCible, semainesTenues,
} from "../app/core/objectif.js";
import { DEFAULT_SETTINGS, fusionneReglages } from "../app/core/settings.js";

// Dates en heure locale : les tests ne dépendent pas du fuseau de la machine.
// Le 12 octobre 2026 est un lundi.
const local = (jour, heure = 10, minute = 0) => new Date(2026, 9, jour, heure, minute, 0, 0).getTime();
const session = (debut, minutes = 0) => ({ id: String(debut), date: debut, lastAt: debut + minutes * 60000, turns: 3 });

test("constantes : cibles proposées, défaut, frise lundi → dimanche", () => {
  assert.deepEqual(OBJECTIFS_JOURS, [3, 4, 5, 7]);
  assert.ok(OBJECTIFS_JOURS.includes(OBJECTIF_JOURS_DEFAUT));
  assert.equal(JOURS_COURTS.length, 7);
  assert.equal(JOURS_COURTS[0], "L");
});

test("indexJour et debutSemaine : la semaine commence le lundi, en heure locale", () => {
  assert.equal(indexJour(local(12)), 0); // lundi
  assert.equal(indexJour(local(18)), 6); // dimanche
  assert.equal(debutSemaine(local(15, 23, 59)), local(12, 0));
  assert.equal(debutSemaine(local(18, 23, 59)), local(12, 0));
  assert.equal(debutSemaine(local(19, 0, 0)), local(19, 0)); // lundi suivant
});

test("bilanHebdo : jours pratiqués, minutes, reste à faire", () => {
  const history = [session(local(12, 9), 12), session(local(12, 20), 5), session(local(14, 8), 0), session(local(5, 10), 30)];
  const b = bilanHebdo(history, 4, local(14, 18));
  assert.deepEqual(b.jours, [true, false, true, false, false, false, false]);
  assert.equal(b.pratiques, 2);
  assert.equal(b.cible, 4);
  assert.equal(b.minutes, 18, "12 + 5 + plancher d'une minute pour la session sans durée ; la semaine passée ne compte pas");
  assert.equal(b.atteint, false);
  assert.equal(b.restants, 2);
  assert.equal(b.aujourdhui, 2);
  assert.equal(b.joursRestants, 5);
  assert.equal(b.tenable, true);
});

test("bilanHebdo : objectif atteint, puis hors de portée quand il manque des jours", () => {
  const history = [session(local(12)), session(local(13)), session(local(14))];
  assert.equal(bilanHebdo(history, 3, local(14, 12)).atteint, true);
  // Samedi, 3 jours faits, cible 7 : il reste samedi et dimanche, pas de quoi faire 4 jours.
  const b = bilanHebdo(history, 7, local(17, 12));
  assert.equal(b.atteint, false);
  assert.equal(b.restants, 4);
  assert.equal(b.tenable, false);
  // Samedi déjà pratiqué : il ne compte pas deux fois parmi les jours disponibles.
  const c = bilanHebdo([...history, session(local(17, 9))], 6, local(17, 12));
  assert.equal(c.pratiques, 4);
  assert.equal(c.restants, 2);
  assert.equal(c.tenable, false, "il ne reste que dimanche pour deux jours");
});

test("bilanHebdo : une session à cheval sur minuit compte pour le jour où elle a commencé", () => {
  const b = bilanHebdo([session(local(18, 23, 50), 25)], 4, local(19, 12)); // dimanche soir → lundi
  assert.equal(b.pratiques, 0, "la semaine suivante ne la voit pas");
  const avant = bilanHebdo([session(local(18, 23, 50), 25)], 4, local(18, 23, 55));
  assert.deepEqual(avant.jours, [false, false, false, false, false, false, true]);
  assert.equal(avant.minutes, 25);
});

test("bilanHebdo : historique vide ou entrées invalides, cible hors bornes ramenée au défaut", () => {
  const b = bilanHebdo([], "12", local(12));
  assert.equal(b.pratiques, 0);
  assert.equal(b.cible, OBJECTIF_JOURS_DEFAUT);
  assert.equal(bilanHebdo([null, { date: "hier" }], 0, local(12)).pratiques, 0);
  assert.equal(normaliseCible(7), 7);
  assert.equal(normaliseCible(8), OBJECTIF_JOURS_DEFAUT);
  assert.equal(normaliseCible(undefined), OBJECTIF_JOURS_DEFAUT);
});

test("semainesTenues : les semaines passées tenues d'affilée, la semaine en cours sans la compter contre l'élève", () => {
  const history = [];
  // Trois semaines précédentes à 3 jours chacune (21, 28 septembre, 5 octobre : lundis).
  for (const lundi of [21, 28]) for (const d of [0, 2, 4]) history.push(session(new Date(2026, 8, lundi + d, 10).getTime()));
  for (const d of [0, 2, 4]) history.push(session(local(5 + d)));
  // Semaine en cours : un seul jour pour l'instant.
  history.push(session(local(12)));
  assert.equal(semainesTenues(history, 3, local(13)), 3, "la semaine en cours n'est pas encore tenue, mais ne casse rien");
  history.push(session(local(13)), session(local(14)));
  assert.equal(semainesTenues(history, 3, local(14, 20)), 4, "la semaine en cours, tenue, compte");
  assert.equal(semainesTenues(history, 4, local(14, 20)), 0, "avec une cible de 4, aucune semaine passée n'est tenue");
  assert.equal(semainesTenues([], 3, local(14)), 0);
});

test("messageHebdo : accordé à la situation", () => {
  const b = (patch) => ({ pratiques: 1, cible: 4, restants: 3, atteint: false, tenable: true, ...patch });
  assert.match(messageHebdo(b({ atteint: true, pratiques: 4, restants: 0 })), /^Objectif atteint : 4 jours/);
  assert.match(messageHebdo(b()), /Encore 3 jours/);
  assert.match(messageHebdo(b({ restants: 1 })), /Plus qu'un jour/);
  assert.match(messageHebdo(b({ tenable: false })), /On repart lundi/);
  assert.match(messageHebdo(b({ atteint: true, pratiques: 1, cible: 1, restants: 0 })), /1 jour cette semaine/);
});

test("réglage objectifJours : défaut présent, garni sur une installation existante sans migration", () => {
  assert.equal(DEFAULT_SETTINGS.objectifJours, OBJECTIF_JOURS_DEFAUT);
  const { settings, modifie } = fusionneReglages({ provider: "local", localUrl: "https://x/v1", localModel: "m", defautsDgx: 2 });
  assert.equal(settings.objectifJours, OBJECTIF_JOURS_DEFAUT);
  assert.equal(modifie, false, "pas de réécriture : le défaut vit en mémoire");
  assert.equal(fusionneReglages({ objectifJours: 7, defautsDgx: 2 }).settings.objectifJours, 7, "un choix enregistré est respecté");
});
