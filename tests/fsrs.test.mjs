// Tests de la planification FSRS-4.5 (#44).
import { test } from "node:test";
import assert from "node:assert/strict";

import { DAY_MS } from "../app/core/leitner.js";
import {
  RATINGS, REQUEST_RETENTION, MAX_INTERVAL_DAYS,
  retrievability, nextInterval, isFsrsCard, reviewCard,
} from "../app/core/fsrs.js";

const NOW = 1_756_600_000_000;
const carte = extra => ({ id: 1, term: "gat", translation: "chat", box: 1, nextReview: NOW, ...extra });

test("retrievability : 90 % au terme de la stabilité, décroissante", () => {
  assert.ok(Math.abs(retrievability(10, 10) - REQUEST_RETENTION) < 1e-9);
  assert.equal(retrievability(0, 10), 1);
  assert.ok(retrievability(20, 10) < retrievability(5, 10));
});

test("nextInterval : ≈ stabilité pour une rétention de 90 %, borné", () => {
  assert.equal(nextInterval(10), 10);
  assert.equal(nextInterval(0.2), 1); // plancher 1 jour
  assert.equal(nextInterval(10_000), MAX_INTERVAL_DAYS);
});

test("première révision : intervalles croissants avec la note", () => {
  const notes = [RATINGS.again, RATINGS.hard, RATINGS.good, RATINGS.easy];
  const [again, hard, good, easy] = notes.map(g => reviewCard(carte(), g, NOW));
  assert.ok(again.nextReview <= hard.nextReview);
  assert.ok(hard.nextReview <= good.nextReview);
  assert.ok(good.nextReview < easy.nextReview);
  assert.equal(again.nextReview, NOW + DAY_MS); // échec → revoir demain
  for (const c of [again, hard, good, easy]) {
    assert.ok(isFsrsCard(c));
    assert.equal(c.lastReview, NOW);
    assert.equal(c.reps, 1);
  }
  assert.equal(again.lapses, 1);
  assert.equal(good.lapses, 0);
});

test("carte Leitner migrée : la boîte sème la stabilité (avancement conservé)", () => {
  const boite4 = reviewCard(carte({ box: 4 }), RATINGS.good, NOW);
  assert.ok(boite4.stability >= 8, `stabilité ${boite4.stability} ≥ 8 jours (boîte 4)`);
  const neuve = reviewCard(carte({ box: 1 }), RATINGS.good, NOW);
  assert.ok(boite4.stability > neuve.stability);
  // Un échec ne bénéficie pas de la semence.
  const ratee = reviewCard(carte({ box: 4 }), RATINGS.again, NOW);
  assert.equal(ratee.nextReview, NOW + DAY_MS);
});

test("révisions réussies successives : stabilité et intervalle croissent", () => {
  let c = reviewCard(carte(), RATINGS.good, NOW);
  const s1 = c.stability;
  const t2 = c.nextReview;
  c = reviewCard(c, RATINGS.good, t2);
  assert.ok(c.stability > s1);
  assert.ok(c.nextReview - t2 >= t2 - NOW, "l'intervalle s'allonge");
  assert.equal(c.reps, 2);
});

test("échec après plusieurs réussites : la stabilité retombe", () => {
  let c = reviewCard(carte(), RATINGS.easy, NOW);
  c = reviewCard(c, RATINGS.easy, c.nextReview);
  const avant = c.stability;
  const raté = reviewCard(c, RATINGS.again, c.nextReview);
  assert.ok(raté.stability < avant);
  assert.equal(raté.lapses, 1);
  assert.equal(raté.nextReview - raté.lastReview, DAY_MS);
});

test("difficulté bornée entre 1 et 10", () => {
  let c = reviewCard(carte(), RATINGS.again, NOW);
  for (let i = 0; i < 30; i++) c = reviewCard(c, RATINGS.again, c.nextReview);
  assert.ok(c.difficulty <= 10 && c.difficulty >= 1);
  let e = reviewCard(carte(), RATINGS.easy, NOW);
  for (let i = 0; i < 30; i++) e = reviewCard(e, RATINGS.easy, e.nextReview);
  assert.ok(e.difficulty >= 1 && e.difficulty <= 10);
  assert.ok(c.difficulty > e.difficulty, "rater rend la carte plus difficile");
});

test("déterminisme à horodatage fixé", () => {
  const a = reviewCard(carte(), RATINGS.good, NOW);
  const b = reviewCard(carte(), RATINGS.good, NOW);
  assert.deepEqual(a, b);
});
