// Ancrage du tunisien dans de la derja réelle (#85).

import assert from "node:assert/strict";
import { test } from "node:test";

import { GUIDE_DERJA } from "../app/core/derja.js";
import { langConfig } from "../app/core/languages.js";
import { buildTutorPrompt } from "../app/core/prompts.js";

const construit = (id, ecriture) => buildTutorPrompt({
  cfg: langConfig(id, ecriture), level: "debutant", scenarioId: "libre",
  immersion: false, mode: "chat",
});

test("le guide oppose chaque forme tunisienne à celle qu'il faut écarter", () => {
  // Comptés sur les 1 950 phrases du corpus TUNIFRA : la forme de gauche y est attestée,
  // celle de droite absente.
  for (const [tunisien, ailleurs] of [
    ["برشا", "بزاف"], ["قداش", "شحال"], ["توة", "دابا"],
    ["متاع", "ديال"], ["نحب", "بغيت"], ["هاذا", "هاد"],
  ]) {
    assert.ok(GUIDE_DERJA.includes(tunisien), `forme tunisienne absente : ${tunisien}`);
    assert.ok(GUIDE_DERJA.includes(ailleurs), `forme à écarter absente : ${ailleurs}`);
  }
});

test("le guide part dans le prompt du tunisien, dans les deux écritures", () => {
  for (const ecriture of ["arabe", "arabizi"]) {
    assert.ok(construit("tunisien", ecriture).includes("برشا"), `écriture ${ecriture}`);
  }
});

test("aucune autre langue ne reçoit le guide", () => {
  for (const id of ["catalan", "espagnol", "suisse", "japonais"]) {
    assert.ok(!construit(id, null).includes("برشا"), id);
  }
});
