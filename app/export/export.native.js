// Export de fichier — natif : écriture dans le cache puis feuille de partage
// (AirDrop, Fichiers, Mail…). API expo-file-system SDK 54+ (File / Paths).

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

export async function saveTextFile(filename, content) {
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) {
    return `Fichier écrit : ${file.uri}`;
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/plain",
    dialogTitle: "Exporter le carnet de vocabulaire",
    UTI: "public.plain-text",
  });
  return "Export partagé.";
}
