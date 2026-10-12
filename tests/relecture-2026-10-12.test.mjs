// Reproductions des défauts confirmés par la relecture adverse du 2026-10-12 (PR #88 à #96).
// Chaque test échouait avant le correctif.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { scorePrononciation, integreScore, moyennePrononciation } from "../app/core/prononciation.js";
import { ajouteErreur, erreursAReactiver, marqueReactivees } from "../app/core/erreurs.js";
import { bilanHebdo } from "../app/core/objectif.js";
import { entreeResume, integreResume, tendanceNiveau, TEXTE_MAX } from "../app/core/resume.js";
import { blocMissionsPrompt, missionsValides } from "../app/core/mission.js";
import { langConfig } from "../app/core/languages.js";
import { DAY_MS } from "../app/core/leitner.js";

const NOW = Date.UTC(2026, 9, 12, 8, 0, 0);
const HEURE = 3600 * 1000;

test("P1 : la ponctuation arabe et le tatweel ne font plus rater des mots bien prononcés", () => {
  assert.equal(scorePrononciation("شنوة حوالك؟ لاباس، الحمد لله", "شنوة حوالك لاباس الحمد لله", "tunisien").score, 100);
  assert.equal(scorePrononciation("مرحبا؛ كيفاش", "مرحبا كيفاش", "tunisien").score, 100);
  assert.equal(scorePrononciation("مرحـــبا", "مرحبا", "arabe").score, 100);
  assert.equal(scorePrononciation("『すし』が好き〜", "すしが好き", "japonais").score, 100);
});

test("P2 : pas de « Répète après moi » en arabizi (reconnaissance en écriture arabe), maintenu ailleurs", () => {
  assert.equal(langConfig("tunisien", "arabizi").repetition, false);
  assert.equal(langConfig("tunisien", "arabe").repetition, true);
  assert.notEqual(langConfig("catalan").repetition, false);
});

test("P3 : la moyenne de prononciation ne dérive plus par arrondis cumulés", () => {
  let e = { id: "s", date: NOW };
  e = integreScore(e, 100);
  for (let i = 0; i < 9; i++) e = integreScore(e, 99);
  assert.equal(e.prononciation.somme, 991);
  assert.equal(e.prononciation.moyenne, 99);
  assert.equal(moyennePrononciation([e]), 99);
  // Entrée antérieure (sans somme) : reprise depuis sa moyenne.
  const ancienne = { id: "a", date: NOW, prononciation: { n: 2, moyenne: 80, meilleur: 90 } };
  assert.deepEqual(integreScore(ancienne, 50).prononciation, { n: 3, somme: 210, moyenne: 70, meilleur: 90 });
});

test("P4 : reconnaissance muette (null / undefined) → score 0, pas d'exception", () => {
  for (const v of [null, undefined]) {
    const r = scorePrononciation("Bon dia", v, "catalan");
    assert.equal(r.score, 0);
    assert.equal(r.entendu, "");
  }
});

test("E1 : les erreurs dues ne reviennent plus à chaque séance, les suivantes passent", () => {
  let carnet = [];
  for (let i = 0; i < 5; i++) carnet = ajouteErreur(carnet, "catalan", { original: `f${i}`, corrected: `c${i}` }, NOW - (5 - i) * HEURE);
  const seances = [];
  let t = NOW;
  for (let k = 0; k < 2; k++) {
    const choisies = erreursAReactiver(carnet, "catalan", t);
    seances.push(choisies.map(e => e.corrected).join(","));
    carnet = marqueReactivees(carnet, choisies, t);
    t += HEURE;
  }
  assert.equal(seances[0], "c4,c3,c2");
  assert.equal(seances[1], "c1,c0", "une heure après : les deux autres, pas les trois mêmes");
  assert.equal(erreursAReactiver(carnet, "catalan", NOW + DAY_MS + 2 * HEURE).length, 3, "le délai passé, elles reviennent");
});

test("E2 : correction non textuelle ou carnet nul en stockage → pas d'exception", () => {
  const r = ajouteErreur(null, "catalan", { original: 12, corrected: 13, explanation: null }, NOW);
  assert.equal(r.length, 1);
  assert.equal(r[0].original, "12");
  assert.equal(marqueReactivees(null, [{ id: 1 }], NOW), null);
  assert.deepEqual(erreursAReactiver(null, "catalan", NOW), []);
});

