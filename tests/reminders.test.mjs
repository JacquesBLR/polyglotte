// Tests des rappels de révision (#37).
import { test } from "node:test";
import assert from "node:assert/strict";

import { DAY_MS } from "../app/core/leitner.js";
import { DEFAULT_REMINDER_HOUR, nextReminder, reminderBody } from "../app/core/reminders.js";

// Un instant de référence exprimé en heure locale, pour que les tests ne
// dépendent pas du fuseau de la machine qui les exécute.
const local = (jour, heure, minute = 0) => new Date(2026, 8, jour, heure, minute, 0, 0).getTime();

const carte = (nextReview, id = 1) => ({ id, term: "gat", translation: "chat", nextReview });

test("carnet vide : aucun rappel", () => {
  assert.equal(nextReminder([], local(10, 12)), null);
});

test("cartes déjà dues le matin : rappel le soir même", () => {
  const now = local(10, 12);
  const r = nextReminder([carte(now - DAY_MS)], now);
  assert.equal(r.at, local(10, DEFAULT_REMINDER_HOUR));
  assert.equal(r.count, 1);
});

test("cartes dues mais l'heure est passée : rappel reporté au lendemain", () => {
  const now = local(10, 21);
  const r = nextReminder([carte(now - DAY_MS)], now);
  assert.equal(r.at, local(11, DEFAULT_REMINDER_HOUR));
  assert.equal(r.count, 1);
});

test("carte due dans trois jours : rappel le jour de l'échéance", () => {
  const now = local(10, 12);
  const r = nextReminder([carte(local(13, 10))], now);
  assert.equal(r.at, local(13, DEFAULT_REMINDER_HOUR));
  assert.equal(r.count, 1);
});

test("carte due après l'heure du rappel : jamais de rappel pour zéro carte", () => {
  const now = local(10, 12);
  const r = nextReminder([carte(local(10, 22))], now);
  assert.equal(r.at, local(11, DEFAULT_REMINDER_HOUR));
  assert.equal(r.count, 1);
});

test("le compte ne retient que les cartes dues à l'heure du rappel", () => {
  const now = local(10, 12);
  const deck = [carte(now - DAY_MS, 1), carte(local(10, 15), 2), carte(local(20, 9), 3)];
  const r = nextReminder(deck, now);
  assert.equal(r.at, local(10, DEFAULT_REMINDER_HOUR));
  assert.equal(r.count, 2); // la carte du 20 n'est pas encore due
});

test("échéances non numériques ignorées", () => {
  const now = local(10, 12);
  assert.equal(nextReminder([{ id: 1, nextReview: undefined }], now), null);
  const r = nextReminder([{ id: 1, nextReview: null }, carte(now - DAY_MS, 2)], now);
  assert.equal(r.count, 1);
});

test("heure de rappel paramétrable", () => {
  const now = local(10, 6);
  assert.equal(nextReminder([carte(now - DAY_MS)], now, 8).at, local(10, 8));
});

test("reminderBody : accord du pluriel", () => {
  assert.match(reminderBody(1), /^1 mot /);
  assert.match(reminderBody(4), /^4 mots /);
});
