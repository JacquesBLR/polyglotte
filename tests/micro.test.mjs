// Choix du moteur de reconnaissance vocale (#65).

import assert from "node:assert/strict";
import { test } from "node:test";

import { choisitMicro } from "../app/core/micro.js";

const TOUT = { distantDisponible: true, localDisponible: true };

test("cas ordinaire : la reconnaissance de l'appareil, qui écoute en continu", () => {
  assert.equal(choisitMicro({ support: "full", ...TOUT }), "local");
});

test("langue au support partiel : Whisper, que le navigateur transcrit mal", () => {
  assert.equal(choisitMicro({ support: "partial", ...TOUT }), "distant");
});

test("app installée sur iPhone : Whisper, même pour une langue bien supportée", () => {
  // WebKit expose SpeechRecognition en mode autonome mais ne transcrit rien : sans cette
  // règle, `localDisponible` est vrai et l'app paraît sourde.
  assert.equal(choisitMicro({ support: "full", autonomeIos: true, ...TOUT }), "distant");
});

test("app installée sur iPhone sans serveur vocal : le navigateur, faute de mieux", () => {
  const choix = choisitMicro({
    support: "full", autonomeIos: true, distantDisponible: false, localDisponible: true,
  });
  assert.equal(choix, "local", "un moteur muet vaut mieux que pas de bouton du tout");
});

test("navigateur sans reconnaissance : repli sur le serveur vocal", () => {
  const choix = choisitMicro({
    support: "full", distantDisponible: true, localDisponible: false,
  });
  assert.equal(choix, "distant");
});

test("langue partielle sans serveur vocal : le navigateur plutôt que rien", () => {
  const choix = choisitMicro({
    support: "partial", distantDisponible: false, localDisponible: true,
  });
  assert.equal(choix, "local");
});

test("aucun moteur : null, l'appelant doit l'expliquer", () => {
  assert.equal(choisitMicro({ support: "full" }), null);
  assert.equal(choisitMicro(), null);
});
