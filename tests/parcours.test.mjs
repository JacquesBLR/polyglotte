// Tests du parcours guidé (#111).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CECRL_PAR_NIVEAU, PROGRAMME, avancement, blocLecon, leconParId, leconsDuNiveau, leconsValidees, niveauApp, numero, prochaineLecon,
} from "../app/core/parcours.js";
import { NB_MISSIONS, blocMissionsPrompt, missionsValides } from "../app/core/mission.js";
import { buildTutorPrompt } from "../app/core/prompts.js";
import { LANGUAGES, langConfig } from "../app/core/languages.js";
import { schemaTour } from "../app/core/schemas.js";

test("programme : 6 leçons par niveau CECRL, identifiants uniques, champs remplis", () => {
  const ids = new Set(PROGRAMME.map(u => u.id));
  assert.equal(ids.size, PROGRAMME.length);
  for (const c of ["A1", "A2", "B1", "B2", "C1"]) assert.equal(PROGRAMME.filter(u => u.cecrl === c).length, 6, c);
  for (const u of PROGRAMME) {
    for (const k of ["titre", "grammaire", "lexique", "situation"]) assert.ok(u[k] && u[k].trim(), `${u.id}.${k}`);
    assert.ok(u.id.startsWith(u.cecrl.toLowerCase() + "-"), u.id);
  }
});

test("programme : les objectifs ont la forme des missions (#91) et passent missionsValides intacts", () => {
  for (const u of PROGRAMME) {
    assert.equal(u.missions.length, NB_MISSIONS, u.id);
    assert.deepEqual(missionsValides(u.missions), u.missions, `${u.id} : rien de filtré ni tronqué`);
    for (const m of u.missions) {
      const mots = m.split(/\s+/).length;
      assert.ok(mots >= 3 && mots <= 8, `${u.id} « ${m} » : ${mots} mots`);
      assert.match(m, /^[A-ZÉ]/, `${u.id} « ${m} » : infinitif en majuscule`);
    }
  }
});

test("niveaux : chaque leçon appartient à exactement un niveau de l'app", () => {
  assert.equal(niveauApp("A1"), "debutant");
  assert.equal(niveauApp("B2"), "intermediaire");
  assert.equal(niveauApp("C1"), "avance");
  assert.equal(niveauApp("C2"), null);
  const total = Object.keys(CECRL_PAR_NIVEAU).reduce((n, l) => n + leconsDuNiveau(l).length, 0);
  assert.equal(total, PROGRAMME.length);
  assert.equal(leconsDuNiveau("debutant").length, 12);
  assert.equal(leconsDuNiveau("avance").length, 6);
  assert.deepEqual(leconsDuNiveau("inconnu"), []);
});

test("leconsValidees : missions toutes cochées, dans la langue demandée seulement", () => {
  const h = [
    { lang: "catalan", lecon: "a1-cafe", missions: { total: 3, atteintes: 3 } },
    { lang: "catalan", lecon: "a1-famille", missions: { total: 3, atteintes: 2 } }, // incomplète
    { lang: "japonais", lecon: "a1-presentations", missions: { total: 3, atteintes: 3 } }, // autre langue
    { lang: "catalan", lecon: "inexistante", missions: { total: 3, atteintes: 3 } },
    { lang: "catalan", scenario: "cafe", missions: { total: 3, atteintes: 3 } }, // séance libre
    { lang: "catalan", lecon: "a1-ville", missions: { total: 0, atteintes: 0 } },
    null,
  ];
  assert.deepEqual([...leconsValidees(h, "catalan")], ["a1-cafe"]);
  assert.deepEqual([...leconsValidees(h, "japonais")], ["a1-presentations"]);
  assert.equal(leconsValidees(null, "catalan").size, 0);
});

test("prochaineLecon et avancement : première non validée du niveau, dans l'ordre", () => {
  assert.equal(prochaineLecon("debutant", new Set()).id, "a1-presentations");
  assert.equal(prochaineLecon("debutant", new Set(["a1-presentations", "a1-cafe"])).id, "a1-famille");
  const toutes = new Set(leconsDuNiveau("avance").map(u => u.id));
  assert.equal(prochaineLecon("avance", toutes), null);
  assert.deepEqual(avancement("debutant", new Set(["a1-cafe", "b1-opinion"])), { faites: 1, total: 12 });
});

test("numero : rang dans le niveau CECRL", () => {
  assert.equal(numero(leconParId("a1-presentations")), "A1·1");
  assert.equal(numero(leconParId("a2-projets")), "A2·6");
  assert.equal(leconParId("nope"), null);
});

