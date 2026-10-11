// Réglages : profils, moteur IA (Claude / serveur OpenAI compatible), synthèse vocale.

import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import Constants from "expo-constants";

import { testLocalConnection } from "../core/api";
import { REMINDERS_SUPPORTED } from "../notify/notify";
import { DEFAULT_PROFILE } from "../storage";
import { forceUpdate } from "../pwa/pwa";
import { C, Chip, MARGE_BAS_FEUILLE, ui } from "./common";

// Version complète, injectée par app.json (extra.version) et contrôlée en CI comme
// identique à celle du package.json (#61) : un numéro qui mentirait serait pire que pas
// de numéro du tout.
const VERSION = Constants.expoConfig?.extra?.version || "inconnue";
// Le délogement n'a de sens que là où il y a un service worker.
const PEUT_DELOGER = Platform.OS === "web";

export default function SettingsModal({
  visible, settings, profiles, onClose, onSave,
  onSwitchProfile, onAddProfile, onDeleteProfile,
}) {
  const [draft, setDraft] = useState(settings);
  const [newProfile, setNewProfile] = useState("");
  const [adding, setAdding] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [testingVoice, setTestingVoice] = useState(false);
  const [voiceResult, setVoiceResult] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(settings);
      setTestResult("");
      setVoiceResult("");
      setAdding(false);
      setNewProfile("");
      setConfirmDelete(false);
    }
  }, [visible, settings]);

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  const runTest = async () => {
    setTesting(true);
    setTestResult("Test en cours…");
    const { message } = await testLocalConnection(draft);
    setTestResult(message);
    setTesting(false);
  };

  const testVoice = async () => {
    setTestingVoice(true);
    setVoiceResult("Test en cours…");
    try {
      const base = (draft.voiceUrl || "").trim().replace(/\/+$/, "");
      const h = await (await fetch(base + "/health")).json();
      const v = await (await fetch(base + "/voices")).json();
      const dispo = Object.values(v).filter(x => x.disponible).length;
      // L'état du service derja répond d'un coup d'œil à « pourquoi le tunisien n'a-t-il
      // pas la bonne voix ? » (#75) : sans lui, rien ne distingue un serveur qui lit en
      // tunisien d'un serveur qui retombe sur sa voix arabe.
      const derja = h.derja?.service ? ", voix tunisienne active" : "";
      setVoiceResult(`✅ Serveur joignable — Whisper « ${h.stt.modele} » (${h.stt.device}), ${dispo} voix Piper${derja}.`);
    } catch (_) {
      setVoiceResult("❌ Serveur vocal injoignable — vérifie l'URL (et le HTTPS depuis la PWA).");
    }
    setTestingVoice(false);
  };

  const addProfile = () => {
    const name = newProfile.trim();
    if (!name || name.includes("::") || profiles.list.includes(name)) {
      setTestResult("");
      setNewProfile("");
      setAdding(false);
      return;
    }
    onAddProfile(name);
    setNewProfile("");
    setAdding(false);
  };

  const isDefault = profiles.current === DEFAULT_PROFILE;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.overlay}>
        <View style={st.card} {...MARGE_BAS_FEUILLE}>
          <ScrollView contentContainerStyle={{ gap: 10 }}>
            <Text style={st.title}>⚙️ Réglages</Text>

            <Text style={ui.sectionTitle}>Profil</Text>
            <Text style={{ color: C.faint, fontSize: 12 }}>
              Chaque profil a ses propres réglages, carnet et historique — pratique pour partager
              l'appareil.
            </Text>
            <View style={ui.chipRow}>
              {profiles.list.map(name => (
                <Chip
                  key={name}
                  label={name}
                  active={profiles.current === name}
                  onPress={() => { if (name !== profiles.current) onSwitchProfile(name); }}
                />
              ))}
              <Chip label="＋ Nouveau" onPress={() => setAdding(a => !a)} />
            </View>
            {adding && (
              <View style={[ui.chipRow, { alignItems: "center" }]}>
                <TextInput
                  style={[ui.field, { flexGrow: 1 }]}
                  value={newProfile}
                  onChangeText={setNewProfile}
                  placeholder="Nom du profil"
                  placeholderTextColor={C.faint}
                  onSubmitEditing={addProfile}
                  autoFocus
                />
                <Chip label="Créer" active onPress={addProfile} />
              </View>
            )}
            {!isDefault && (
              confirmDelete ? (
                <View style={ui.chipRow}>
                  <Text style={[ui.label, { flexBasis: "100%" }]}>
                    Supprimer « {profiles.current} » et toutes ses données ?
                  </Text>
                  <Chip label="Annuler" onPress={() => setConfirmDelete(false)} />
                  <Pressable onPress={() => { setConfirmDelete(false); onDeleteProfile(profiles.current); }} style={st.dangerBtn}>
                    <Text style={st.dangerBtnText}>Supprimer</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setConfirmDelete(true)}>
                  <Text style={[ui.status, { color: C.error }]}>🗑️ Supprimer ce profil</Text>
                </Pressable>
              )
            )}

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
                <Pressable onPress={runTest} disabled={testing} style={[ui.secondaryBtn, testing && { opacity: 0.6 }]}>
                  <Text style={ui.secondaryBtnText}>🔌 Tester la connexion</Text>
                </Pressable>
                {!!testResult && <Text style={ui.status}>{testResult}</Text>}
              </>
            )}

            <Text style={ui.sectionTitle}>Serveur vocal (optionnel)</Text>
            <Text style={{ color: C.faint, fontSize: 12 }}>
              STT/TTS locaux (Whisper + Piper, ex. sur le DGX — voir serveur-vocal/) pour les
              langues au support vocal partiel : suisse allemand et tunisien. Micro en mode
              appuyer-parler-retoucher. Vide = moteurs du navigateur ou de l'appareil.
            </Text>
            <TextInput style={ui.field} value={draft.voiceUrl || ""} onChangeText={v => set("voiceUrl", v)} autoCapitalize="none" placeholder="https://…:8664 (vide = désactivé)" placeholderTextColor={C.faint} />
            {!!(draft.voiceUrl || "").trim() && (
              <Pressable onPress={testVoice} disabled={testingVoice} style={[ui.secondaryBtn, testingVoice && { opacity: 0.6 }]}>
                <Text style={ui.secondaryBtnText}>🎙️ Tester le serveur vocal</Text>
              </Pressable>
            )}
            {!!voiceResult && <Text style={ui.status}>{voiceResult}</Text>}

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

            <View style={st.switchRow}>
              <Text style={ui.label}>Révision : cartes inversées (français → langue cible, une sur deux)</Text>
              <Switch value={!!draft.reversedCards} onValueChange={v => set("reversedCards", v)} trackColor={{ true: C.primary }} />
            </View>

            {REMINDERS_SUPPORTED && (
              <View style={st.switchRow}>
                <Text style={ui.label}>Rappel quand des cartes sont à revoir (19 h, sur cet appareil)</Text>
                <Switch value={!!draft.reminders} onValueChange={v => set("reminders", v)} trackColor={{ true: C.primary }} />
              </View>
            )}

            <View style={st.piedVersion}>
              <Text style={st.version}>Polyglotte {VERSION}</Text>
              {PEUT_DELOGER && (
                <Pressable onPress={forceUpdate} style={st.majBtn}>
                  <Text style={st.majBtnText}>🔄 Forcer la mise à jour</Text>
                </Pressable>
              )}
            </View>
            {PEUT_DELOGER && (
              <Text style={st.majAide}>
                Vide le cache et recharge. Ton carnet, ton historique et tes profils sont conservés.
              </Text>
            )}

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
  piedVersion: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, gap: 10 },
  version: { color: C.muted, fontSize: 13 },
  majBtn: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: C.border },
  majBtnText: { color: C.text, fontWeight: "600", fontSize: 14 },
  majAide: { color: C.faint, fontSize: 12, marginTop: 6 },
  dangerBtn: { backgroundColor: C.error, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  dangerBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
