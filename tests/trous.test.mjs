// Tests du texte à trous (#115).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  NB_PHRASES, TROU, corrigeTrou, demandeTrous, normalise, phraseComplete, schemaTrous, scoreTrous, trousValides,
} from "../app/core/trous.js";
import { langConfig } from "../app/core/languages.js";

const p = (phrase, reponse, extra = {}) => ({ phrase, reponse, indice: "être", traduction: "t", ...extra });

test("schemaTrous : champs requis, reading seulement si translittération", () => {
  const items = schemaTrous({ lecture: false }).properties.phrases.items;
  assert.deepEqual(items.required, ["phrase", "reponse", "indice", "traduction"]);
  assert.ok("reading" in schemaTrous({ lecture: true }).properties.phrases.items.properties);
});

test("demandeTrous : point ciblé ou varié, ville du tuteur", () => {
  const cfg = langConfig("allemand");
  assert.match(demandeTrous({ cfg, point: "  le Perfekt " }), /Point visé : « le Perfekt »\. Dans CHAQUE phrase/);
  assert.match(demandeTrous({ cfg, point: "" }), /Varie les points/);
  assert.match(demandeTrous({ cfg }), /Berlin/);
});

test("trousValides : un seul trou, réponse non vide ; soulignés longs ramenés à ___ ; au plus 5", () => {
  const t = trousValides({ phrases: [
    p("Jo ___ de Barcelona.", "sóc"),
    p("Jo _____ cansat.", "estic"),
    p("Sans trou.", "x"),
    p("Deux ___ trous ___.", "x"),
    p("Réponse vide ___.", "  "),
    null,
    { phrase: 3, reponse: "x" },
  ] });
  assert.equal(t.length, 2);
  assert.equal(t[1].phrase, `Jo ${TROU} cansat.`);
  assert.equal(t[0].reading, null);
  assert.equal(trousValides({ phrases: [] }), null);
  assert.equal(trousValides(null), null);
  const beaucoup = trousValides({ phrases: Array.from({ length: 9 }, () => p("A ___ b", "c")) });
  assert.equal(beaucoup.length, NB_PHRASES);
});

test("corrigeTrou : juste (casse, espaces, ponctuation, apostrophe), accent, faux", () => {
  assert.equal(corrigeTrou("sóc", "Sóc"), "juste");
  assert.equal(corrigeTrou("l'he vist", "  l’he   vist. "), "juste");
  assert.equal(corrigeTrou("sóc", "soc"), "accent");
  assert.equal(corrigeTrou("está", "esta"), "accent");
  assert.equal(corrigeTrou("Straße", "strasse"), "faux", "ß n'est pas un accent");
  assert.equal(corrigeTrou("sóc", "som"), "faux");
  assert.equal(corrigeTrou("sóc", ""), "faux");
  assert.equal(corrigeTrou("sóc", null), "faux");
  assert.equal(corrigeTrou("he / ha", "ha"), "juste", "variantes séparées par /");
});

test("corrigeTrou : écritures non latines ; japonais comparé sans espaces", () => {
  assert.equal(corrigeTrou("は", " は "), "juste");
  assert.equal(corrigeTrou("食べました", "食べ ました", { charBased: true }), "juste");
  assert.equal(corrigeTrou("食べました", "食べ ました"), "faux", "sans charBased, l'espace compte");
  assert.equal(corrigeTrou("كتبتُ", "كتبتُ"), "juste");
  assert.equal(corrigeTrou("كتبتُ", "كتبت"), "accent", "voyelle brève (ḍamma) traitée comme un diacritique");
});

test("normalise, phraseComplete et scoreTrous", () => {
  assert.equal(normalise("¿Dónde ESTÁS?"), "dónde estás");
  assert.equal(normalise("¿Dónde ESTÁS?", { sansAccents: true }), "donde estas");
  assert.equal(phraseComplete(p("Jo ___ aquí.", "sóc / estic")), "Jo sóc aquí.");
  assert.deepEqual(scoreTrous(["juste", "accent", "faux", undefined]), { justes: 2, total: 4 });
  assert.deepEqual(scoreTrous(null), { justes: 0, total: 0 });
});

test("corrigeTrou : dakuten japonais non ignorés (か ≠ が)", () => {
  assert.equal(corrigeTrou("が", "か", { charBased: true }), "faux");
});

test("trousValides : réponse déjà collée au trou, délibération et indice qui donne la réponse (sondés via gw le 12/10)", () => {
  const t = trousValides({ phrases: [
    p("猫___がかわいいです。", "が"), // la phrase complète aurait « がが »
    p("Mi vecino ___ en casa.", "estuvo", { indice: "être… Attendons, 'estuvo' est prétérit. ".repeat(5) }),
    p("Mi vecino ___ en casa.", "estuvo", { indice: "être, prétérit : estuvo" }),
    p("¿Dónde ___ el baño?", "está", { indice: "être (situation) — pas « esta »" }),
    p("Ich ___ müde.", "bin", { indice: "sein, 1re pers. ; binaire" }),
    p("私___学生です。", "は", { indice: "particule は du thème" }),
    p("これは___です。", "は"), // « これはは » : écartée aussi (sortie réelle du modèle)
  ] }, { charBased: true });
  assert.equal(t.length, 4, "« がが », « これはは » et délibération écartées, les autres gardées");
  assert.equal(t.find(x => x.reponse === "estuvo").indice, "", "indice qui contient la réponse retiré");
  assert.equal(t.find(x => x.reponse === "está").indice, "", "à l'accent près aussi");
  assert.equal(t.find(x => x.reponse === "bin").indice, "sein, 1re pers. ; binaire", "mot entier seulement");
  assert.equal(t.find(x => x.reponse === "は").indice, "");
});

test("relecture du soir (#115) : réponses courtes gardées en écriture à espaces, rōmaji écarté, $ et ponctuation pleine chasse", () => {
  const t = trousValides({ phrases: [p("This ___ my house.", "is"), p("Ella va ___ casa.", "a"), p("Eu moro ___ emprego.", "em"), p("Él ___ es médico.", "es")] });
  assert.deepEqual(t.map(x => x.reponse), ["is", "a", "em"], "« es es » seul écarté");
  const jp = trousValides({ phrases: [p("Nihon e ___ iku yo.", "wa"), p("私___学生です。", "は")] }, { charBased: true, ecriture: "japonais" });
  assert.deepEqual(jp.map(x => x.reponse), ["は"]);
  assert.equal(phraseComplete(p("a ___ b", "$'")), "a $' b");
  assert.equal(corrigeTrou("は", "は。", { charBased: true }), "juste");
  assert.equal(corrigeTrou("لا", "لا؟"), "juste");
});
