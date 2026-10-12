// Discutables de la relecture du 2026-10-12 (#107) retenus comme défauts, 5e passe : un test
// par défaut, rouge sur le code de 2.0.0-beta.33.
import { test } from "node:test";
import assert from "node:assert/strict";

import { callLocal, MSG_COUPURE, MSG_INJOIGNABLE } from "../app/core/api.js";
import { streamLocalChat } from "../app/core/stream.js";
import {
  ajouteMesure, enSecondes, lenteur, ligneConsole, mediane, mesure, mesureEchec, resumeEchecs, statsLatence, typeEchec,
} from "../app/core/latence.js";
import { controleEcriture, ecritureConforme, mesureEcriture } from "../app/core/ecriture.js";
import { erreursAMarquer } from "../app/core/erreurs.js";
import { LANGUAGES, langConfig } from "../app/core/languages.js";
import { buildTutorPrompt } from "../app/core/prompts.js";

const SETTINGS = { provider: "local", localUrl: "http://moteur.test/v1", localModel: "m" };
const SCHEMA = { type: "object", properties: { reply: { type: "string" } }, required: ["reply"] };
const avecFetch = async (faux, f) => {
  const avant = globalThis.fetch;
  globalThis.fetch = faux;
  try { return await f(); } finally { globalThis.fetch = avant; }
};

// --- (1) Appels en échec journalisés ---------------------------------------------------

