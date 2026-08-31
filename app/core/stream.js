// Streaming des réponses du moteur compatible OpenAI (#43) — fonctions pures +
// client SSE. Le tuteur parle phrase par phrase dès que chacune est complète,
// au lieu d'attendre la réponse entière.
//
// Réseau : fetch standard. Sur le web c'est le fetch du navigateur ; en natif,
// Expo SDK 57 installe `expo/fetch` (WinterCG) comme fetch global — dans les
// deux cas, `response.body` est un ReadableStream.

import { callLocal, extractJson } from "./api.js";

// ---------- Fonctions pures (testées dans tests/stream.test.mjs) ----------

// Extrait la valeur d'un champ chaîne d'un objet JSON en cours de réception.
// Retourne { text, complete } dès que `"field":` est suivi d'une chaîne
// (éventuellement tronquée), null si le champ n'est pas (encore) une chaîne.
export function partialStringField(buffer, field) {
  const key = `"${field}"`;
  let i = buffer.indexOf(key);
  if (i === -1) return null;
  i = buffer.indexOf(":", i + key.length);
  if (i === -1) return null;
  let j = i + 1;
  while (j < buffer.length && buffer[j] !== '"') {
    if (!" \t\n\r".includes(buffer[j])) return null; // autre type que chaîne (null, objet…)
    j++;
  }
  if (j >= buffer.length) return { text: "", complete: false }; // guillemet pas encore arrivé
  let out = "";
  for (let k = j + 1; k < buffer.length; k++) {
    const ch = buffer[k];
    if (ch === "\\") {
      const nxt = buffer[k + 1];
      if (nxt === undefined) break; // séquence d'échappement tronquée : on s'arrête là
      k++;
      if (nxt === "n") out += "\n";
      else if (nxt === "t") out += "\t";
      else if (nxt === "u") {
        const hex = buffer.slice(k + 1, k + 5);
        if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) break;
        out += String.fromCharCode(parseInt(hex, 16));
        k += 4;
      } else out += nxt; // \" \\ \/ …
    } else if (ch === '"') {
      return { text: out, complete: true };
    } else {
      out += ch;
    }
  }
  return { text: out, complete: false };
}

// Découpe le texte en phrases complètes + reste. Les terminateurs ASCII (.!?…؟)
// doivent être suivis d'une espace pour conclure une phrase (évite de couper
// « 3.5 » ou une réplique qui continue) ; les terminateurs pleine chasse (。！？)
// concluent immédiatement (pas d'espace en japonais).
const SENTENCE_RE = /(?:[.!?…؟]+["»”')\]]*\s+|[。！？]+["»”')\]]*)/u;

export function takeSentences(buffer) {
  const sentences = [];
  let rest = buffer;
  for (;;) {
    const m = SENTENCE_RE.exec(rest);
    if (!m) break;
    const end = m.index + m[0].length;
    const sentence = rest.slice(0, end).trim();
    if (sentence) sentences.push(sentence);
    rest = rest.slice(end);
  }
  return { sentences, rest };
}

// Accumule le texte du champ au fil du stream et appelle onSentence pour chaque
// phrase complète, une seule fois. flush() prononce le reliquat final.
export function createSentenceStreamer(onSentence) {
  let taken = 0;
  return {
    push(text) {
      const pending = text.slice(taken);
      const { sentences, rest } = takeSentences(pending);
      if (sentences.length) {
        taken += pending.length - rest.length;
        for (const s of sentences) onSentence(s);
      }
    },
    flush(text) {
      const tail = text.slice(taken).trim();
      taken = text.length;
      if (tail) onSentence(tail);
    },
  };
}

// Découpe un tampon SSE en événements `data:` complets. Retourne { events, rest }.
export function takeSseData(buffer) {
  const events = [];
  let rest = buffer;
  let idx;
  while ((idx = rest.indexOf("\n")) !== -1) {
    const line = rest.slice(0, idx).trim();
    rest = rest.slice(idx + 1);
    if (line.startsWith("data:")) events.push(line.slice(5).trim());
  }
  return { events, rest };
}

// ---------- Client streaming ----------

// Appel streaming du moteur compatible OpenAI. onDelta(texteAccumulé) est appelé
// à chaque fragment reçu. Retourne le texte complet (JSON extrait si schéma).
// Lève une erreur marquée `noStream` si le serveur refuse le mode streaming.
export async function streamLocalChat(settings, { messages, system, schema, maxTokens = 2048, onDelta }) {
  const base = (settings.localUrl || "").trim().replace(/\/+$/, "");
  const model = settings.localModel;
  const sys = schema
    ? system + "\n\nIMPORTANT : réponds UNIQUEMENT par un objet JSON valide conforme à ce schéma, sans texte autour :\n" + JSON.stringify(schema)
    : system;
  const body = {
    model,
    max_tokens: maxTokens,
    stream: true,
    messages: [{ role: "system", content: sys }, ...messages],
    // Modèles « thinking » (Qwen3…) : sans ceci, le raisonnement peut consommer tout
    // le budget de tokens et laisser la réponse vide — et il ruine la latence de
    // conversation. Les serveurs qui ignorent l'option ne sont pas affectés ; ceux
    // qui la refusent (400) déclenchent le repli callLocal sans l'option.
    chat_template_kwargs: { enable_thinking: false },
  };
  const headers = { "content-type": "application/json" };
  if (settings.localKey) headers["authorization"] = "Bearer " + settings.localKey;

  let resp;
  try {
    resp = await fetch(base + "/chat/completions", { method: "POST", headers, body: JSON.stringify(body) });
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
    err.noStream = [400, 404, 422, 501].includes(resp.status);
    throw err;
  }
  if (!resp.body || typeof resp.body.getReader !== "function") {
    const err = new Error("Pas de flux de réponse.");
    err.noStream = true;
    throw err;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let sse = "";
  let full = "";
  let reasoned = false;
  let finish = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    sse += decoder.decode(value, { stream: true });
    const { events, rest } = takeSseData(sse);
    sse = rest;
    for (const payload of events) {
      if (payload === "[DONE]") continue;
      try {
        const choice = JSON.parse(payload).choices?.[0] || {};
        if (choice.delta?.reasoning_content) reasoned = true;
        finish = choice.finish_reason || finish;
        const delta = choice.delta?.content || "";
        if (delta) {
          full += delta;
          if (onDelta) onDelta(full);
        }
      } catch (_) { /* fragment non JSON : ignoré */ }
    }
  }
  if (!full.trim()) {
    throw new Error(reasoned || finish === "length"
      ? "Le modèle a épuisé ses tokens en « réflexion » sans répondre — réessaie, ou choisis un modèle sans raisonnement."
      : "Réponse vide du modèle.");
  }
  return schema ? extractJson(full) : full;
}

// Streaming si possible, sinon repli transparent sur l'appel classique
// (serveurs sans SSE, erreurs de format) — même signature de retour que callLocal.
export async function streamOrCallLocal(settings, opts) {
  try {
    return await streamLocalChat(settings, opts);
  } catch (err) {
    if (err.noStream) return callLocal(settings, opts);
    throw err;
  }
}
