// Thème et petits composants partagés entre les écrans.

import { Pressable, StyleSheet, Text } from "react-native";

export const C = {
  primary: "#c2410c",
  bg: "#faf7f2",
  card: "#fff",
  border: "#e7e5e4",
  text: "#1c1917",
  muted: "#78716c",
  faint: "#a8a29e",
  error: "#b91c1c",
  ok: "#15803d",
};

export function Chip({ label, active, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[ui.chip, active && ui.chipActive, disabled && { opacity: 0.5 }]}>
      <Text style={[ui.chipText, active && ui.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export const ui = StyleSheet.create({
  chip: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: "#44403c", fontSize: 14 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: C.muted, textTransform: "uppercase", marginTop: 10 },
  label: { color: "#44403c", fontSize: 14, flexShrink: 1 },
  field: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, fontSize: 15, color: C.text, backgroundColor: C.card },
  status: { paddingVertical: 4, color: C.muted, fontSize: 13 },
  statusError: { color: C.error },
  primaryBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryBtn: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  secondaryBtnText: { color: "#44403c", fontSize: 15, fontWeight: "600" },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, gap: 8 },
});
