// Tests des fonctions pures du streaming (#43).
import { test } from "node:test";
import assert from "node:assert/strict";

import { partialStringField, takeSentences, createSentenceStreamer, takeSseData } from "../app/core/stream.js";

test("partialStringField : champ absent ou pas encore une chaîne", () => {
  assert.equal(partialStringField('{"a": 1}', "reply"), null);
  assert.equal(partialStringField('{"reply"', "reply"), null); // pas encore de deux-points
  assert.equal(partialStringField('{"reply": null}', "reply"), null); // pas une chaîne
  assert.deepEqual(partialStringField('{"reply":', "reply"), { text: "", complete: false });
});

test("partialStringField : valeur partielle puis complète", () => {
  assert.deepEqual(partialStringField('{"reply": "Bon', "reply"), { text: "Bon", complete: false });
  assert.deepEqual(
    partialStringField('{"reply": "Bonjour !", "translation": "…', "reply"),
    { text: "Bonjour !", complete: true },
  );
});

test("partialStringField : échappements, y compris tronqués", () => {
  assert.deepEqual(
    partialStringField('{"reply": "a\\"b\\nc\\u00e9"', "reply"),
    { text: 'a"b\ncé', complete: true },
  );
  // Séquence d'échappement coupée en plein vol : on rend ce qui précède.
  assert.deepEqual(partialStringField('{"reply": "abc\\', "reply"), { text: "abc", complete: false });
  assert.deepEqual(partialStringField('{"reply": "x\\u00', "reply"), { text: "x", complete: false });
});

test("takeSentences : terminateur ASCII suivi d'une espace", () => {
  assert.deepEqual(takeSentences("Bonjour. Ça va ?"), { sentences: ["Bonjour."], rest: "Ça va ?" });
  assert.deepEqual(takeSentences("Bonjour. Ça va ? "), { sentences: ["Bonjour.", "Ça va ?"], rest: "" });
  // Un point décimal ne conclut pas une phrase.
  assert.deepEqual(takeSentences("Il fait 3.5 km"), { sentences: [], rest: "Il fait 3.5 km" });
});

test("takeSentences : ponctuation pleine chasse sans espace (japonais)", () => {
  assert.deepEqual(takeSentences("こんにちは。元気"), { sentences: ["こんにちは。"], rest: "元気" });
});

test("takeSentences : guillemets fermants rattachés à la phrase", () => {
  const { sentences } = takeSentences('"Hola!" dit-il. Bien. ');
  assert.equal(sentences[0], '"Hola!"');
});

test("createSentenceStreamer : chaque phrase prononcée une seule fois, flush du reliquat", () => {
  const dites = [];
  const s = createSentenceStreamer(p => dites.push(p));
  s.push("Bonjour");
  assert.deepEqual(dites, []);
  s.push("Bonjour. Ça");
  assert.deepEqual(dites, ["Bonjour."]);
  s.push("Bonjour. Ça va ? Oui.");
  assert.deepEqual(dites, ["Bonjour.", "Ça va ?"]);
  s.flush("Bonjour. Ça va ? Oui.");
  assert.deepEqual(dites, ["Bonjour.", "Ça va ?", "Oui."]);
  s.flush("Bonjour. Ça va ? Oui."); // rien de nouveau
  assert.deepEqual(dites, ["Bonjour.", "Ça va ?", "Oui."]);
});

test("takeSseData : événements data: complets, reste conservé", () => {
  const { events, rest } = takeSseData('data: {"a":1}\ndata: [DONE]\n\ndata: {"par');
  assert.deepEqual(events, ['{"a":1}', "[DONE]"]);
  assert.equal(rest, 'data: {"par');
});

test("createSentenceStreamer : minChars regroupe les phrases courtes (#81)", () => {
  // Voix clonée (derja) : un fragment rend du silence pur. Les phrases s'accumulent
  // jusqu'à la taille minimale, et le reliquat part au flush.
  const dites = [];
  const s = createSentenceStreamer(p => dites.push(p), { minChars: 30 });
  s.push("Salut. ");
  assert.deepEqual(dites, [], "trop court : on attend la suite");
  s.push("Salut. Comment vas-tu aujourd'hui ? ");
  assert.deepEqual(dites, ["Salut. Comment vas-tu aujourd'hui ?"], "le groupe atteint 30 car.");
  s.push("Salut. Comment vas-tu aujourd'hui ? Moi ça va. ");
  assert.equal(dites.length, 1, "le reste attend encore");
  s.flush("Salut. Comment vas-tu aujourd'hui ? Moi ça va. Et toi");
  assert.deepEqual(dites, ["Salut. Comment vas-tu aujourd'hui ?", "Moi ça va. Et toi"]);
});

test("createSentenceStreamer : minChars absent, comportement inchangé", () => {
  const dites = [];
  const s = createSentenceStreamer(p => dites.push(p));
  s.push("Un. Deux. ");
  assert.deepEqual(dites, ["Un.", "Deux."], "chaque phrase part aussitôt");
  s.flush("Un. Deux. Trois");
  assert.deepEqual(dites, ["Un.", "Deux.", "Trois"]);
});

test("createSentenceStreamer : flush ne prononce rien si tout est déjà dit", () => {
  const dites = [];
  const s = createSentenceStreamer(p => dites.push(p), { minChars: 5 });
  s.push("Bonjour tout le monde. ");
  assert.equal(dites.length, 1);
  s.flush("Bonjour tout le monde. ");
  assert.equal(dites.length, 1, "pas de groupe vide prononcé");
});
