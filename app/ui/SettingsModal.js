// Réglages : moteur IA (Claude / serveur OpenAI compatible) et synthèse vocale.

import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { C, Chip, ui } from "./common";

export default function SettingsModal({ visible, settings, onClose, onSave }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => { if (visible) setDraft(settings); }, [visible]);
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.overlay}>
        <View style={st.card}>
          <ScrollView contentContainerStyle={{ gap: 10 }}>
            <Text style={st.title}>⚙️ Réglages</Text>
            <Text style={ui.sectionTitle}>Moteur IA</Text>
            <View style={ui.chipRow}>
              <Chip label="Claude (Anthropic)" active={draft.provider === "claude"} onPress={() => set("provider", "claude")} />
              <Chip label="Serveur local / Nous" active={draft.provider === "local"} onPress={() => set("provider", "local")} />
            </View>
            {draft.provider === "claude" ? (
              <>
                <Text style={ui.label}>Clé API Anthropic</Text>
                <TextInput style={ui.field} value={draft.apiKey} onChangeText={v => set("apiKey", v)} secureTextEntry autoCapitalize="none" placeholder="sk-ant-…" placeholderTextColor={C.faint} />
              </>
            ) : (
              <>
                <Text style={ui.label}>URL du serveur (compatible OpenAI)</Text>
                <TextInput style={ui.field} value={draft.localUrl} onChangeText={v => set("localUrl", v)} autoCapitalize="none" placeholder="https://inference-api.nousresearch.com/v1" placeholderTextColor={C.faint} />
                <Text style={ui.label}>Clé API (si requise)</Text>
                <TextInput style={ui.field} value={draft.localKey} onChangeText={v => set("localKey", v)} secureTextEntry autoCapitalize="none" />
                <Text style={ui.label}>Modèle principal</Text>
                <TextInput style={ui.field} value={draft.localModel} onChangeText={v => set("localModel", v)} autoCapitalize="none" placeholder="anthropic/claude-sonnet-4.6" placeholderTextColor={C.faint} />
                <Text style={ui.label}>Modèle secondaire (fiches, résumés)</Text>
                <TextInput style={ui.field} value={draft.localModelAlt} onChangeText={v => set("localModelAlt", v)} autoCapitalize="none" placeholder="openai/gpt-oss-120b" placeholderTextColor={C.faint} />
              </>
            )}
            <View style={st.switchRow}>
              <Text style={ui.label}>Lire les réponses à voix haute</Text>
              <Switch value={draft.autospeak} onValueChange={v => set("autospeak", v)} trackColor={{ true: C.primary }} />
            </View>
            <Text style={ui.label}>Vitesse de lecture</Text>
            <View style={ui.chipRow}>
              {[[0.7, "Lente"], [0.85, "Posée"], [1, "Normale"]].map(([r, label]) => (
                <Chip key={label} label={label} active={draft.rate === r} onPress={() => set("rate", r)} />
              ))}
            </View>
            <View style={[ui.chipRow, { justifyContent: "flex-end", marginTop: 8 }]}>
              <Pressable onPress={onClose} style={st.cancelBtn}><Text style={{ color: C.muted, fontSize: 16 }}>Annuler</Text></Pressable>
              <Pressable onPress={() => { onSave(draft); onClose(); }} style={st.saveBtn}>
                <Text style={ui.primaryBtnText}>Enregistrer</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  card: { backgroundColor: C.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, maxHeight: "88%" },
  title: { fontSize: 18, fontWeight: "700", color: C.text },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 10 },
  cancelBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  saveBtn: { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
});
