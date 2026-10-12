// Tests de la sonde de latence (#98).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_MESURES, SEUILS, ajouteMesure, centile, creeChrono, enSecondes, lenteur, ligneConsole, mesure, messageLenteur, statsLatence,
} from "../app/core/latence.js";

// Horloge factice : chaque appel rend la valeur suivante.
const horloge = (...t) => { let i = 0; return () => t[Math.min(i++, t.length - 1)]; };

test("creeChrono : premier jeton retenu une seule fois, total depuis le départ", () => {
  const c = creeChrono(horloge(1000, 2500, 9000, 14000));
  c.premierJeton(); // 2500
  c.premierJeton(); // ignoré (9000 non lu)
  assert.deepEqual(c.fin(), { premierJeton: 1500, total: 8000 });
});

test("creeChrono : sans fragment (appel non streamé), premier jeton = total", () => {
  const c = creeChrono(horloge(0, 36000));
  assert.deepEqual(c.fin(), { premierJeton: 36000, total: 36000 });
});

test("lenteur : seuils par nature ; le premier jeton ne compte qu'en streaming", () => {
  const tour = (premierJeton, total, stream = true) => mesure("tour", { premierJeton, total }, { stream, at: 0 });
  assert.equal(lenteur(tour(1200, 13000)), null, "la nuit du 11/10 (13 s/tour, premier mot rapide) n'est pas une alerte");
  assert.equal(lenteur(tour(SEUILS.tour.premierJeton, 13000)), "premierJeton");
  assert.equal(lenteur(tour(1200, SEUILS.tour.total)), "total");
  assert.equal(lenteur(tour(13000, 13000, false)), null, "non streamé : seul le total compte");
  assert.equal(lenteur(mesure("resume", { premierJeton: 36000, total: 36000 })), null, "36 s de résumé : dans les temps");
  assert.equal(lenteur(mesure("resume", { premierJeton: 41638, total: 41638 })), null, "42 s (banc du 12/10) : dans les temps");
  assert.equal(lenteur(mesure("resume", { premierJeton: 61000, total: 61000 })), "total");
  assert.equal(lenteur(mesure("explique", { premierJeton: 21371, total: 21371 })), null);
  assert.equal(lenteur(mesure("explique", { premierJeton: 36000, total: 36000 })), "total");
  assert.equal(lenteur(tour(1071, 25949)), null, "tour du banc du 12/10 : premier jeton 1,1 s, 26 s au total");
  assert.equal(lenteur(mesure("inconnu", { premierJeton: 1e9, total: 1e9 })), null);
  assert.equal(lenteur(null), null);
  assert.equal(lenteur(mesure("tour", { premierJeton: NaN, total: NaN }, { stream: true })), null);
});

test("messageLenteur : vide dans les temps, chiffré en secondes sinon", () => {
  assert.equal(messageLenteur(mesure("tour", { premierJeton: 800, total: 9000 }, { stream: true })), "");
  const msg = messageLenteur(mesure("tour", { premierJeton: 7300, total: 15000 }, { stream: true }));
  assert.match(msg, /Le tuteur est lent/);
  assert.match(msg, /premier mot après 7,3 s/);
  assert.match(messageLenteur(mesure("resume", { premierJeton: 61000, total: 61000 })), /réponse en 61 s/);
  assert.equal(enSecondes(13049), "13 s");
  assert.equal(enSecondes(13050), "13,1 s");
});

test("ajouteMesure : journal borné aux plus récentes, mesures invalides écartées sans copie", () => {
  let j = [];
  for (let i = 0; i < MAX_MESURES + 7; i++) j = ajouteMesure(j, mesure("tour", { premierJeton: i, total: i }, { at: i }));
  assert.equal(j.length, MAX_MESURES);
  assert.equal(j[0].at, 7);
  assert.equal(j.at(-1).at, MAX_MESURES + 6);
  assert.equal(ajouteMesure(j, null), j);
  assert.equal(ajouteMesure(j, mesure("tour", { premierJeton: -1, total: 5 })), j);
  assert.equal(ajouteMesure(j, mesure("autre", { premierJeton: 1, total: 5 })), j);
  assert.equal(ajouteMesure(null, mesure("tour", { premierJeton: 1, total: 2 })).length, 1, "stockage vide ou corrompu");
});

test("centile et statsLatence : médiane et 90e centile au rang le plus proche, par nature", () => {
  assert.equal(centile([], 50), null);
  assert.equal(centile([5, 1, 3], 50), 3);
  assert.equal(centile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), 9);
  assert.equal(centile([1, NaN, 2], 100), 2);
  let j = [];
  for (const t of [11000, 13000, 12000, 14000, 40000]) {
    j = ajouteMesure(j, mesure("tour", { premierJeton: 1000, total: t }, { stream: true }));
  }
  j = ajouteMesure(j, mesure("resume", { premierJeton: 36000, total: 36000 }));
  const s = statsLatence(j, "tour");
  assert.deepEqual(s, { n: 5, premierJeton: 1000, total: 13000, totalP90: 40000, lents: 1 });
  assert.equal(statsLatence(j, "resume").n, 1);
  assert.equal(statsLatence(j, "explique"), null);
  assert.equal(statsLatence(null, "tour"), null);
});

test("ligneConsole : une ligne lisible par appel", () => {
  const l = ligneConsole(mesure("tour", { premierJeton: 900, total: 12800 }, { stream: true, modele: "qwen3.8-nvfp4" }));
  assert.equal(l, "[latence] tour (stream) premier jeton 900 ms, total 12800 ms, qwen3.8-nvfp4");
});
