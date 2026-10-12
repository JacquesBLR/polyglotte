// Tests des missions de scénario (#91).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MISSION_PAR_NIVEAU, NB_MISSIONS, blocMissionsPrompt, fusionneAtteints, messageMission, missionAccomplie,
  missionsValides, nbMissionsAccomplies,
} from "../app/core/mission.js";
import { langConfig } from "../app/core/languages.js";
import { buildTutorPrompt, LEVEL_INSTRUCTIONS } from "../app/core/prompts.js";
import { RESPONSE_SCHEMA } from "../app/core/schemas.js";

test("blocMissionsPrompt : une gradation par niveau de l'app, vide pour un niveau inconnu", () => {
  assert.deepEqual(Object.keys(MISSION_PAR_NIVEAU).sort(), Object.keys(LEVEL_INSTRUCTIONS).sort());
  assert.match(blocMissionsPrompt("debutant"), /saluer/);
  assert.match(blocMissionsPrompt("intermediaire"), /négocier/);
  assert.match(blocMissionsPrompt("avance"), /convaincre/);
  assert.match(blocMissionsPrompt("avance", ["Convaincre le client"]), /N'invente aucune réussite/);
  assert.equal(blocMissionsPrompt("inconnu"), "");
});

test("blocMissionsPrompt : une fois les missions annoncées, elles sont réinjectées numérotées et ne changent plus", () => {
  const bloc = blocMissionsPrompt("debutant", ["Saluer la serveuse", "Commander un café", "Demander le prix"]);
  assert.match(bloc, /1\. Saluer la serveuse/);
  assert.match(bloc, /3\. Demander le prix/);
  assert.match(bloc, /déjà annoncées, ne les change pas/);
  assert.doesNotMatch(bloc, /choisis 3 missions/);
  assert.match(bloc, /"missions_accomplies"/);
  // Liste vide ou invalide : on retombe sur la consigne de choix.
  assert.match(blocMissionsPrompt("debutant", []), /choisis 3 missions/);
  assert.match(blocMissionsPrompt("debutant", [42]), /choisis 3 missions/);
  const cfg = langConfig("catalan");
  const p = buildTutorPrompt({ cfg, level: "debutant", scenarioId: "cafe", immersion: false, missions: ["Saluer", "Payer"] });
  assert.match(p, /1\. Saluer/);
  assert.match(p, /2\. Payer/);
});

test("buildTutorPrompt : la consigne de missions est dans le prompt du tuteur, pas dans le test de niveau", () => {
  const cfg = langConfig("catalan");
  for (const level of ["debutant", "intermediaire", "avance"]) {
    const p = buildTutorPrompt({ cfg, level, scenarioId: "cafe", immersion: false });
    assert.match(p, /MISSIONS/);
    assert.doesNotMatch(p, /"missions_accomplies"/, "pas de missions à cocher : champ absent du schéma du tour (#103)");
    assert.match(buildTutorPrompt({ cfg, level, scenarioId: "cafe", immersion: false, missions: ["Saluer"] }), /"missions_accomplies"/);
  }
  assert.match(buildTutorPrompt({ cfg, level: "debutant", scenarioId: "libre", immersion: true }), /MISSIONS/, "en immersion aussi");
  assert.doesNotMatch(buildTutorPrompt({ cfg, mode: "eval", level: "debutant" }), /missions_accomplies/);
});

test("RESPONSE_SCHEMA : les deux champs sont déclarés et requis (schéma strict), après reply", () => {
  const props = Object.keys(RESPONSE_SCHEMA.properties);
  assert.equal(props[0], "reply", "le streaming lit reply en tête");
  assert.ok(props.includes("missions") && props.includes("missions_accomplies"));
  assert.ok(RESPONSE_SCHEMA.required.includes("missions"));
  assert.ok(RESPONSE_SCHEMA.required.includes("missions_accomplies"));
  assert.equal(RESPONSE_SCHEMA.properties.missions.items.type, "string");
  assert.equal(RESPONSE_SCHEMA.properties.missions_accomplies.items.type, "integer");
});

test("missionsValides : chaînes nettoyées, trois au plus, le reste ignoré", () => {
  assert.deepEqual(missionsValides(["  Commander un  café ", "", 3, null, "Payer", "Demander l'addition", "Une de trop"]),
    ["Commander un café", "Payer", "Demander l'addition"]);
  assert.deepEqual(missionsValides(undefined), []);
  assert.deepEqual(missionsValides("Commander"), []);
  assert.equal(missionsValides(["a", "b", "c", "d"]).length, NB_MISSIONS);
});

test("fusionneAtteints : cumul, dédoublonnage, bornes, jamais de régression", () => {
  assert.deepEqual(fusionneAtteints([], [2], 3), [2]);
  assert.deepEqual(fusionneAtteints([2], [1, 2, 3, 4, 0, -1, 1.5, "3"], 3), [1, 2, 3]);
  assert.deepEqual(fusionneAtteints([3, 1], [], 3), [1, 3], "rien de neuf : les acquis restent, triés");
  assert.deepEqual(fusionneAtteints([1], null, 3), [1]);
  assert.deepEqual(fusionneAtteints([1, 2], [1], 0), [], "sans mission annoncée, rien ne peut être coché");
});

test("missionAccomplie et messageMission", () => {
  const missions = ["Saluer", "Commander", "Payer"];
  assert.equal(missionAccomplie(missions, [1, 2]), false);
  assert.equal(missionAccomplie(missions, [1, 2, 3]), true);
  assert.equal(missionAccomplie([], []), false, "pas de mission, pas de victoire");
  assert.equal(messageMission(missions, [1], 0), null, "rien de neuf à ce tour");
  assert.match(messageMission(missions, [1], 1), /1 \/ 3/);
  assert.match(messageMission(missions, [1, 2, 3], 1), /Toutes les missions/);
  assert.equal(messageMission([], [], 1), null);
});

test("nbMissionsAccomplies : sessions dont toutes les missions sont cochées", () => {
  const history = [
    { id: 1, missions: { total: 3, atteintes: 3 } },
    { id: 2, missions: { total: 3, atteintes: 2 } },
    { id: 3 }, // session d'avant les missions
    { id: 4, missions: { total: 0, atteintes: 0 } },
    null,
  ];
  assert.equal(nbMissionsAccomplies(history), 1);
  assert.equal(nbMissionsAccomplies([]), 0);
});
