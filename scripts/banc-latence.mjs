#!/usr/bin/env node
/* Banc de latence du tuteur (#98, #103).
 *
 * Rejoue N tours de conversation tels que l'app les envoie (prompt du tuteur, schéma du tour
 * allégé, plafond de jetons, streaming, thinking désactivé, missions réinjectées après le
 * [START]), puis un résumé de séance streamé, contre la passerelle gw du parc, et imprime une
 * ligne JSON : par tour, temps au premier jeton, à la réplique complète (ce que l'élève
 * attend) et total, jetons produits ; médianes et p90.
 *
 *   node scripts/banc-latence.mjs [--tours 10] [--langue catalan] [--schema allege|complet]
 *   GW_URL (défaut http://127.0.0.1:8646/v1), GW_MODELE (défaut qwen3.8-nvfp4)
 *
 * `--schema complet` rejoue la requête d'avant #103 (RESPONSE_SCHEMA entier, 2 048 jetons, sans
 * consigne de JSON minifié),
 * pour une comparaison avant/après dans les mêmes conditions de charge.
 *
 * Chaque appel porte `X-Atelier-Backend: vllm` et `X-Atelier-Projet: polyglotte` (coût imputé
 * au projet, pas d'escalade vers un backend commercial). Aucun secret lu ni écrit.
 *
 * Exécution de nuit : `.github/workflows/banc-latence.yml`, sur un runner self-hosted du
 * réseau privé (gw n'est pas joignable d'ubuntu-latest), DÉSARMÉ tant que la variable de
 * dépôt `BANC_LATENCE_ARME` ne vaut pas `true`. Code de sortie 2 si la médiane du premier
 * jeton dépasse le seuil d'alerte de l'app (SEUILS.tour), 1 si gw ne répond pas.
 */
import { buildTutorPrompt, summaryRequest } from "../app/core/prompts.js";
import { langConfig } from "../app/core/languages.js";
import { MAX_TOKENS, RESPONSE_SCHEMA, SUMMARY_SCHEMA, schemaResume, schemaTour } from "../app/core/schemas.js";
import { missionsValides } from "../app/core/mission.js";
import { SEUILS, centile, creeChrono } from "../app/core/latence.js";
import { partialStringField, takeSseData } from "../app/core/stream.js";
import { systemeJson } from "../app/core/api.js";

const arg = (nom, defaut) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i > -1 ? process.argv[i + 1] : defaut;
};
const BASE = (process.env.GW_URL || "http://127.0.0.1:8646/v1").replace(/\/+$/, "");
const MODELE = process.env.GW_MODELE || "qwen3.8-nvfp4";
const TOURS = Math.max(1, Number(arg("tours", 4)) || 4);
const LANGUE = arg("langue", "catalan");
const COMPLET = arg("schema", "allege") === "complet";
const ENTETES = {
  "content-type": "application/json",
  "X-Atelier-Backend": "vllm",
  "X-Atelier-Projet": "polyglotte",
};
const REPLIQUES_ELEVE = [
  "[START]", "Hola, vull un cafè amb llet, si us plau.", "Quant costa?", "Jo vull també un croissant de xocolata.",
  "On és el lavabo?", "Tinc una taula per dues persones?", "El cafè és molt calent, gràcies.",
  "Puc pagar amb targeta?", "Quina hora tanqueu avui?", "Gràcies, adéu!",
];

// Même requête que l'app (core/stream.js) : schéma recopié dans le système, décodage guidé.
async function appel(messages, system, schema, maxTokens, champ) {
  const chrono = creeChrono();
  const body = {
    model: MODELE, max_tokens: maxTokens, stream: true, stream_options: { include_usage: true },
    messages: [{
      role: "system",
      content: COMPLET
        ? system + "\n\nIMPORTANT : réponds UNIQUEMENT par un objet JSON valide conforme à ce schéma, sans texte autour :\n" + JSON.stringify(schema)
        : systemeJson(system, schema),
    }, ...messages],
    chat_template_kwargs: { enable_thinking: false },
    response_format: { type: "json_schema", json_schema: { name: "reponse", schema, strict: true } },
  };
  const r = await fetch(BASE + "/chat/completions", { method: "POST", headers: ENTETES, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`gw ${r.status} : ${(await r.text()).slice(0, 200)}`);
  let texte = "";
  let jetons = null;
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
        const j = JSON.parse(e);
        if (j.usage?.completion_tokens) jetons = j.usage.completion_tokens;
        const d = j.choices?.[0]?.delta?.content || "";
        if (d) {
          chrono.premierJeton();
          texte += d;
          if (partialStringField(texte, champ)?.complete) chrono.replique();
        }
      } catch (_) { /* fragment non JSON */ }
    }
  }
  return { ...chrono.fin(), jetons, texte };
}

const cfg = langConfig(LANGUE);
const ctx = { cfg, level: "debutant", scenarioId: "cafe", immersion: false, mode: "chat" };
let system = buildTutorPrompt(ctx);
let missions = [];
const historique = [];
const tours = [];
try {
  for (let i = 0; i < TOURS; i++) {
    historique.push({ role: "user", content: REPLIQUES_ELEVE[i % REPLIQUES_ELEVE.length] });
    const schema = COMPLET ? RESPONSE_SCHEMA : schemaTour({ lecture: !!cfg.reading, nbMissions: missions.length });
    const r = await appel(historique, system, schema, COMPLET ? 2048 : MAX_TOKENS.tour, "reply");
    let data = null;
    try { data = JSON.parse(r.texte); } catch (_) { /* tour non JSON : compté quand même */ }
    if (data && !missions.length) {
      missions = missionsValides(data.missions);
      if (missions.length) system = buildTutorPrompt({ ...ctx, missions });
    }
    historique.push({ role: "assistant", content: data?.reply || "" });
    tours.push({ premierJeton: r.premierJeton, replique: r.replique ?? null, total: r.total, jetons: r.jetons, json: !!data?.reply });
  }
  const resume = await appel([...historique, { role: "user", content: summaryRequest({ cfg }) }], system,
    COMPLET ? SUMMARY_SCHEMA : schemaResume({ lecture: !!cfg.reading }),
    COMPLET ? 2048 : MAX_TOKENS.resume, "texte");
  const med = (cle) => centile(tours.map(t => t[cle]), 50);
  const ligne = {
    at: new Date().toISOString(), modele: MODELE, langue: LANGUE, schema: COMPLET ? "complet" : "allege", tours,
    premierJetonMediane: med("premierJeton"), repliqueMediane: med("replique"), totalMediane: med("total"),
    totalP90: centile(tours.map(t => t.total), 90), jetonsMediane: med("jetons"),
    resume: { premierJeton: resume.premierJeton, texte: resume.replique ?? null, total: resume.total, jetons: resume.jetons },
  };
  console.log(JSON.stringify(ligne));
  process.exit(ligne.premierJetonMediane >= SEUILS.tour.premierJeton ? 2 : 0);
} catch (err) {
  console.log(JSON.stringify({ at: new Date().toISOString(), modele: MODELE, erreur: err.message }));
  process.exit(1);
}