test("échecs : un flux coupé en cours de réponse lève une erreur « coupure » en français", async () => {
  const enc = new TextEncoder();
  let n = 0;
  const err = await avecFetch(async () => ({
    ok: true, status: 200,
    body: { getReader: () => ({ read: async () => {
      if (n++ === 0) return { done: false, value: enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: '{"reply":"Ho' } }] })}\n\n`) };
      throw new TypeError("terminated");
    } }) },
  }), () => streamLocalChat(SETTINGS, { messages: [], system: "s", schema: SCHEMA }).then(() => null, e => e));
  assert.ok(err);
  assert.equal(err.coupure, true);
  assert.equal(err.message, MSG_COUPURE);
  assert.equal(typeEchec(err), "coupure");
});

test("échecs : serveur injoignable marqué « réseau » ; types reconnus", async () => {
  const err = await avecFetch(async () => { throw new TypeError("Failed to fetch"); },
    () => callLocal(SETTINGS, { messages: [], system: "s" }).then(() => null, e => e));
  assert.equal(err.message, MSG_INJOIGNABLE);
  assert.equal(typeEchec(err), "reseau");
  assert.equal(typeEchec(Object.assign(new Error("x"), { tronque: true })), "tronque");
  assert.equal(typeEchec(Object.assign(new Error("Erreur du serveur (502)."), { status: 502 })), "serveur");
  assert.equal(typeEchec(new Error("Erreur API (529)")), "serveur");
  assert.equal(typeEchec(new Error("Le modèle a produit un JSON invalide — réessaie.")), "json");
  assert.equal(typeEchec(new Error("Réponse vide du modèle.")), "vide");
  assert.equal(typeEchec(new TypeError("Failed to fetch")), "reseau", "fetch Claude sans réseau");
  assert.equal(typeEchec(null), "autre");
});

test("échecs : journalisés avec leur durée, comptés à part, taux affiché ; les temps ne portent que sur les succès", () => {
  let j = [];
  for (const t of [10000, 12000]) j = ajouteMesure(j, mesure("tour", { premierJeton: 1000, total: t }, { stream: true }));
  const coupe = mesureEchec("tour", { premierJeton: 900, total: 2000 }, Object.assign(new Error("c"), { coupure: true }), { stream: true });
  assert.equal(coupe.echec, "coupure");
  assert.equal(coupe.total, 2000, "durée jusqu'à l'échec");
  j = ajouteMesure(j, coupe);
  j = ajouteMesure(j, mesureEchec("tour", { premierJeton: 35000, total: 35000 }, Object.assign(new Error("t"), { tronque: true })));
  assert.equal(j.length, 4, "les échecs entrent au journal");
  const s = statsLatence(j, "tour");
  assert.equal(s.appels, 4);
  assert.equal(s.n, 2);
  assert.equal(s.echecs, 2);
  assert.equal(s.tauxEchec, 0.5);
  assert.deepEqual(s.echecsParType, { coupure: 1, tronque: 1 });
  assert.equal(s.total, 11000, "la coupure à 2 s ne fait pas passer le serveur pour rapide");
  assert.equal(s.lents, 0, "un échec à 35 s n'est pas compté « lent » : il est compté en échec");
  assert.equal(lenteur(coupe), null);
  assert.match(resumeEchecs(s), /^2 échecs sur 4 \(50 %\) : /);
  assert.match(resumeEchecs(s), /connexion coupée/);
  assert.equal(resumeEchecs(statsLatence(j.slice(0, 2), "tour")), "");
  assert.match(ligneConsole(coupe), /ÉCHEC coupure après 2000 ms/);
  const toutEchoue = statsLatence([coupe], "tour");
  assert.equal(toutEchoue.n, 0);
  assert.equal(toutEchoue.total, null);
});

// --- Médiane et arrondi -----------------------------------------------------------------

test("médiane vraie sur un nombre pair (le rang le plus proche prenait la valeur basse)", () => {
  assert.equal(mediane([1000, 9000]), 5000);
  assert.equal(mediane([5, 1, 3]), 3);
  assert.equal(mediane([]), null);
  let j = [];
  for (const t of [10000, 30000]) j = ajouteMesure(j, mesure("resume", { premierJeton: t, total: t }));
  assert.equal(statsLatence(j, "resume").total, 20000);
});

test("alerte cohérente avec l'affichage : 59,95 s s'affiche « 60 s » et alerte au seuil de 60 s", () => {
  const m = mesure("resume", { premierJeton: 59950, total: 59950 });
  assert.equal(enSecondes(59950), "60 s");
  assert.equal(lenteur(m), "total");
  assert.equal(lenteur(mesure("resume", { premierJeton: 59940, total: 59940 })), null);
});

// --- E4 ---------------------------------------------------------------------------------

test("E4 : erreurs injectées marquées au premier tour réussi, même après un [START] en échec, une seule fois", () => {
  const erreurs = [{ id: "e1" }];
  const s = { mode: "chat", ctx: { erreurs } };
  assert.deepEqual(erreursAMarquer(s), erreurs, "premier tour réussi, quel qu'il soit");
  s.erreursMarquees = true;
  assert.deepEqual(erreursAMarquer(s), [], "une seule fois par séance");
  assert.deepEqual(erreursAMarquer({ mode: "eval", ctx: { erreurs } }), []);
  assert.deepEqual(erreursAMarquer(null), []);
});

// --- (2) Écriture de la réplique --------------------------------------------------------

// Réplique réelle du 2026-10-12 via gw (tunisien en écriture arabe, [START], débutant).
const ARABIZI = "3aslema! Ena Selma, mta3 Tunis. Chnowa ismek?";
const ARABE = "عالسلامة! أنا سلمى من تونس. شنوة اسمك؟";

test("écriture : chaque langue déclare son écriture ; le tunisien suit l'écriture choisie", () => {
  for (const [id, l] of Object.entries(LANGUAGES)) assert.ok(["latin", "arabe", "japonais"].includes(l.ecriture), id);
  assert.equal(langConfig("tunisien", "arabe").ecriture, "arabe");
  assert.equal(langConfig("tunisien", "arabizi").ecriture, "latin");
});

test("écriture : arabizi refusé en écriture arabe ; un nom latin isolé, un texte trop court tolérés", () => {
  assert.equal(ecritureConforme(ARABIZI, "arabe"), false);
  assert.equal(ecritureConforme(ARABE, "arabe"), true);
  assert.equal(ecritureConforme(ARABIZI, "latin"), true);
  assert.equal(ecritureConforme(ARABE, "latin"), false);
  assert.equal(ecritureConforme("عالسلامة ياخي، تحب قهوة direct ولا كابوسان؟", "arabe"), true, "un mot latin dans l'arabe");
  assert.equal(ecritureConforme("OK!", "arabe"), true, "trop court pour juger");
  assert.equal(ecritureConforme("こんにちは！お名前は何ですか？", "japonais"), true);
  assert.equal(ecritureConforme("Konnichiwa! Onamae wa nan desu ka?", "japonais"), false);
  assert.equal(ecritureConforme("Bon dia! Com estàs?", undefined), true, "écriture inconnue : pas de verdict");
  assert.equal(mesureEcriture(ARABIZI, "arabe").part, 0);
});

test("écriture : relance UNE fois, retient la réponse conforme ; garde l'originale si la relance échoue", async () => {
  const historique = [{ role: "user", content: "[START]" }];
  let appels = 0;
  let vu = null;
  const ok = await controleEcriture({
    data: { reply: ARABIZI }, ecriture: "arabe", historique,
    relance: async (messages) => { appels++; vu = messages; return JSON.stringify({ reply: ARABE }); },
  });
  assert.equal(appels, 1);
  assert.equal(ok.relance, true);
  assert.equal(ok.conforme, true);
  assert.equal(ok.data.reply, ARABE);
  assert.equal(vu.length, 3);
  assert.equal(vu[1].content, ARABIZI, "le modèle voit sa réplique fautive");
  assert.match(vu[2].content, /écriture arabe/);
  assert.equal(historique.length, 1, "l'historique de la séance n'est pas modifié");

  appels = 0;
  const encore = await controleEcriture({
    data: { reply: ARABIZI }, ecriture: "arabe", historique,
    relance: async () => { appels++; return JSON.stringify({ reply: ARABIZI }); },
  });
  assert.equal(appels, 1, "pas de seconde relance");
  assert.equal(encore.conforme, false);
  assert.equal(encore.data.reply, ARABIZI);

  const panne = await controleEcriture({
    data: { reply: ARABIZI }, ecriture: "arabe", historique,
    relance: async () => { throw new Error("Serveur injoignable"); },
  });
  assert.equal(panne.data.reply, ARABIZI, "une relance en échec ne fait pas échouer le tour");

  appels = 0;
  const conforme = await controleEcriture({ data: { reply: ARABE }, ecriture: "arabe", historique, relance: async () => { appels++; return "{}"; } });
  assert.equal(appels, 0, "réplique conforme : aucun appel");
  assert.equal(conforme.relance, false);
});

test("écriture : en écriture arabe, le prompt ne montre plus les graphies arabizi et impose l'écriture à reply", () => {
  const p = (e) => buildTutorPrompt({ cfg: langConfig("tunisien", e), level: "debutant", scenarioId: "libre", immersion: false, mode: "chat" });
  assert.ok(!p("arabe").includes("9addech"), "graphies arabizi absentes en écriture arabe");
  assert.ok(p("arabizi").includes("9addech"), "présentes en arabizi");
  assert.match(p("arabe"), /"reply" : ta réplique EN TUNISIEN \(DERJA\) uniquement, écrite dans l'écriture arabe/);
  assert.match(p("arabe"), /jamais en arabizi/);
  assert.match(buildTutorPrompt({ cfg: langConfig("japonais"), level: "debutant", scenarioId: "libre", immersion: false, mode: "eval" }),
    /écrite dans l'écriture japonaise/);
});