test("prompt : la leçon remplace le scénario, ancre la ville et fixe les missions", () => {
  const cfg = langConfig("espagnol");
  const lecon = leconParId("a1-cafe");
  const p = buildTutorPrompt({
    cfg, level: niveauApp(lecon.cecrl), scenarioId: "lecon", immersion: false, mode: "chat",
    lecon, missions: lecon.missions,
  });
  assert.match(p, /LEÇON DU PARCOURS « Commander à boire et à manger » \(niveau A1/);
  assert.ok(p.includes("Séville"), "situation ancrée dans la ville du tuteur");
  assert.ok(!p.includes("{ville}"));
  assert.ok(p.includes(blocMissionsPrompt("debutant", lecon.missions, false, "espagnol")), "missions déjà fixées, à cocher");
  assert.match(p, /missions_accomplies/);
  // Le schéma du tour n'a plus à demander de missions (elles sont fixées).
  const sch = schemaTour({ lecture: false, nbMissions: lecon.missions.length });
  assert.ok(!("missions" in sch.properties) && "missions_accomplies" in sch.properties);
});

test("blocLecon : aucune trace de {ville} pour aucune langue ni aucune leçon", () => {
  for (const id of Object.keys(LANGUAGES)) {
    const cfg = langConfig(id);
    for (const u of PROGRAMME) {
      const b = blocLecon(u, cfg);
      assert.ok(!b.includes("{ville}"), `${id}/${u.id}`);
      assert.ok(b.includes(cfg.langFr));
    }
  }
});

// ---------- Bilan de fin de niveau (#114) ----------
import { NIVEAUX_CECRL, bilanNiveau, niveauxValides, prochainBilan } from "../app/core/parcours.js";

const aleaFixe = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test("bilanNiveau : trois missions de trois leçons distinctes du niveau, dans l'ordre du programme (clôture à part)", () => {
  for (const c of NIVEAUX_CECRL) {
    for (let k = 0; k < 50; k++) {
      const b = bilanNiveau(c);
      assert.equal(b.id, `bilan-${c.toLowerCase()}`);
      assert.equal(b.bilan, true);
      assert.equal(b.missions.length, 3);
      assert.equal(new Set(b.sources).size, 3, "trois leçons distinctes");
      b.sources.forEach((id, i) => {
        const u = leconParId(id);
        assert.equal(u.cecrl, c);
        assert.ok(u.missions.includes(b.missions[i]), "mission issue de sa leçon source");
      });
      // Ordre du programme, mission de clôture mise à part (placée en dernier).
      const rangs = b.sources.filter((_, i) => !/congé|conclure/i.test(b.missions[i])).map(id => PROGRAMME.findIndex(u => u.id === id));
      assert.deepEqual(rangs, [...rangs].sort((x, y) => x - y));
      assert.deepEqual(missionsValides(b.missions), b.missions);
    }
  }
  assert.equal(bilanNiveau("C2"), null);
});

test("bilanNiveau : aléa injectable, déterministe et borné (NaN, 1, négatif)", () => {
  assert.deepEqual(bilanNiveau("A1", aleaFixe(0.1, 0.5)), bilanNiveau("A1", aleaFixe(0.1, 0.5)));
  for (const r of [NaN, 1, -5, 7]) {
    const b = bilanNiveau("B2", () => r);
    assert.equal(new Set(b.sources).size, 3);
    assert.ok(b.missions.every(Boolean));
  }
  const vus = new Set();
  for (let k = 0; k < 300; k++) vus.add(bilanNiveau("A2").sources.join());
  assert.ok(vus.size > 5, "le tirage varie d'une séance à l'autre");
});

test("bilan : prompt ancré, numéro, niveau de l'app, schéma sans missions à inventer", () => {
  const b = bilanNiveau("B1", aleaFixe(0));
  const cfg = langConfig("allemand");
  assert.equal(numero(b), "B1");
  assert.equal(niveauApp(b.cecrl), "intermediaire");
  const p = buildTutorPrompt({ cfg, level: "intermediaire", scenarioId: "lecon", immersion: false, mode: "chat", lecon: b, missions: b.missions });
  assert.match(p, /LEÇON DU PARCOURS « Bilan B1 »/);
  assert.match(p, /BILAN du niveau B1 à Berlin/);
  assert.ok(!p.includes("{ville}"));
  for (const id of b.sources) assert.ok(p.includes(leconParId(id).titre));
});

test("niveauxValides : bilan aux missions toutes cochées, par langue", () => {
  const h = [
    { lang: "catalan", lecon: "bilan-a1", missions: { total: 3, atteintes: 3 } },
    { lang: "catalan", lecon: "bilan-a2", missions: { total: 3, atteintes: 1 } },
    { lang: "espagnol", lecon: "bilan-b1", missions: { total: 3, atteintes: 3 } },
    { lang: "catalan", lecon: "bilan-c2", missions: { total: 3, atteintes: 3 } },
    { lang: "catalan", lecon: "a1-cafe", missions: { total: 3, atteintes: 3 } },
  ];
  assert.deepEqual([...niveauxValides(h, "catalan")], ["A1"]);
  assert.deepEqual([...niveauxValides(h, "espagnol")], ["B1"]);
  assert.equal(niveauxValides(undefined, "catalan").size, 0);
  // Un bilan n'est pas une leçon : il ne compte pas dans l'avancement des leçons.
  assert.equal(leconsValidees(h, "catalan").has("bilan-a1"), false);
});

test("prochainBilan : proposé quand les six leçons d'un niveau CECRL sont validées et le niveau pas encore", () => {
  const a1 = new Set(PROGRAMME.filter(u => u.cecrl === "A1").map(u => u.id));
  assert.equal(prochainBilan("debutant", new Set(), new Set()), null);
  assert.equal(prochainBilan("debutant", a1, new Set()), "A1");
  assert.equal(prochainBilan("debutant", a1, new Set(["A1"])), null);
  assert.equal(prochainBilan("intermediaire", a1, new Set()), null);
  const tout = new Set(PROGRAMME.map(u => u.id));
  assert.equal(prochainBilan("debutant", tout, new Set(["A1"])), "A2");
  assert.equal(prochainBilan("inconnu", tout, new Set()), null);
});

// ---------- Préparer une leçon (#116) ----------
import { NB_PHRASES_CLES, demandePhrasesCles, phrasesClesValides, schemaPhrasesCles } from "../app/core/parcours.js";

test("phrases clés : consigne ancrée dans la leçon, schéma selon l'écriture", () => {
  const u = leconParId("a1-cafe");
  const d = demandePhrasesCles(u, langConfig("japonais"));
  assert.ok(d.includes("Commander à boire et à manger") && d.includes("Tokyo") && !d.includes("{ville}"));
  for (const m of u.missions) assert.ok(d.includes(m));
  assert.match(d, /que l'élève pourra dire LUI-MÊME/);
  assert.ok("reading" in schemaPhrasesCles({ lecture: true }).properties.phrases.items.properties);
  const latin = schemaPhrasesCles({ lecture: false }).properties.phrases.items;
  assert.ok(!("reading" in latin.properties));
  assert.deepEqual(latin.required, Object.keys(latin.properties));
});

test("phrasesClesValides : nettoyage, doublons, mission bornée, au plus 5", () => {
  const ph = (phrase, mission = 1) => ({ phrase, traduction: "t", usage: "u", mission });
  const v = phrasesClesValides({ phrases: [ph(" Un cafè, si us plau. "), ph("un cafè, si us plau."), ph("", 2), ph("La carta?", 7), ph("Quant és?", 0), null] });
  assert.equal(v.length, 3);
  assert.equal(v[0].phrase, "Un cafè, si us plau.");
  assert.equal(v[1].mission, null, "mission 7 hors bornes");
  assert.equal(v[2].mission, null);
  assert.equal(v[0].reading, null);
  assert.equal(phrasesClesValides({ phrases: [] }), null);
  assert.equal(phrasesClesValides(null), null);
  assert.equal(phrasesClesValides({ phrases: Array.from({ length: 8 }, (_, i) => ph(`P${i}`)) }).length, NB_PHRASES_CLES);
});

test("prompt : les phrases préparées sont transmises au tuteur, rien sinon", () => {
  const u = leconParId("a1-cafe");
  const cfg = langConfig("catalan");
  const ctx = { cfg, level: "debutant", scenarioId: "lecon", immersion: false, mode: "chat", missions: u.missions };
  const sans = buildTutorPrompt({ ...ctx, lecon: u });
  assert.doesNotMatch(sans, /a préparé ces phrases/);
  const avec = buildTutorPrompt({ ...ctx, lecon: { ...u, phrasesCles: [{ phrase: "Un cafè amb llet, si us plau." }, null, { phrase: "" }] } });
  assert.match(avec, /L'élève a préparé ces phrases avant la séance : « Un cafè amb llet, si us plau. »\./);
});

test("numero : une leçon recopiée avec ses phrases clés garde son numéro (vu en e2e : « A1·0 »)", () => {
  const u = leconParId("a1-presentations");
  assert.equal(numero({ ...u, phrasesCles: [{ phrase: "x" }] }), "A1·1");
});

test("libelleSeance : leçon, bilan, scénario", async () => {
  const { libelleSeance } = await import("../app/core/parcours.js");
  assert.equal(libelleSeance({ lecon: "a1-cafe", scenario: "lecon" }), "📚 A1·3 Commander à boire et à manger");
  assert.equal(libelleSeance({ lecon: "bilan-b2", scenario: "lecon" }), "🏅 Bilan B2");
  assert.equal(libelleSeance({ scenario: "cafe" }), "cafe");
  assert.equal(libelleSeance(null), "libre");
});

test("bilanNiveau : une mission de clôture (prendre congé) passe en dernier (relecture du soir)", () => {
  for (let k = 0; k < 300; k++) {
    const b = bilanNiveau("A1");
    const i = b.missions.findIndex(m => /congé|conclure/i.test(m));
    if (i >= 0) assert.equal(i, b.missions.length - 1, b.missions.join(" | "));
  }
  assert.equal(bilanNiveau("A1", () => 0.9999999).missions[2], "Prendre congé poliment");
});
