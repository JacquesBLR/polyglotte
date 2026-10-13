// Relecture adverse de la nuit du 12 au 13/10 (#117 à #124) : un test par défaut confirmé,
// rouge sur 2.0.0-beta.42. Les phrases viennent de sorties réelles du résident via gw.
import { test } from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";

import { TROU, trousValides } from "../app/core/trous.js";
import * as mission from "../app/core/mission.js";
import * as schemas from "../app/core/schemas.js";
import { buildTutorPrompt } from "../app/core/prompts.js";
import { langConfig } from "../app/core/languages.js";
import { leconParId, niveauApp } from "../app/core/parcours.js";

const p = (phrase, reponse, indice = "indice") => ({ phrase, reponse, indice, traduction: "t" });

test("trous : un trou noté « __ » (deux soulignés) n'écarte plus tout l'exercice", () => {
  // Sortie réelle (espagnol, ser/estar) : les 5 phrases notaient le trou « __ » ; toutes
  // étaient écartées et l'élève lisait « réessaie ».
  const t = trousValides({ phrases: [
    p("En el barrio de Triana, la gente __ amable y simpática.", "es"),
    p("No sé dónde __ el Museo de Bellas Artes.", "está"),
    p("Mi hermana __ muy alta, pero yo __ baja.", "es / soy"), // deux trous : écartée
  ] });
  assert.ok(t, "l'exercice n'est plus écarté en entier");
  assert.deepEqual(t.map(x => x.phrase), [
    `En el barrio de Triana, la gente ${TROU} amable y simpática.`,
    `No sé dónde ${TROU} el Museo de Bellas Artes.`,
  ]);
  const jp = trousValides({ phrases: [p("私＿＿＿学生です。", "は")] }, { charBased: true, ecriture: "japonais" });
  assert.equal(jp?.[0].phrase, `私${TROU}学生です。`, "soulignés pleine chasse ramenés à ___");
});

test("trous : la règle « réponse collée au trou » ne franchit pas la ponctuation, et ignore la voyellation", () => {
  // Sortie réelle (allemand, Konjunktiv II) : « wohnen würde, würde ich » est correct, la
  // virgule sépare les deux « würde » ; la phrase était écartée comme un « es es ».
  const t = trousValides({ phrases: [p("Wenn ich in Berlin wohnen ___, würde ich jeden Tag in den Tierpark gehen.", "würde")] });
  assert.equal(t?.length, 1);
  // Sortie réelle (arabe) : « هو ___ طالب » / « طالِب » donnerait « طالِب طالب » ; la kasra
  // masquait le doublon.
  assert.equal(trousValides({ phrases: [p("هو ___ طالب", "طالِب")] }), null);
  // Inchangé : le vrai doublon accolé reste écarté ; un accent latin distingue deux mots.
  assert.equal(trousValides({ phrases: [p("Él ___ es médico.", "es")] }), null);
  assert.equal(trousValides({ phrases: [p("¿Dónde ___ esta calle?", "está")] })?.length, 1);
});

test("trous : « 2e personne » dans l'indice ne passe plus pour la réponse « é »", () => {
  // Sortie réelle (portugais du Brésil) : l'indice était retiré, « 2e » contenant « e ».
  const [t] = trousValides({ phrases: [p("Você ___ de onde?", "é", "verbe 'ser', 2e personne du singulier au présent de l'indicatif")] });
  assert.equal(t.indice, "verbe 'ser', 2e personne du singulier au présent de l'indicatif");
  const [u] = trousValides({ phrases: [p("Você ___ de onde?", "é", "le verbe ser : é")] });
  assert.equal(u.indice, "", "un indice qui donne vraiment la réponse reste retiré");
});

// --- Missions cochées pour un message hors langue cible (#119, #120) --------------------
// Via gw (beta.42) : 12 messages en français ou en anglais sur 12 cochaient au moins une
// mission, 7 les trois ; dans l'app (Chromium), « Commander à boire et à manger » en catalan
// a été validée par un seul message en français (✅ au programme, 1 / 12 à l'accueil).

test("missions : un tour déclaré hors langue cible ne crédite aucune mission", () => {
  assert.equal(typeof mission.accompliesDuTour, "function", "accompliesDuTour absente");
  const { accompliesDuTour } = mission;
  assert.deepEqual(accompliesDuTour({ langue_cible: false, missions_accomplies: [1, 2, 3] }), []);
  assert.deepEqual(accompliesDuTour({ langue_cible: true, missions_accomplies: [1, 3] }), [1, 3]);
  assert.deepEqual(accompliesDuTour({ missions_accomplies: [2] }), [2], "champ absent : comme avant");
  assert.deepEqual(accompliesDuTour({ langue_cible: true }), []);
  assert.deepEqual(accompliesDuTour(null), []);
  // Fusion telle que la fait App.js : la leçon ne se valide pas.
  assert.deepEqual(mission.fusionneAtteints([], accompliesDuTour({ langue_cible: false, missions_accomplies: [1, 2, 3] }), 3), []);
});

test("missions : le schéma du tour demande la langue du message juste avant les numéros", () => {
  const s = schemas.schemaTour({ lecture: false, nbMissions: 3 });
  const cles = Object.keys(s.properties);
  assert.ok(cles.includes("langue_cible"), "langue_cible absente du schéma du tour");
  assert.equal(cles.indexOf("langue_cible") + 1, cles.indexOf("missions_accomplies"));
  assert.deepEqual([...s.required].sort(), [...cles].sort());
  assert.equal(s.properties.langue_cible.type, "boolean");
  // Seulement quand il y a des missions à cocher ; le schéma complet de référence est inchangé.
  assert.ok(!("langue_cible" in schemas.schemaTour({ lecture: false, nbMissions: 0 }).properties));
  assert.ok(!("langue_cible" in schemas.schemaTour({ nbMissions: 3, missions: false }).properties));
  assert.ok(!("langue_cible" in schemas.RESPONSE_SCHEMA.properties));
});

test("missions : la consigne dit qu'un message dans une autre langue n'accomplit aucune mission", () => {
  const cfg = langConfig("espagnol");
  const lecon = leconParId("a1-cafe");
  const p = buildTutorPrompt({ cfg, level: niveauApp(lecon.cecrl), scenarioId: "lecon", immersion: false, mode: "chat", lecon, missions: lecon.missions });
  assert.match(p, /"langue_cible" : true si le dernier message de l'élève est écrit en espagnol/);
  assert.match(p, /n'accomplit AUCUNE mission/);
  assert.match(p, /un message en français n'accomplit aucune mission/);
});

test("missions : App.js crédite les missions par accompliesDuTour", () => {
  const source = readFileSync(new URL("../app/App.js", import.meta.url), "utf8");
  assert.match(source, /fusionneAtteints\(s\.missions\.atteintes, accompliesDuTour\(data\), s\.missions\.liste\.length\)/);
  assert.doesNotMatch(source, /fusionneAtteints\([^)]*data\.missions_accomplies/);
});
