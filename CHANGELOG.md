# Changelog

Tous les changements notables de ce projet sont consignés ici.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) — versionnage
[sémantique](https://semver.org/lang/fr/). Les tags git correspondants sont posés via les
Releases GitHub (commit de chaque version indiqué ci-dessous).

## [0.2.0] — 2026-08-16

### Added
- Neuf nouvelles langues aux côtés du catalan : espagnol, anglais (GB), allemand, suisse
  allemand, portugais (Portugal), portugais (Brésil), japonais, arabe standard, tunisien
  (#4)
- Sélecteur de langue sur l'écran d'accueil, registre central des langues (locales
  vocales, personas, options) (#4)
- Un tuteur par langue avec persona et prompts adaptés (pièges typiques pour un
  francophone, scénarios ancrés dans la ville du tuteur) (#5)
- Paramétrage vocal par langue (reconnaissance et synthèse) avec choix automatique de la
  meilleure voix disponible et matrice de support vocal affichée honnêtement (#6)
- Support droite-à-gauche pour l'arabe et le tunisien en écriture arabe (#7)
- Translittérations : rōmaji pour le japonais, translittération latine pour l'arabe,
  double écriture arabe/arabizi pour le tunisien (champ `reading` du schéma de réponse)
  (#8)
- Version de l'application affichée dans les réglages ; `CHANGELOG.md` et `ROADMAP.md`
  (#9, #10)
- Bouton « Nouvelle session » pour changer de langue ou de scénario

### Changed
- Renommage de l'application : « Parla! » devient « Polyglotte » (#3)
- Réglages : migration transparente de l'ancienne clé de stockage local

## [0.1.0] — 2026-08-16

Commit : `2d8ccc1` (base) puis correctifs `f47f4f5` (iOS), `3f0a748` (déploiement).

### Added
- Tuteur de catalan « Parla! » : conversation orale via Web Speech API (reconnaissance
  `ca-ES`, synthèse avec voix catalane et repli espagnol)
- Réponses structurées de Claude : réplique, traduction française, correction expliquée en
  français, suggestions de réponses cliquables
- Trois niveaux (A1–C1), sept scénarios de jeu de rôle, mode mains libres, résumé de
  session pédagogique
- Gestion de la clé API : proxy local `server.py` (clé côté serveur, `.env`) avec repli
  « clé dans le navigateur » pour l'hébergement statique
- Déploiement GitHub Pages automatique (branche `gh-pages` synchronisée par workflow)
- Déblocage de la synthèse vocale sur Safari iOS
