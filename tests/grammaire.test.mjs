// Tests du programme de grammaire par langue (#112).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PROGRAMME_GRAMMAIRE, SUJETS_GENERIQUES, avancementGrammaire, marqueEtudie, programmeGrammaire, sujetsEtudies,
} from "../app/core/grammaire.js";
import { LANGUAGES } from "../app/core/languages.js";

const NIVEAUX = ["debutant", "intermediaire", "avance"];

test("programme : chaque langue du registre a 6 points par niveau, sans doublon dans la langue", () => {
  assert.deepEqual(Object.keys(PROGRAMME_GRAMMAIRE).sort(), Object.keys(LANGUAGES).sort());
  for (const [lang, prog] of Object.entries(PROGRAMME_GRAMMAIRE)) {
    const tous = [];
    for (const n of NIVEAUX) {
      assert.equal(prog[n].length, 6, `${lang}/${n}`);
      for (const p of prog[n]) assert.ok(typeof p === "string" && p.trim() === p && p.length >= 5 && p.length <= 80, `${lang} « ${p} »`);
      tous.push(...prog[n]);
    }
    assert.equal(new Set(tous).size, tous.length, `${lang} : doublon`);
  }
});

test("programme : propre à la langue (pas d'articles en japonais, ser/estar en espagnol, cas en allemand)", () => {
  const txt = (l) => NIVEAUX.flatMap(n => PROGRAMME_GRAMMAIRE[l][n]).join(" | ");
  assert.doesNotMatch(txt("japonais"), /article/i);
  assert.match(txt("japonais"), /particules/);
  assert.match(txt("espagnol"), /Ser et estar/);
  assert.match(txt("espagnol"), /Por et para/);
  assert.match(txt("allemand"), /accusatif/i);
  assert.match(txt("arabe"), /racine trilitère/);
  assert.match(txt("tunisien"), /ma… ch/);
  assert.match(txt("catalan"), /pronoms faibles/);
});

test("programmeGrammaire : repli générique pour une langue ou un niveau inconnus", () => {
  assert.equal(programmeGrammaire("espagnol", "debutant")[0], "Ser et estar");
  assert.equal(programmeGrammaire("klingon", "debutant"), SUJETS_GENERIQUES);
  assert.equal(programmeGrammaire("espagnol", "expert"), SUJETS_GENERIQUES);
});

test("marqueEtudie : par langue, sans doublon, identité si rien ne change, entrées douteuses tolérées", () => {
  const sujet = PROGRAMME_GRAMMAIRE.espagnol.debutant[0];
  const a = marqueEtudie({}, "espagnol", sujet);
  assert.deepEqual(a, { espagnol: [sujet] });
  assert.equal(marqueEtudie(a, "espagnol", sujet), a, "déjà étudié : même objet");
  assert.equal(marqueEtudie(a, "espagnol", "  "), a);
  assert.equal(marqueEtudie(a, "", sujet), a);
  assert.deepEqual(marqueEtudie(null, "catalan", " Ser et estar "), { catalan: ["Ser et estar"] });
  assert.deepEqual(marqueEtudie([], "catalan", "X y"), { catalan: ["X y"] });
  assert.deepEqual(marqueEtudie({ catalan: "corrompu" }, "catalan", "X y"), { catalan: ["X y"] });
  assert.equal(sujetsEtudies(a, "catalan").size, 0, "l'espagnol ne compte pas pour le catalan");
  assert.equal(sujetsEtudies(null, "catalan").size, 0);
});

test("avancementGrammaire : seuls les points du programme du niveau comptent", () => {
  const prog = PROGRAMME_GRAMMAIRE.allemand.intermediaire;
  let e = {};
  e = marqueEtudie(e, "allemand", prog[0]);
  e = marqueEtudie(e, "allemand", prog[3]);
  e = marqueEtudie(e, "allemand", "Un sujet libre");
  e = marqueEtudie(e, "allemand", PROGRAMME_GRAMMAIRE.allemand.debutant[0]);
  assert.deepEqual(avancementGrammaire("allemand", "intermediaire", e), { faits: 2, total: 6 });
  assert.deepEqual(avancementGrammaire("allemand", "debutant", e), { faits: 1, total: 6 });
  assert.deepEqual(avancementGrammaire("japonais", "debutant", e), { faits: 0, total: 6 });
});
