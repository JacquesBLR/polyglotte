// Rappels de révision — notifications locales (iOS / Android), #37.
// Aucune notification distante : tout est planifié sur l'appareil, donc sans
// serveur ni compte. Interface commune avec notify.web.js.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { nextReminder, reminderBody } from "../core/reminders";

export const REMINDERS_SUPPORTED = true;

// Identifiant de canal Android : les rappels sont discrets mais visibles.
const CHANNEL = "revisions";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let channelReady = false;
async function ensureChannel() {
  if (channelReady || Platform.OS !== "android") return;
  channelReady = true;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Rappels de révision",
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => {});
}

// Demande l'autorisation si elle n'a pas déjà été accordée ou refusée.
export async function requestPermission() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === "granted") return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.status === "granted";
  } catch (_) {
    return false;
  }
}

export async function cancelReminders() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (_) { /* rien de planifié */ }
}

/**
 * Replanifie le rappel du carnet : annule le précédent, pose le prochain.
 * Retourne l'échéance posée (`{ at, count }`) ou `null` si rien n'est planifié.
 */
export async function scheduleReminder(deck, now = Date.now()) {
  await cancelReminders();
  const prochain = nextReminder(deck, now);
  if (!prochain) return null;
  if (!(await requestPermission())) return null;
  await ensureChannel();
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🗂️ Polyglotte — c'est l'heure des révisions",
        body: reminderBody(prochain.count),
      },
      // `channelId` se déclare sur le déclencheur (ignoré hors Android).
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(prochain.at),
        channelId: CHANNEL,
      },
    });
    return prochain;
  } catch (_) {
    return null;
  }
}
