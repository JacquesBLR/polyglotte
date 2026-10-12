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
  // Valide, sinon lève — en français : le message du moteur JS (« Expected ',' or ']'
  // after array element… ») finissait sous les yeux de l'élève (relecture du 12/10, T1).
  try { JSON.parse(candidate); } catch (_) { throw new Error("Le modèle a produit un JSON invalide — réessaie."); }
  return candidate;
}

// Réponse coupée par le plafond de jetons (#103 : plafonds par nature d'appel). Sans
// détection, une réplique tronquée finissait en « pas de JSON » ou en JSON brut affiché
// comme bilan (relecture du 12/10, T1 et T2). `partiel` : le texte reçu, pour qui veut en
// sauver quelque chose (le bilan lisible d'un résumé streamé).
export const MSG_TRONQUE = "La réponse du tuteur a été coupée avant la fin (trop longue) — réessaie.";
export function erreurTronquee(partiel = "") {
  const err = new Error(MSG_TRONQUE);
  err.tronque = true;
  err.partiel = partiel;
  return err;
}

// Consigne de JSON minifié (#103). Le décodage guidé laisse le modèle libre de ses blancs, et
// le résident les dépense : indentation et retours à la ligne faisaient ~30 % des jetons d'un
// tour (sondé le 12/10 sur le premier tour : 173 à 250 jetons indentés, 132 à 171 minifiés,
// à ~13 jetons/s). L'option `disable_any_whitespace` de vLLM 0.27 est restée sans effet ;
// la consigne suffit. Les sauts de ligne DANS les textes (bilan du résumé) restent permis.
export const CONSIGNE_JSON = "réponds UNIQUEMENT par un objet JSON valide, MINIFIÉ sur une seule ligne "
  + "(aucune indentation ni retour à la ligne entre les champs ; les sauts de ligne à l'intérieur "
  + "d'un texte restent écrits \\n), sans texte autour";

// Système envoyé au moteur compatible OpenAI pour une sortie structurée : la consigne de
// JSON minifié, suivie du schéma (qui guide aussi les serveurs sans décodage guidé).
export function systemeJson(system, schema) {
  return `${system}\n\nIMPORTANT : ${CONSIGNE_JSON}, conforme à ce schéma :\n${JSON.stringify(schema)}`;
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
  if (schema && data.stop_reason === "max_tokens") throw erreurTronquee(text);
  if (!text) throw new Error("Réponse vide du modèle.");
  return text;
}

// Un `fetch` qui échoue ne dit jamais pourquoi (la politique de même origine interdit au
// navigateur d'en dire plus) : le message énumère donc les causes réelles, par ordre de
// fréquence. Le moteur par défaut vit sur un réseau privé — hors de ce réseau, le nom
// d'hôte ne se résout même pas (#63).
export const MSG_INJOIGNABLE = "Serveur injoignable — es-tu bien connecté au réseau du serveur "
  + "(Tailscale / VPN) ? Sinon, vérifie l'URL dans les réglages ⚙️, et le blocage "
  + "HTTPS→HTTP si le serveur est en clair.";

export async function callLocal(settings, { messages, system, schema, maxTokens = 2048, preferAlt = false }) {
  const base = (settings.localUrl || "").trim().replace(/\/+$/, "");
  const model = (preferAlt && settings.localModelAlt) || settings.localModel;

  const attempt = async (useStructured) => {
    const sys = schema ? systemeJson(system, schema) : system;
    const body = {
      model,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: sys }, ...messages],
    };
    if (useStructured) {
      // Modèles « thinking » (Qwen3…) : évite qu'un raisonnement interne épuise le
      // budget de tokens (réponse vide) et dégrade la latence. Retiré dans le repli
      // pour les serveurs qui refusent les options inconnues (400).
      body.chat_template_kwargs = { enable_thinking: false };
    }
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
      throw new Error(MSG_INJOIGNABLE);
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
    if (schema && text.trim() && data.choices?.[0]?.finish_reason === "length") throw erreurTronquee(text);
    if (!text.trim()) throw new Error("Réponse vide du modèle.");
    return schema ? extractJson(text) : text;
  };

  try {
    return await attempt(true);
  } catch (err) {
    // Repli sans sortie structurée ni chat_template_kwargs : serveurs qui ne
    // connaissent pas response_format ou refusent les options inconnues.
    if ([400, 404, 422].includes(err.status)) return attempt(false);
    throw err;
  }
}

// Diagnostic du moteur compatible OpenAI : joignabilité, présence du modèle au
// catalogue, puis validation clé + modèle par un mini appel (quelques jetons).
// Retourne { ok, message } — n'échoue jamais par exception.
export async function testLocalConnection(settings) {
  const base = (settings.localUrl || "").trim().replace(/\/+$/, "");
  const model = (settings.localModel || "").trim();
  const key = (settings.localKey || "").trim();
  if (!base || !model) return { ok: false, message: "⚠️ Renseigne d'abord l'URL de base et le modèle." };
  const headers = key ? { authorization: "Bearer " + key } : {};
  try {
    let catalogueInfo = "";
    try {
      const resp = await fetch(base + "/models", { headers });
      if (resp.ok) {
        const ids = ((await resp.json()).data || []).map(m => m.id);
        catalogueInfo = ids.length ? ` (${ids.length} modèles au catalogue)` : "";
        if (ids.length && !ids.includes(model)) {
          return {
            ok: false,
            message: `⚠️ Serveur joignable${catalogueInfo}, mais le modèle « ${model} » n'y figure pas — vérifie l'orthographe exacte.`,
          };
        }
      }
    } catch (_) {
      throw new Error(MSG_INJOIGNABLE);
    }
    const resp = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: "user", content: "Réponds uniquement : OK" }] }),
    });
    if (resp.status === 401 || resp.status === 403) throw new Error("Clé API refusée — vérifie-la (et tes crédits).");
    if (!resp.ok) {
      let detail = "";
      try { detail = (await resp.json()).error?.message || ""; } catch (_) {}
      throw new Error(`Erreur ${resp.status}${detail ? " : " + detail.slice(0, 120) : ""}`);
    }
    const data = await resp.json();
    if (!data.choices?.[0]?.message) throw new Error("Réponse inattendue du serveur.");
    return { ok: true, message: `✅ Connexion, clé et modèle « ${model} » opérationnels${catalogueInfo}.` };
  } catch (err) {
    return { ok: false, message: "❌ " + err.message };
  }
}

export function callModel(settings, opts) {
  return settings.provider === "local" ? callLocal(settings, opts) : callClaude(settings, opts);
}

export function hasCredentials(settings) {
  if (settings.provider === "local") return !!settings.localUrl && !!settings.localModel;
  return !!settings.apiKey;
}
