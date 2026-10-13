// Diacritiques porteurs de sens dans la correction du texte à trous (#125, décision par défaut
// du 13/10) : « hatte » ne compte plus juste pour « hätte », ni « esta » pour « está ». Les
// tests rouges sur 2.0.0-beta.43 sont ceux qui attendent "diacritique".
import { test } from "node:test";
import assert from "node:assert/strict";

import { DIACRITIQUES, corrigeTrou, estJuste, scoreTrous, signeDistinctif } from "../app/core/trous.js";

const c = (langId, attendu, saisi) => corrigeTrou(attendu, saisi, { langId });

test("allemand : umlaut porteur de sens — tout le Konjunktiv II (relecture du 13/10)", () => {
  assert.equal(c("allemand", "hätte", "hatte"), "diacritique");
  assert.equal(c("allemand", "würde", "wurde"), "diacritique");
  assert.equal(c("allemand", "könnte", "konnte"), "diacritique");
  assert.equal(c("allemand", "wäre", "ware"), "diacritique");
  assert.equal(c("allemand", "hatte", "hätte"), "diacritique", "l'umlaut ajouté change aussi le mode");
  assert.equal(c("allemand", "für", "fur"), "diacritique");
  assert.equal(c("allemand", "hätte", "Hätte"), "juste");
});

test("allemand : graphies de substitution admises avec avertissement (ae, oe, ue, ss)", () => {
  assert.equal(c("allemand", "hätte", "haette"), "accent");
  assert.equal(c("allemand", "könnte", "koennte"), "accent");
  assert.equal(c("allemand", "Straße", "strasse"), "accent");
  assert.equal(c("allemand", "dass", "daß"), "accent");
  assert.equal(c("allemand", "hätte", "hatten"), "faux");
});

test("suisse allemand : mêmes umlauts, pas de ß", () => {
  assert.equal(c("suisse", "chönd", "chond"), "diacritique");
  assert.equal(c("suisse", "chönd", "choend"), "accent");
  assert.equal(c("suisse", "Strasse", "strasse"), "juste");
});

test("espagnol : ñ, accent diacritique, accent qui change le temps", () => {
  assert.equal(c("espagnol", "está", "esta"), "diacritique", "verbe ≠ démonstratif");
  assert.equal(c("espagnol", "esta", "está"), "diacritique");
  assert.equal(c("espagnol", "esté", "este"), "diacritique");
  assert.equal(c("espagnol", "estás", "estas"), "diacritique");
  assert.equal(c("espagnol", "año", "ano"), "diacritique");
  assert.equal(c("espagnol", "habló", "hablo"), "diacritique", "passé simple ≠ présent");
  assert.equal(c("espagnol", "comió", "comio"), "diacritique");
  assert.equal(c("espagnol", "hablé", "hable"), "diacritique", "passé simple ≠ subjonctif");
  assert.equal(c("espagnol", "hablará", "hablara"), "diacritique", "futur ≠ subjonctif imparfait");
  assert.equal(c("espagnol", "hablarán", "hablaran"), "diacritique");
  assert.equal(c("espagnol", "tendrá", "tendra"), "diacritique");
  assert.equal(c("espagnol", "tú", "tu"), "diacritique");
  assert.equal(c("espagnol", "qué", "que"), "diacritique");
  assert.equal(c("espagnol", "sé", "se"), "diacritique");
  assert.equal(c("espagnol", "es / está", "esta"), "diacritique");
  assert.equal(c("espagnol", "es / está", "es"), "juste");
});

test("espagnol : les autres accents restent tolérés, avec avertissement", () => {
  for (const [a, s] of [["difícil", "dificil"], ["también", "tambien"], ["después", "despues"], ["aquí", "aqui"],
    ["detrás", "detras"], ["música", "musica"], ["comí", "comi"], ["sofá", "sofa"], ["canción", "cancion"]]) {
    assert.equal(c("espagnol", a, s), "accent", `${a} / ${s}`);
  }
});

test("portugais : ã, õ, ç ; é/e, têm/tem, pôde/pode ; falámos/falamos", () => {
  for (const l of ["ptpt", "ptbr"]) {
    assert.equal(c(l, "têm", "tem"), "diacritique", "pluriel ≠ singulier");
    assert.equal(c(l, "é", "e"), "diacritique", "est ≠ et");
    assert.equal(c(l, "está", "esta"), "diacritique");
    assert.equal(c(l, "pôde", "pode"), "diacritique", "passé ≠ présent");
    assert.equal(c(l, "não", "nao"), "diacritique");
    assert.equal(c(l, "lição", "licao"), "diacritique");
    assert.equal(c(l, "faça", "faca"), "diacritique", "fasse ≠ couteau");
    assert.equal(c(l, "você", "voce"), "accent");
    assert.equal(c(l, "também", "tambem"), "accent");
  }
  assert.equal(c("ptpt", "falámos", "falamos"), "diacritique", "passé ≠ présent (portugais européen)");
});

test("catalan : accents diacritiques de 2016, ç, passé simple", () => {
  assert.equal(c("catalan", "és", "es"), "diacritique");
  assert.equal(c("catalan", "més", "mes"), "diacritique");
  assert.equal(c("catalan", "són", "son"), "diacritique");
  assert.equal(c("catalan", "té", "te"), "diacritique");
  assert.equal(c("catalan", "està", "esta"), "diacritique");
  assert.equal(c("catalan", "cantà", "canta"), "diacritique");
  assert.equal(c("catalan", "plaça", "placa"), "diacritique");
  assert.equal(c("catalan", "sóc", "soc"), "accent", "accent supprimé par la réforme de 2016");
  assert.equal(c("catalan", "també", "tambe"), "accent");
  assert.equal(c("catalan", "l'he vist", "l’he vist"), "juste");
});

test("langues sans liste ou sans langue : comportement inchangé", () => {
  assert.equal(c("arabe", "كتبتُ", "كتبت"), "accent", "voyellation tolérée");
  assert.equal(c("anglais", "café", "cafe"), "accent");
  assert.equal(corrigeTrou("está", "esta"), "accent", "sans langue, tous les accents sont tolérés");
  assert.equal(c("japonais", "が", "か"), "faux");
});

test("plusieurs mots : un seul signe porteur de sens suffit", () => {
  assert.equal(c("espagnol", "se lo dé", "se lo de"), "diacritique");
  assert.equal(c("espagnol", "ha llegado está", "ha llegado esta"), "diacritique");
  assert.equal(signeDistinctif("difícil está", "dificil está", "espagnol"), false);
});

test("score : « diacritique » compte faux, « accent » juste", () => {
  assert.deepEqual(scoreTrous(["juste", "accent", "diacritique", "faux"]), { justes: 2, total: 4 });
  assert.equal(estJuste("accent"), true);
  assert.equal(estJuste("diacritique"), false);
});

test("la liste documentée couvre les langues visées par la décision", () => {
  assert.ok(DIACRITIQUES.allemand.lettres.includes("ä"));
  assert.ok(DIACRITIQUES.espagnol.lettres.includes("ñ"));
  assert.ok(DIACRITIQUES.ptpt.lettres.includes("ã") && DIACRITIQUES.ptpt.lettres.includes("õ"));
  assert.ok(DIACRITIQUES.espagnol.mots.includes("está"));
});
