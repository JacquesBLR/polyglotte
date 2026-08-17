// Grammaire & conjugaison : fiches pédagogiques et cartes mentales (portage v1 #19/#20).

import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { G, Path, Rect, Text as SvgText } from "react-native-svg";

import { callModel, hasCredentials } from "../core/api";
import { grammarSystemPrompt } from "../core/prompts";
import { GRAMMAR_FICHE_SCHEMA, GRAMMAR_MAP_SCHEMA } from "../core/schemas";
import { C, Chip, ui } from "./common";

const SUGGESTED_TOPICS = [
  "Le présent de l'indicatif",
  "Le passé : raconter hier",
  "Les articles",
  "Poser une question",
  "La négation",
];

// Disposition d'un arbre horizontal (racine à gauche) — même algorithme que la v1 :
// liste plate id/parent, profondeur bornée à 3, protection contre les cycles.
function layoutMindmap(nodes) {
  const COL_W = 200, ROW_H = 46, PAD = 14;
  const children = new Map([[0, []]]);
  for (const n of nodes) if (!children.has(n.id)) children.set(n.id, []);
  for (const n of nodes) {
    const parent = children.has(n.parent) ? n.parent : 0;
    children.get(parent).push(n);
  }
  const byId = new Map(nodes.map(n => [n.id, n]));
  const pos = new Map();
  let leaf = 0, maxDepth = 0;
  const visited = new Set();
  function layout(id, depth) {
    if (visited.has(id)) return leaf;
    visited.add(id);
    maxDepth = Math.max(maxDepth, depth);
    const kids = (children.get(id) || []).slice(0, 8);
    if (!kids.length || depth >= 3) { pos.set(id, { depth, row: leaf }); return leaf++; }
    const rows = kids.map(k => layout(k.id, depth + 1));
    const row = (Math.min(...rows) + Math.max(...rows)) / 2;
    pos.set(id, { depth, row });
    return row;
  }
  layout(0, 0);
  return {
    pos, byId, children, visited,
    width: (maxDepth + 1) * COL_W + PAD * 2,
    height: Math.max(leaf, 1) * ROW_H + PAD * 2,
    x: d => PAD + d * COL_W,
    y: r => PAD + r * ROW_H + ROW_H / 2,
  };
}

const DEPTH_FILL = { 0: C.primary, 1: "#ffedd5", 2: "#fff", 3: "#fff" };

function Mindmap({ title, nodes, onSelectNote }) {
  const L = layoutMindmap(nodes);
  const links = [], boxes = [];

  for (const id of L.visited) {
    if (id === 0) continue;
    const n = L.byId.get(id);
    if (!n) continue;
    const parentId = L.children.has(n.parent) && L.visited.has(n.parent) ? n.parent : 0;
    const a = L.pos.get(parentId), b = L.pos.get(id);
    if (!a || !b) continue;
    const x1 = L.x(a.depth) + 150, y1 = L.y(a.row), x2 = L.x(b.depth), y2 = L.y(b.row);
    links.push(
      <Path
        key={`l${id}`}
        d={`M ${x1} ${y1} C ${x1 + 28} ${y1}, ${x2 - 28} ${y2}, ${x2} ${y2}`}
        stroke="#d6d3d1"
        strokeWidth={1.5}
        fill="none"
      />
    );
  }

  const drawNode = (id, label, note) => {
    const p = L.pos.get(id);
    if (!p) return;
    const textW = Math.min(24, Math.max(6, label.length)) * 7.2 + 18;
    const shown = label.length > 26 ? label.slice(0, 25) + "…" : label;
    const root = id === 0;
    boxes.push(
      <G key={`n${id}`} onPress={note || root ? () => onSelectNote(root ? null : { label, note }) : undefined}>
        <Rect
          x={L.x(p.depth)}
          y={L.y(p.row) - 15}
          width={textW}
          height={30}
          rx={9}
          fill={DEPTH_FILL[p.depth] || "#fff"}
          stroke={root ? C.primary : C.border}
          strokeWidth={1.2}
        />
        <SvgText
          x={L.x(p.depth) + textW / 2}
          y={L.y(p.row) + 4}
          textAnchor="middle"
          fontSize={13}
          fontWeight={root ? "700" : "400"}
          fill={root ? "#fff" : C.text}
        >
          {shown}
        </SvgText>
      </G>
    );
  };

  drawNode(0, title, null);
  for (const id of L.visited) {
    if (id === 0) continue;
    const n = L.byId.get(id);
    if (n) drawNode(id, n.label, n.note);
  }

  return (
    <ScrollView horizontal style={{ maxHeight: Math.min(L.height + 10, 460) }}>
      <ScrollView>
        <Svg width={L.width} height={L.height} viewBox={`0 0 ${L.width} ${L.height}`}>
          {links}
          {boxes}
        </Svg>
      </ScrollView>
    </ScrollView>
  );
}

