# polyglotte — consignes projet

Apprentissage des langues pour francophones, centré sur la **conversation orale avec un
tuteur IA** (l'élève parle au micro, le tuteur répond à son niveau, corrige, lit à voix
haute). Deux artefacts coexistent dans le repo :

- **la webapp statique** (racine : `index.html`, `js/`, `css/`, `sw.js`), publiée sur
  GitHub Pages — `jacquesblr.github.io/polyglotte` ;
- **`app/` : l'app universelle Expo** (aperçu servi sous `/v2/`).

## Garde de version — `app/` uniquement

`app/` est une app **Expo SDK 57**, dont les API ont changé : avant d'écrire du code dans
`app/`, lire les docs versionnées `https://docs.expo.dev/versions/v57.0.0/` — ne pas se
fier à sa connaissance d'Expo. (Cette règle était portée par `app/AGENTS.md`, généré par
l'outillage Expo ; elle vit désormais ici pour que tout agent la voie depuis la racine.
Elle ne s'applique **pas** à la webapp statique.)

## Le tuteur sans API

Le principe économique du projet : la conversation passe par **l'abonnement Claude**,
jamais par des crédits API. La variante « Projet claude.ai » est documentée dans
`claude-project-nuria.md` (Núria, tutrice de catalan — immersion totale, corrections par
reformulation, français uniquement sur demande) : c'est un document utilisateur à coller
dans claude.ai, pas du code.

## Conventions

Feuille de route dans `ROADMAP.md`, journal dans `CHANGELOG.md` (Keep a Changelog).
Webapp : PWA (manifest + service worker) — tester le rendu au navigateur, pas seulement
au serveur.
