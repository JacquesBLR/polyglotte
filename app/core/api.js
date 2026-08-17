// Clients IA — iso-fonctionnels avec l'app v1, paramétrés par un objet settings pur :
// { provider: "claude"|"local", apiKey, model, localUrl, localKey, localModel, localModelAlt }
// Aucune dépendance UI ; utilisable sur web, iOS et Android (fetch standard).

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export function extractJson(text) {
  let t = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/g, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Le modèle n'a pas produit de JSON.");
  const candidate = t.slice(start, end + 1);
  JSON.parse(candidate); // valide, sinon lève
  return candidate;
}

export async function callClaude(settings, { messages, system, schema, maxTokens = 2048 }) {
  const model = settings.model || "claude-opus-5";
  const headers = {
    "content-type": "application/json",
    "x-api-key": settings.apiKey,
    "anthropic-version": "2023-06-01",
    // Nécessaire pour les appels navigateur (CORS) ; inoffensif en natif.
    "anthropic-dangerous-direct-browser-access": "true",
  };
  const body = { model, max_tokens: maxTokens, system, messages };
  if (model === "claude-opus-5") {
    headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
    body.fallbacks = "default";
  }
  const outputConfig = {};
  if (model !== "claude-haiku-4-5") outputConfig.effort = "low";
  if (schema) outputConfig.format = { type: "json_schema", schema };
  if (Object.keys(outputConfig).length) body.output_config = outputConfig;

  const resp = await fetch(ANTHROPIC_URL, { method: "POST", headers, body: JSON.stringify(body) });
  if (!resp.ok) {
    let detail = "";
    try { detail = (await resp.json()).error?.message || ""; } catch (_) {}
    if (resp.status === 401) throw new Error("Clé API invalide. Vérifie-la dans les réglages ⚙️.");
    if (resp.status === 429) throw new Error("Limite de requêtes atteinte. Attends un instant puis réessaie.");
    if (detail.includes("credit balance")) {
      throw new Error("Crédits API épuisés : recharge sur console.anthropic.com → Plans & Billing.");
    }
    throw new Error(`Erreur API (${resp.status})${detail ? " : " + detail : ""}`);
  }
  const data = await resp.json();
  if (data.stop_reason === "refusal") {
    throw new Error("La requête a été refusée par les filtres de sécurité du modèle. Reformule et réessaie.");
  }
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  if (!text) throw new Error("Réponse vide du modèle.");
  return text;
}

export async function callLocal(settings, { messages, system, schema, maxTokens = 2048, preferAlt = false }) {
  const base = (settings.localUrl || "").trim().replace(/\/+$/, "");
  const model = (preferAlt && settings.localModelAlt) || settings.localModel;

  const attempt = async (useStructured) => {
    const sys = schema && !useStructured
      ? system + "\n\nIMPORTANT : réponds UNIQUEMENT par un objet JSON valide conforme à ce schéma, sans texte autour :\n" + JSON.stringify(schema)
      : system;
    const body = {
      model,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: sys }, ...messages],
    };
    if (schema && useStructured) {
      body.response_format = { type: "json_schema", json_schema: { name: "reponse", schema, strict: true } };
    }
    const headers = { "content-type": "application/json" };
    if (settings.localKey) headers["authorization"] = "Bearer " + settings.localKey;
    let resp;
    try {
      resp = await fetch(base + "/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (_) {
      throw new Error("Serveur injoignable — vérifie l'URL (et le blocage HTTPS→HTTP si serveur local).");
    }
    if (!resp.ok) {
      let detail = "";
      try { detail = (await resp.json()).error?.message || ""; } catch (_) {}
      if (resp.status === 401 || resp.status === 403) {
        throw new Error("Clé API refusée par le serveur — vérifie-la dans les réglages ⚙️.");
      }
      const err = new Error(`Erreur du serveur (${resp.status})${detail ? " : " + detail : ""}.`);
      err.status = resp.status;
      throw err;
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || "";
    if (!text.trim()) throw new Error("Réponse vide du modèle.");
    return schema ? extractJson(text) : text;
  };

  try {
    return await attempt(true);
  } catch (err) {
    if (schema && [400, 404, 422].includes(err.status)) return attempt(false);
    throw err;
  }
}

export function callModel(settings, opts) {
  return settings.provider === "local" ? callLocal(settings, opts) : callClaude(settings, opts);
}

export function hasCredentials(settings) {
  if (settings.provider === "local") return !!settings.localUrl && !!settings.localModel;
  return !!settings.apiKey;
}