test("E3 : dédoublonnage insensible à la ponctuation (conversation puis résumé)", () => {
  const un = ajouteErreur([], "catalan", { original: "bon dies", corrected: "Bon dia!" }, NOW);
  assert.equal(ajouteErreur(un, "catalan", { original: "bon dies", corrected: "bon dia" }, NOW + 1), un);
  assert.equal(ajouteErreur([], "catalan", { original: "Bon dia", corrected: "Bon dia !" }, NOW).length, 0, "une correction de ponctuation seule n'est pas une erreur orale");
});

test("O1 : debutSemaine juste dans les fuseaux sans minuit au changement d'heure", () => {
  const ici = fileURLToPath(new URL(".", import.meta.url));
  const code = `
    import { bilanHebdo, debutSemaine } from "../app/core/objectif.js";
    const lundi0030 = new Date(2026, 7, 31, 0, 30).getTime();   // lundi 31 août 2026, 00:30
    const dimanche = new Date(2026, 8, 6, 12, 0).getTime();     // dimanche 6 septembre, après le passage du 6/09 à 0 h
    const d = new Date(debutSemaine(dimanche));
    const b = bilanHebdo([{ date: lundi0030, turns: 3 }], 4, dimanche);
    console.log(JSON.stringify({ h: d.getHours(), j: d.getDate(), lundi: b.jours[0] }));`;
  for (const tz of ["America/Santiago", "Europe/Paris", "Pacific/Auckland"]) {
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], { cwd: ici, env: { ...process.env, TZ: tz }, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), { h: 0, j: 31, lundi: true }, tz);
  }
});

test("O2 : une séance ouverte puis quittée sans parler ne compte pas comme un jour pratiqué", () => {
  const lundi = new Date(2026, 9, 12, 10, 0).getTime();
  assert.equal(bilanHebdo([{ date: lundi, turns: 1 }], 4, lundi).pratiques, 0);
  assert.equal(bilanHebdo([{ date: lundi, turns: 2 }], 4, lundi).pratiques, 1);
  assert.equal(bilanHebdo([{ date: lundi }], 4, lundi).pratiques, 1, "entrée sans compteur : comptée");
});

test("R1 : la tendance du niveau ne mélange pas les langues", () => {
  const h = [
    { date: 1, lang: "catalan", niveauObserve: "A2" },
    { date: 2, lang: "catalan", niveauObserve: "B2" },
    { date: 3, lang: "japonais", niveauObserve: "A1" },
  ];
  assert.equal(tendanceNiveau(h, "derniere"), null, "une seule observation en japonais");
  h.push({ date: 4, lang: "japonais", niveauObserve: "A2" });
  assert.deepEqual(tendanceNiveau(h, "derniere"), { de: "A1", a: "A2", n: 2, sens: 1 });
  assert.equal(tendanceNiveau(h, "catalan").sens, 1);
});

test("R2 : le bilan tronqué ne coupe pas un emoji en deux", () => {
  const texte = "a".repeat(TEXTE_MAX - 2) + "😊😊😊";
  const t = entreeResume({ texte, points_forts: [], conseil: "", phrases_a_reviser: [], erreurs: [], vocabulaire: [] }).texte;
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(t), "aucune moitié haute isolée");
  assert.ok(t.endsWith("…"));
});

test("R4 : carnet de vocabulaire nul en stockage → pas d'exception", () => {
  const resume = { erreurs: [], vocabulaire: [{ term: "hola", translation: "bonjour", reading: null }] };
  const r = integreResume(null, [], resume, "catalan", NOW);
  assert.equal(r.deck.length, 1);
});

test("M1/M2 : missions dédoublonnées ; le prompt borne les numéros au nombre annoncé", () => {
  assert.deepEqual(missionsValides(["Saluer", "saluer", " Saluer ", "Commander"]), ["Saluer", "Commander"]);
  assert.match(blocMissionsPrompt("debutant", ["Saluer", "Commander"]), /numéros \(1 à 2\)/);
  assert.match(blocMissionsPrompt("debutant", []), /numéros \(1 à 3\)/);
});

test("E3 bis : l'explication (#97) retrouve son entrée du carnet malgré une ponctuation différente", async () => {
  const { consigneExplication } = await import("../app/core/explique.js");
  const carnet = ajouteErreur([], "catalan", { original: "bon dies", corrected: "Bon dia!" }, NOW);
  const next = consigneExplication(carnet, "catalan", { original: "bon dies", corrected: "bon dia" }, { content: "c" }, "debutant", NOW);
  assert.equal(next.length, 1);
  assert.equal(next[0].explique.content, "c");
});
