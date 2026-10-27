// Choix du moteur de synthèse vocale (#67).

import assert from "node:assert/strict";
import { test } from "node:test";

import { choisitVoix } from "../app/core/voix.js";

test("voix du navigateur disponible : on la prend", () => {
  assert.equal(choisitVoix({ support: "full", voixNavigateur: true, distantDisponible: true }), "local");
});

test("aucune voix du navigateur : le serveur vocal plutôt que le silence", () => {
  // Cas vécu sur iPhone : la liste des voix est vide tant que la synthèse n'a pas servi.
  // « Pas encore de voix » n'est pas « cet appareil ne parle pas ».
  assert.equal(choisitVoix({ support: "full", voixNavigateur: false, distantDisponible: true }), "distant");
});

test("langue au support partiel : le serveur vocal même si le navigateur a une voix", () => {
  assert.equal(choisitVoix({ support: "partial", voixNavigateur: true, distantDisponible: true }), "distant");
});

test("serveur vocal non configuré et aucune voix : null, à signaler", () => {
  assert.equal(choisitVoix({ support: "full", voixNavigateur: false, distantDisponible: false }), null);
  assert.equal(choisitVoix(), null);
});

test("serveur vocal non configuré mais voix présente : le navigateur", () => {
  assert.equal(choisitVoix({ support: "partial", voixNavigateur: true, distantDisponible: false }), "local");
});

test("repli épuisé : le serveur qui vient d'échouer n'est pas rappelé", () => {
  // pumpRemote() retombe sur le navigateur quand le serveur échoue. Sans ce drapeau, un
  // appareil sans voix lui renverrait aussitôt la phrase : aller-retour sans fin.
  assert.equal(
    choisitVoix({ support: "partial", voixNavigateur: true, distantDisponible: true, repliEpuise: true }),
    "local",
  );
  assert.equal(
    choisitVoix({ support: "full", voixNavigateur: false, distantDisponible: true, repliEpuise: true }),
    null,
    "plus de voix, plus de serveur : il faut le dire, pas boucler",
  );
});

test("langue qui préfère le serveur : il passe devant la voix du navigateur", () => {
  // Catalan (#79) : reconnaissance vocale « full », mais voix iOS compacte médiocre.
  assert.equal(
    choisitVoix({ support: "full", voixServeur: true, voixNavigateur: true, distantDisponible: true }),
    "distant",
  );
});

test("langue qui préfère le serveur, serveur absent : la voix du navigateur, pas le silence", () => {
  assert.equal(
    choisitVoix({ support: "full", voixServeur: true, voixNavigateur: true, distantDisponible: false }),
    "local",
  );
});

test("langue qui préfère le serveur, repli épuisé : le navigateur reprend la main", () => {
  assert.equal(
    choisitVoix({
      support: "full", voixServeur: true, voixNavigateur: true,
      distantDisponible: true, repliEpuise: true,
    }),
    "local",
  );
});

test("iPhone : le serveur vocal passe devant la voix du navigateur, même en support full", () => {
  // #129 : la voix de l'iPhone se tait en mode silencieux ; l'élément audio du serveur non.
  // Constaté le 27/10 : séances en langue « full » sans aucun /tts côté serveur, et sans son.
  assert.equal(
    choisitVoix({ support: "full", appareilIos: true, voixNavigateur: true, distantDisponible: true }),
    "distant",
  );
});

test("iPhone sans serveur vocal (ou langue sans voix serveur) : la voix de l'iPhone", () => {
  assert.equal(
    choisitVoix({ support: "full", appareilIos: true, voixNavigateur: true, distantDisponible: false }),
    "local",
  );
});

test("iPhone, serveur en échec : repli sur la voix de l'iPhone, sans boucle", () => {
  assert.equal(
    choisitVoix({
      support: "full", appareilIos: true, voixNavigateur: true,
      distantDisponible: true, repliEpuise: true,
    }),
    "local",
  );
});

test("hors iPhone, langue full : la voix du navigateur reste préférée", () => {
  assert.equal(
    choisitVoix({ support: "full", appareilIos: false, voixNavigateur: true, distantDisponible: true }),
    "local",
  );
});
