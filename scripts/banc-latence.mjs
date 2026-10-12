#!/usr/bin/env node
/* Banc de latence du tuteur (#98) — PROPOSÉ, NON ACTIVÉ.
 *
 * Rejoue N tours de conversation tels que l'app les envoie (prompt du tuteur, RESPONSE_SCHEMA,
 * streaming, thinking désactivé), plus un résumé de séance, contre la passerelle gw du parc,
 * et imprime une ligne JSON : temps au premier jeton et temps total par tour, médianes, p90.
 *
 *   node scripts/banc-latence.mjs [--tours 4] [--langue catalan]
 *   GW_URL (défaut http://127.0.0.1:8646/v1), GW_MODELE (défaut qwen3.8-nvfp4)
 *
 * Chaque appel porte `X-Atelier-Backend: vllm` et `X-Atelier-Projet: polyglotte` (coût imputé
 * au projet, pas d'escalade vers un backend commercial). Aucun secret lu ni écrit.
 *
 * Armement proposé (à décider par Jacques, rien n'est installé) : un timer systemd --user
 * nocturne sur le DGX, p. ex. `OnCalendar=*-*-* 04:10`, qui exécute
 *   node scripts/banc-latence.mjs >> ~/.local/state/polyglotte/banc-latence.jsonl
 * — une ligne par nuit, comparable d'une nuit à l'autre. Code de sortie 2 si la médiane du
 * premier jeton dépasse le seuil d'alerte de l'app (SEUILS.tour), 1 si gw ne répond pas.
 */
import { buildTutorPrompt, summaryRequest } from "../app/core/prompts.js";
import { langConfig } from "../app/core/languages.js";
import { RESPONSE_SCHEMA, SUMMARY_SCHEMA } from "../app/core/schemas.js";
import { SEUILS, centile, creeChrono } from "../app/core/latence.js";
import { takeSseData } from "../app/core/stream.js";

const arg = (nom, defaut) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i > -1 ? process.argv[i + 1] : defaut;
};
const BASE = (process.env.GW_URL || "http://127.0.0.1:8646/v1").replace(/\/+$/, "");
const MODELE = process.env.GW_MODELE || "qwen3.8-nvfp4";
const TOURS = Math.max(1, Number(arg("tours", 4)) || 4);
const LANGUE = arg("langue", "catalan");
const ENTETES = {
  "content-type": "application/json",
  "X-Atelier-Backend": "vllm",
  "X-Atelier-Projet": "polyglotte",
};
const REPLIQUES_ELEVE = ["[START]", "Hola, vull un cafè amb llet, si us plau.", "Quant costa?", "Gràcies, adéu!", "On és el lavabo?"];

async function appel(messages, system, schema, stream) {
  const chrono = creeChrono();
  const body = {
    model: MODELE, max_tokens: 2048, stream,
    messages: [{ role: "system", content: system }, ...messages],
    chat_template_kwargs: { enable_thinking: false },
    response_format: { type: "json_schema", json_schema: { name: "reponse", schema, strict: true } },
  };
  const r = await fetch(BASE + "/chat/completions", { method: "POST", headers: ENTETES, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`gw ${r.status} : ${(await r.text()).slice(0, 200)}`);
  let texte = "";
  if (!stream) {
    texte = (await r.json()).choices?.[0]?.message?.content || "";
  } else {
    const lecteur = r.body.getReader();
    const dec = new TextDecoder();
    let sse = "";
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      const { events, rest } = takeSseData(sse + dec.decode(value, { stream: true }));
      sse = rest;
      for (const e of events) {
        if (e === "[DONE]") continue;
        try {
          const d = JSON.parse(e).choices?.[0]?.delta?.content || "";
          if (d) { chrono.premierJeton(); texte += d; }
        } catch (_) { /* fragment non JSON */ }
      }
    }
  }
  return { ...chrono.fin(), texte };
}

const cfg = langConfig(LANGUE);
const system = buildTutorPrompt({ cfg, level: "debutant", scenarioId: "cafe", immersion: false, mode: "chat" });
const historique = [];
const tours = [];
try {
  for (let i = 0; i < TOURS; i++) {
    historique.push({ role: "user", content: REPLIQUES_ELEVE[i % REPLIQUES_ELEVE.length] });
    const r = await appel(historique, system, RESPONSE_SCHEMA, true);
    let reply = "";
    try { reply = JSON.parse(r.texte).reply || ""; } catch (_) { /* tour non JSON : compté quand même */ }
    historique.push({ role: "assistant", content: reply });
    tours.push({ premierJeton: r.premierJeton, total: r.total, json: !!reply });
  }
  const resume = await appel([...historique, { role: "user", content: summaryRequest({ cfg }) }], system, SUMMARY_SCHEMA, false);
  const pj = tours.map(t => t.premierJeton);
  const tot = tours.map(t => t.total);
  const ligne = {
    at: new Date().toISOString(), modele: MODELE, langue: LANGUE, tours,
    premierJetonMediane: centile(pj, 50), totalMediane: centile(tot, 50), totalP90: centile(tot, 90),
    resume: resume.total,
  };
  console.log(JSON.stringify(ligne));
  process.exit(ligne.premierJetonMediane >= SEUILS.tour.premierJeton ? 2 : 0);
} catch (err) {
  console.log(JSON.stringify({ at: new Date().toISOString(), modele: MODELE, erreur: err.message }));
  process.exit(1);
}
