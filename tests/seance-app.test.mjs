// Séance ouverte par App.js : la chaîne du parcours (#111, #114, #116) et les histoires à
// écouter (#113) modifient le même littéral `session.current`. Ne garder qu'un côté du
// conflit construit sans erreur : sans `missions` ni `lecon`, plus aucune leçon n'est
// validée, sans signal ; sans `ecoute`, le mode écoute ne masque plus rien. Le test évalue
// le littéral réel de startSession, puis rejoue la validation d'une leçon.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PROGRAMME, leconsValidees } from "../app/core/parcours.js";

const SOURCE = readFileSync(new URL("../app/App.js", import.meta.url), "utf8");

// Texte du littéral `session.current = { … }` écrit par startSession.
function litteralSeance() {
  const debut = SOURCE.indexOf("session.current = {", SOURCE.indexOf("const startSession"));
  assert.ok(debut > 0, "`session.current = {` introuvable dans startSession");
  const ouvrante = SOURCE.indexOf("{", debut);
  let profondeur = 0;
  for (let i = ouvrante; i < SOURCE.length; i++) {
    if (SOURCE[i] === "{") profondeur++;
    else if (SOURCE[i] === "}" && --profondeur === 0) return SOURCE.slice(ouvrante, i + 1);
  }
  throw new Error("littéral de séance non refermé");
}

// Évalue le littéral avec les variables locales de startSession données dans `locales` ;
// un autre identifiant vaut undefined, les globaux (Date…) restent ceux de Node.
function ouvreSeance(locales) {
  const portee = new Proxy(locales, {
    has: (cible, cle) => cle in cible || !(cle in globalThis),
    get: (cible, cle) => cible[cle],
  });
  return new Function("portee", `with (portee) { return (${litteralSeance()}); }`)(portee);
}

const LECON = PROGRAMME.find(u => u.cecrl === "A1");

function locales({ mode = "chat", lec = LECON, ecoute = false } = {}) {
  return {
    c: { label: "Espagnol" }, langId: "es", mode, lec, ecoute, mys: null,
    ctx: { level: "debutant", scenarioId: lec ? "lecon" : "libre", lecon: lec },
    missionsInitiales: { liste: lec ? [...lec.missions] : [], atteintes: [] },
    buildTutorPrompt: () => "consigne",
  };
}

test("séance de leçon : session.current porte les missions et la leçon, la leçon se valide (#111 × #113)", () => {
  const s = ouvreSeance(locales());
  assert.deepEqual(s.missions.liste, LECON.missions);
  assert.equal(s.lecon, LECON);
  // Les trois missions cochées, l'entrée d'historique (même calcul que recordSessionTurn)
  // valide la leçon.
  s.missions.atteintes = [...s.missions.liste];
  const entree = { id: s.id, lang: s.lang, missions: { total: s.missions.liste.length, atteintes: s.missions.atteintes.length } };
  if (s.lecon) entree.lecon = s.lecon.id;
  assert.ok(leconsValidees([entree], "es").has(LECON.id));
});

test("séance : le mode écoute est figé à l'ouverture, en conversation seulement (#113)", () => {
  assert.equal(ouvreSeance(locales({ ecoute: true })).ecoute, true);
  assert.equal(ouvreSeance(locales({ ecoute: false })).ecoute, false);
  assert.equal(ouvreSeance(locales({ mode: "eval", lec: null, ecoute: true })).ecoute, false);
});
