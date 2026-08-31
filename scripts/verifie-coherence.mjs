/* Vérifications de cohérence du dépôt, exécutées en CI.
 * Garde-fous nés du renommage hello-world → polyglotte (#38) : une URL de base
 * périmée ne casse rien à la construction, mais rend l'app publiée inutilisable. */

import { readFileSync } from "node:fs";

const DEPOT = "polyglotte";
const erreurs = [];

function verifie(intitule, condition, detail) {
  if (condition) console.log(`  ✅ ${intitule}`);
  else erreurs.push(`${intitule} — ${detail}`);
}

// 1. L'URL de base de la v2 doit suivre le nom du dépôt (chemin GitHub Pages).
// Depuis la bascule #42, la v2 est servie à la racine du site.
const appJson = JSON.parse(readFileSync("app/app.json", "utf8"));
const baseUrl = appJson.expo?.experiments?.baseUrl;
verifie(
  "app/app.json : baseUrl alignée sur le dépôt (v2 à la racine)",
  baseUrl === `/${DEPOT}`,
  `attendu "/${DEPOT}", trouvé ${JSON.stringify(baseUrl)}`,
);

// 1 bis. La redirection de l'ancien emplacement /v2/ pointe vers la racine.
const redirection = readFileSync("redirects/v2/index.html", "utf8");
verifie(
  "redirects/v2 : redirection vers la racine du site",
  redirection.includes(`url=/${DEPOT}/`),
  `ne contient pas "url=/${DEPOT}/"`,
);

// 2. Plus aucune trace de l'ancien nom hors documents d'historique.
const suspects = [
  "app/app.json",
  "app/public/sw.js",
  "app/public/index.html",
  "index.html",
  "js/app.js",
  "sw.js",
  "manifest.webmanifest",
  ".github/workflows/deploy-pages.yml",
  ".github/workflows/ci.yml",
];
for (const fichier of suspects) {
  let contenu;
  try {
    contenu = readFileSync(fichier, "utf8");
  } catch {
    continue; // fichier optionnel
  }
  verifie(
    `${fichier} : aucune référence à l'ancien nom du dépôt`,
    !contenu.includes("hello-world"),
    "contient encore « hello-world »",
  );
}

// 3. Le cache du service worker v1 suit APP_VERSION (invariant documenté dans sw.js).
const versionV1 = readFileSync("js/app.js", "utf8").match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1];
const cacheV1 = readFileSync("sw.js", "utf8").match(/CACHE\s*=\s*"([^"]+)"/)?.[1];
verifie(
  "sw.js : nom de cache v1 synchronisé avec APP_VERSION",
  Boolean(versionV1) && cacheV1 === `polyglotte-shell-v${versionV1}`,
  `APP_VERSION=${versionV1}, cache=${cacheV1}`,
);

if (erreurs.length) {
  console.error("\n❌ Incohérences détectées :");
  for (const e of erreurs) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("\n✅ Dépôt cohérent.");
