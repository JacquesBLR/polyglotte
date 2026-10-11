// Fusion des réglages enregistrés avec les défauts (#56).

import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_SETTINGS, fusionneReglages } from "../app/core/settings.js";

test("installation neuve : les défauts tels quels, rien à réenregistrer", () => {
  const { settings, modifie } = fusionneReglages(null);
  assert.equal(settings.localUrl, DEFAULT_SETTINGS.localUrl);
  assert.equal(settings.voiceUrl, DEFAULT_SETTINGS.voiceUrl);
  assert.equal(settings.provider, "local");
  assert.equal(modifie, false);
});

test("installation existante aux champs vides : garnie et réenregistrée", () => {
  const { settings, modifie } = fusionneReglages({
    provider: "claude", apiKey: "", localUrl: "", localModel: "", voiceUrl: "",
  });
  assert.equal(settings.localUrl, DEFAULT_SETTINGS.localUrl);
  assert.equal(settings.localModel, DEFAULT_SETTINGS.localModel);
  assert.equal(settings.voiceUrl, DEFAULT_SETTINGS.voiceUrl);
  assert.equal(settings.provider, "local", "un moteur Claude sans clé bascule sur local");
  assert.equal(settings.defautsDgx, true);
  assert.equal(modifie, true);
});

test("un champ vide qui ne contient que des espaces compte comme vide", () => {
  const { settings } = fusionneReglages({ voiceUrl: "   " });
  assert.equal(settings.voiceUrl, DEFAULT_SETTINGS.voiceUrl);
});

test("les valeurs saisies par l'utilisateur ne sont jamais écrasées", () => {
  const { settings } = fusionneReglages({
    localUrl: "http://autre:8000/v1", localModel: "mistral", voiceUrl: "http://autre:9000",
  });
  assert.equal(settings.localUrl, "http://autre:8000/v1");
  assert.equal(settings.localModel, "mistral");
  assert.equal(settings.voiceUrl, "http://autre:9000");
});

test("une clé Claude saisie garde le fournisseur Claude", () => {
  const { settings } = fusionneReglages({ provider: "claude", apiKey: "sk-xxx" });
  assert.equal(settings.provider, "claude");
});

test("aucune clé n'est jamais garnie depuis les défauts", () => {
  const { settings } = fusionneReglages({ apiKey: "", localKey: "" });
  assert.equal(settings.apiKey, "");
  assert.equal(settings.localKey, "");
});

test("le garnissage n'a lieu qu'une fois : vider un champ ensuite tient", () => {
  const premier = fusionneReglages({ voiceUrl: "" });
  assert.equal(premier.settings.voiceUrl, DEFAULT_SETTINGS.voiceUrl);

  // L'utilisateur coupe le serveur vocal en effaçant son URL, puis recharge l'app.
  const coupe = { ...premier.settings, voiceUrl: "" };
  const second = fusionneReglages(coupe);
  assert.equal(second.settings.voiceUrl, "", "l'URL effacée ne doit pas réapparaître");
  assert.equal(second.modifie, false);
});

test("les réglages non moteur enregistrés sont préservés", () => {
  const { settings } = fusionneReglages({ autospeak: false, rate: 0.8, reminders: true });
  assert.equal(settings.autospeak, false);
  assert.equal(settings.rate, 0.8);
  assert.equal(settings.reminders, true);
});
