// Rappels de révision — indisponibles sur le web (#37).
// Une PWA ne peut pas programmer de notification locale à date fixe sans un
// serveur de push : le réglage est simplement masqué côté web.
// Interface commune avec notify.native.js.

export const REMINDERS_SUPPORTED = false;

export async function requestPermission() {
  return false;
}

export async function cancelReminders() {}

export async function scheduleReminder(_deck, _now) {
  return null;
}
