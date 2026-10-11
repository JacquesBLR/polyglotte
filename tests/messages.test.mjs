// Tenue de la liste des messages affichés (#83).

import assert from "node:assert/strict";
import { test } from "node:test";

import { retireProvisoire } from "../app/core/messages.js";

test("retireProvisoire : retire le message provisoire du tuteur", () => {
  const avant = [{ role: "user", text: "bon dia" }, { role: "tutor", text: "Bon…", streaming: true }];
  assert.deepEqual(retireProvisoire(avant), [{ role: "user", text: "bon dia" }]);
});

test("retireProvisoire : ne touche pas la bulle de l'élève", () => {
  // Le défaut : la mise à jour retirait le dernier message quel qu'il soit.
  const avant = [{ role: "tutor", text: "Bon dia!" }, { role: "user", text: "bon dia" }];
  assert.deepEqual(retireProvisoire(avant), avant);
});

test("retireProvisoire : liste vide, ou message définitif en dernier", () => {
  assert.deepEqual(retireProvisoire([]), []);
  const fini = [{ role: "tutor", text: "Bon dia!" }];
  assert.equal(retireProvisoire(fini), fini, "aucune copie inutile");
});

test("la bulle de l'élève survit au streaming, quel que soit l'ordre d'exécution", () => {
  // React exécute les fonctions de mise à jour quand il traite sa file, au rendu suivant,
  // et non à l'appel. On rejoue les deux ordres : application immédiate, puis application
  // différée (la file est vidée après coup, comme React le fait).
  for (const differe of [false, true]) {
    let etat = [];
    const file = [];
    const setMessages = (u) => (differe ? file.push(u) : (etat = u(etat)));
    const vide = () => { for (const u of file) etat = u(etat); file.length = 0; };

    setMessages(m => [...m, { role: "user", text: "bon dia" }]);          // l'élève parle
    for (const fragment of ["Bon", "Bon dia", "Bon dia, com estàs?"]) {   // le tuteur répond
      setMessages(m => [...retireProvisoire(m), { role: "tutor", text: fragment, streaming: true }]);
    }
    setMessages(m => [...retireProvisoire(m), { role: "tutor", text: "Bon dia, com estàs?" }]);
    vide();

    assert.deepEqual(
      etat,
      [{ role: "user", text: "bon dia" }, { role: "tutor", text: "Bon dia, com estàs?" }],
      `ordre ${differe ? "différé" : "immédiat"} : la bulle de l'élève doit rester`,
    );
  }
});

test("le défaut d'origine : un drapeau extérieur lu trop tard emportait la bulle", () => {
  // Reproduction de l'ancien code, pour que la régression soit documentée et non devinée.
  let etat = [];
  const file = [];
  const setMessages = (u) => file.push(u);
  const vide = () => { for (const u of file) etat = u(etat); file.length = 0; };

  let streamed = false;
  setMessages(m => [...m, { role: "user", text: "bon dia" }]);
  setMessages(m => [...(streamed ? m.slice(0, -1) : m), { role: "tutor", text: "Bon", streaming: true }]);
  streamed = true;   // posé avant que React n'exécute la mise à jour ci-dessus
  vide();

  assert.deepEqual(etat, [{ role: "tutor", text: "Bon", streaming: true }],
    "l'ancien code perdait bien le message de l'élève");
});