export default function GrammarScreen({ settings, cfg, level, onOpenSettings }) {
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState({ text: "", error: false });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { kind, title, content?, nodes? }
  const [note, setNote] = useState(null);

  const request = async (kind) => {
    const t = topic.trim();
    if (!t) { setStatus({ text: "Indique d'abord un sujet.", error: true }); return; }
    if (!hasCredentials(settings)) {
      onOpenSettings();
      setStatus({ text: "Configure d'abord ton moteur IA dans les réglages.", error: true });
      return;
    }
    setBusy(true);
    setResult(null);
    setNote(null);
    setStatus({ text: kind === "map" ? "Construction de la carte mentale…" : "Rédaction de la fiche…", error: false });
    try {
      const raw = await callModel(settings, {
        messages: [{
          role: "user",
          content: kind === "map"
            ? `Construis une carte mentale pédagogique sur : ${t}`
            : `Rédige une fiche pédagogique complète sur : ${t}`,
        }],
        system: grammarSystemPrompt({ cfg, level }),
        schema: kind === "map" ? GRAMMAR_MAP_SCHEMA : GRAMMAR_FICHE_SCHEMA,
        maxTokens: 4096,
        preferAlt: true,
      });
      const parsed = JSON.parse(raw);
      setResult({ kind, ...parsed });
      setStatus({ text: "", error: false });
    } catch (err) {
      setStatus({ text: err.message, error: true });
    }
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={st.body}>
      <Text style={ui.sectionTitle}>Sujet ({cfg.label})</Text>
      <TextInput
        style={ui.field}
        value={topic}
        onChangeText={setTopic}
        placeholder="Ex. : le passé, les articles, conjugaison de « être »…"
        placeholderTextColor={C.faint}
        onSubmitEditing={() => request("fiche")}
      />
      <View style={ui.chipRow}>
        {SUGGESTED_TOPICS.map(s => <Chip key={s} label={s} active={topic === s} onPress={() => setTopic(s)} />)}
      </View>
      <View style={[ui.chipRow, { marginTop: 10 }]}>
        <Pressable onPress={() => request("fiche")} disabled={busy} style={[ui.primaryBtn, st.grow]}>
          <Text style={ui.primaryBtnText}>📄 Fiche</Text>
        </Pressable>
        <Pressable onPress={() => request("map")} disabled={busy} style={[ui.secondaryBtn, st.grow]}>
          <Text style={ui.secondaryBtnText}>🧠 Carte mentale</Text>
        </Pressable>
      </View>
      {!!status.text && <Text style={[ui.status, status.error && ui.statusError]}>{status.text}</Text>}
      {result && (
        <View style={[ui.card, { marginTop: 10 }]}>
          <Text style={st.title}>{result.title}</Text>
          {result.kind === "fiche" ? (
            <Text style={st.content}>{result.content}</Text>
          ) : (
            <>
              <Mindmap title={result.title} nodes={result.nodes} onSelectNote={setNote} />
              <Text style={ui.status}>
                {note ? `💡 ${note.label} — ${note.note}` : "Touche un nœud pour voir son détail."}
              </Text>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  body: { padding: 16, gap: 8 },
  grow: { flexGrow: 1, paddingHorizontal: 16 },
  title: { fontSize: 17, fontWeight: "700", color: C.text },
  content: { fontSize: 15, color: "#44403c", lineHeight: 23, fontVariant: ["tabular-nums"] },
});
