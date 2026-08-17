// Persistance JSON sur AsyncStorage (localStorage sur web via react-native-web).
// Profils multiples : chaque profil a ses propres réglages, carnet et historique.
// Le profil « défaut » utilise les clés historiques (aucune migration nécessaire) ;
// les autres profils suffixent leurs clés.

import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = {
  settings: "polyglotte.v2::settings",
  deck: "polyglotte.v2::deck",
  history: "polyglotte.v2::history",
};

export const PROFILES_KEY = "polyglotte.v2::profiles";
export const DEFAULT_PROFILE = "défaut";

// Clés du profil courant — `keysFor("marie").deck`, etc.
export function keysFor(profile) {
  const suffix = !profile || profile === DEFAULT_PROFILE ? "" : `::${profile}`;
  return {
    settings: BASE.settings + suffix,
    deck: BASE.deck + suffix,
    history: BASE.history + suffix,
  };
}

// Clés du profil par défaut — conservées pour la compatibilité des imports existants.
export const KEYS = keysFor(DEFAULT_PROFILE);

export async function loadJSON(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

export function saveJSON(key, value) {
  return AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
}

export async function loadProfiles() {
  const p = await loadJSON(PROFILES_KEY, null);
  if (p && Array.isArray(p.list) && p.list.length) return p;
  return { list: [DEFAULT_PROFILE], current: DEFAULT_PROFILE };
}

export function saveProfiles(profiles) {
  return saveJSON(PROFILES_KEY, profiles);
}

// Supprime toutes les données d'un profil (réglages, carnet, historique).
export async function removeProfileData(profile) {
  const k = keysFor(profile);
  await AsyncStorage.multiRemove([k.settings, k.deck, k.history]).catch(() => {});
}
