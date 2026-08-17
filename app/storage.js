// Persistance JSON sur AsyncStorage (localStorage sur web via react-native-web).

import AsyncStorage from "@react-native-async-storage/async-storage";

export const KEYS = {
  settings: "polyglotte.v2::settings",
  deck: "polyglotte.v2::deck",
  history: "polyglotte.v2::history",
};

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
