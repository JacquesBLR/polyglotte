// Discutables de la relecture du soir du 12/10 (#110) traités comme des défauts.
import { test } from "node:test";
import assert from "node:assert/strict";

import { creeChrono, ligneConsole, mesure, messageLenteur, statsLatence } from "../app/core/latence.js";
import { buildAssessmentPrompt, introEvaluation } from "../app/core/prompts.js";
import { langConfig } from "../app/core/languages.js";

const horloge = (...t) => { let i = 0; return () => t[Math.min(i++, t.length - 1)]; };

test("D2 : le principe du test est dit par l'app, en français, pour toutes les langues", () => {
  for (const id of ["japonais", "arabe", "tunisien", "catalan"]) {
    const cfg = langConfig(id);
    const intro = introEvaluation(cfg);
    assert.match(intro, /Test de niveau/);
    assert.ok(intro.includes(cfg.tutor.name) && intro.includes(cfg.langFr));
    assert.match(intro, /CECRL/);
  }
});

test("D2 : la consigne ne demande plus au modèle une phrase française dans reply", () => {
  const p = buildAssessmentPrompt({ cfg: langConfig("japonais") });
  assert.doesNotMatch(p, /explique le principe en UNE phrase en français/);
  assert.match(p, /pose directement ta première question/);
});

test("D3 : un tour relancé est chronométré sur les deux appels et marqué", () => {
  // Départ 0, premier appel fini à 9 s, relance finie à 17 s : la sonde lit fin() après.
  const c = creeChrono(horloge(0, 17000));
  const m = mesure("tour", c.fin(), { relance: true, at: 0 });
  assert.equal(m.total, 17000);
  assert.equal(m.relance, true);
  assert.match(ligneConsole(m), /\(relancé\)/);
  assert.equal(mesure("tour", { premierJeton: 1, total: 2 }, { at: 0 }).relance, undefined, "absent hors relance");
  assert.equal(statsLatence([m, mesure("tour", { premierJeton: 1, total: 2 }, { at: 0 })], "tour").relances, 1);
  // 36 s cumulées sur deux appels : l'alerte part, alors que chacun pris seul (18 s) la ratait.
  assert.notEqual(messageLenteur(mesure("tour", { premierJeton: 36000, total: 36000 }, { relance: true })), "");
});
