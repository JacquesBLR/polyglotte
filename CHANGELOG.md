# Changelog

Tous les changements notables de ce projet sont consignés ici.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) — versionnage
[sémantique](https://semver.org/lang/fr/). Les tags git correspondants sont posés via les
Releases GitHub (commit de chaque version indiqué ci-dessous).

## [2.0.0-alpha.5] — 2026-08-31

Outillage avant la bascule v2 : tests unitaires du cœur, releases automatiques, gel de la
v1 (#41, #39).

### Added
- Tests unitaires (`node --test`, sans dépendance) du cœur partagé `app/core` — Leitner,
  notation LCS des dictées, registre des langues, prompts, extraction JSON, schémas —
  dans `tests/`, exécutés en CI avant la construction (#41)
- `release.yml` : à la fusion dans `main`, si la version en tête du CHANGELOG n'a pas
  encore de release GitHub, création automatique du tag `vX.Y.Z` et de la release
  (notes = section du CHANGELOG, pré-release si la version contient un tiret) (#39)

### Changed
- **v1 gelée** : la webapp statique (racine) ne reçoit plus que des correctifs ; toute
  nouveauté va dans la v2 (`app/`). La bascule `/v2/` → racine est suivie dans #42
  (ROADMAP, README)
- Décision #39 : l'hébergement reste sur GitHub Pages (site 100 % statique, rien à
  héberger côté serveur) ; pas de runner self-hosted — la partie release de la
  convention est automatisée sur `ubuntu-latest`
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-alpha.5`

## [2.0.0-alpha.4] — 2026-08-25

Normalisation du dépôt après le renommage `hello-world` → `polyglotte` du 21/08/2026 (#38).

### Fixed
- **L'aperçu v2 publié était inutilisable** : le dépôt renommé, GitHub Pages sert désormais
  le site sous `/polyglotte/`, mais la v2 avait été construite avec
  `experiments.baseUrl = "/hello-world/v2"` — la page se chargeait (200) et son bundle
  JavaScript renvoyait 404, donc un écran blanc. `baseUrl` suit maintenant le nom du
  dépôt (#38)

### Added
- `ci.yml` (`on: pull_request`, `ubuntu-latest`) : cohérence du dépôt, syntaxe de l'app v1
  et du proxy local, construction de la v2 en web et vérification que les actifs produits
  pointent bien vers `/polyglotte/v2/` (#38)
- `scripts/verifie-coherence.mjs` : garde-fou contre le retour de ce bug — vérifie
  `baseUrl`, l'absence de référence à l'ancien nom du dépôt et la synchronisation du nom
  de cache du service worker v1 avec `APP_VERSION` (#38)

### Changed
- Branche par défaut `main`, contenant l'intégralité du projet (elle n'hébergeait jusqu'ici
  que le README « hello-world » d'origine) ; `deploy-pages.yml` publie désormais à la
  fusion dans `main` et non plus sur l'ancienne branche de travail (#38)
- Cache du service worker v2 en `polyglotte-v2-shell-2.0.0-alpha.4` ; portée documentée
  en `/polyglotte/v2/` (#38)
- `app/package.json` aligné sur la version de l'application (il était resté en `1.0.0`) (#38)
- README : URL publiée ; ROADMAP : méthode de travail `main` + PR + CI (#38)

## [2.0.0-alpha.3] — 2026-08-17

Fin de la parité fonctionnelle de la v2 côté web (#36). Vérifié en navigateur réel
(Chromium pilote l'export : rendu des écrans, création et persistance d'un profil,
aucune erreur console).

### Added
- Profils multiples : réglages, carnet et historique séparés par profil ; création,
  bascule et suppression (avec confirmation) depuis les réglages. Le profil « défaut »
  garde les clés de stockage historiques (#36)
- Bouton « 🔌 Tester la connexion » du moteur compatible OpenAI, porté de la v1 :
  joignabilité, présence du modèle au catalogue, puis validation clé + modèle (#36)
- Export du carnet au format Anki : téléchargement du fichier sur web, écriture puis
  feuille de partage en natif (`expo-file-system` API SDK 54+ et `expo-sharing`) (#36)
- PWA v2 installable : gabarit `public/index.html` (manifeste, thème, métadonnées
  Apple), `manifest.webmanifest`, icônes et service worker propres à la v2
  (cache `polyglotte-v2-shell-2.0.0-alpha.3`, portée `/v2/` — la portée la plus
  spécifique l'emporte sur le service worker de la v1) (#36)

## [2.0.0-alpha.2] — 2026-08-17

Deuxième jalon v2 : l'aperçu Expo rejoint les fonctionnalités principales de la v1 (#36, en cours).

### Added
- 🎓 Test de niveau CECRL dans l'écran de conversation (mode évaluation, schéma dédié),
  avec bouton « Adopter ce niveau » qui règle l'app sur le niveau estimé (#36)
- 🧠 Écran Grammaire : fiches pédagogiques et cartes mentales SVG (react-native-svg,
  même algorithme de disposition que la v1 ; les info-bulles deviennent des nœuds
  tapotables qui affichent leur détail sous la carte) (#36)
- ✍️ Écran Exercices : dictée et prononciation, 5 phrases par série, notation mot à
  mot LCS avec surlignage des jetons trouvés/manqués (japonais par caractère) (#36)
- 📊 Écran Progrès : statistiques (sessions, jours d'affilée, carnet, à réviser),
  pratique par langue, carnet de vocabulaire (écoute, suppression) et révision
  Leitner (boîtes 1-5) (#36)
- Historique des sessions persisté (AsyncStorage) pour les statistiques et la série
  de jours (#36)

### Changed
- App.js découpé : écrans dans `app/ui/` (common, SettingsModal, GrammarScreen,
  ExercisesScreen, ProgressScreen) + `app/storage.js` (persistance JSON)

## [2.0.0-alpha.1] — 2026-08-17

Premier jalon de la migration vers une application universelle **Expo / React Native**
(iOS, Android et web via react-native-web), publiée en aperçu à côté de l'app v1 sur
`https://jacquesblr.github.io/hello-world/v2/`. L'app v1 reste l'app de référence.

### Added
- Squelette Expo SDK 57 dans `app/` (template blank + react-native-web) (#33)
- Cœur métier partagé extrait de l'app v1 en modules purs sans dépendance UI,
  réutilisables sur les trois plateformes : `app/core/languages.js` (10 langues,
  scénarios, résolution tunisien), `schemas.js`, `prompts.js`, `api.js` (Claude +
  serveur OpenAI compatible), `leitner.js`, `diff.js` (#33)
- Abstraction vocale multi-plateforme `app/speech/` : `speech.web.js` (Web Speech API,
  portée de la v1) et `speech.native.js` (synthèse expo-speech ; reconnaissance
  indisponible en natif pour l'instant → dégradation propre vers la saisie clavier),
  résolue automatiquement par Metro selon la plateforme (#34)
- Écran de conversation MVP dans `App.js` : choix langue/niveau/scénario/immersion,
  bulles avec traduction et translittération, corrections, notes culturelles,
  suggestions, micro + coupe-micro, résumé de fin de session, capture du vocabulaire
  vers le carnet (AsyncStorage), réglages moteur IA (Claude / serveur local) (#34)
- Build web `expo export` intégré au workflow Pages et publié sous `/v2/`,
  `experiments.baseUrl` configuré pour le sous-chemin (#35)

## [1.3.0] — 2026-08-16

### Added
- Bouton 🔇 coupe-micro : arrêt immédiat de l'écoute et suspension de la réouverture
  automatique du mode mains libres ; toucher 🎤 réactive (conversation et exercices) (#32)

## [1.2.0] — 2026-08-16

### Added
- Bouton « 🔌 Tester la connexion » du moteur OpenAI compatible : joignabilité, présence du
  modèle au catalogue (`GET /models`), puis validation clé + modèle par un mini
  `chat/completions`, avec diagnostics distincts (injoignable / clé refusée / modèle
  inconnu) (#31)

### Changed
- Exemples d'identifiants alignés sur le catalogue réel de Nous Portal
  (`nousresearch/hermes-4-405b`, `anthropic/claude-sonnet-4.6`, `openai/gpt-oss-120b`) ;
  CORS vérifié : les appels navigateur directs sont autorisés par l'API Nous

## [1.1.0] — 2026-08-16

### Added
- Clé API optionnelle pour le moteur compatible OpenAI (`Authorization: Bearer`), permettant
  les API hébergées comme Nous Research / Hermes (`inference-api.nousresearch.com/v1`,
  modèles Hermes-4-405B/70B/4.3-36B) en plus des serveurs locaux (#30)

### Changed
- Libellés et exemples du moteur OpenAI-compatible (« local ou hébergé ») ; messages
  d'erreur 401/403 explicites

## [1.0.0] — 2026-08-16

### Added
- **PWA installable** : manifeste, icônes, service worker (coquille applicative en cache
  stale-while-revalidate, jamais les appels API) — installable sur l'écran d'accueil iPad
  via Partager → « Sur l'écran d'accueil » (#26)
- **Moteur local compatible OpenAI** : réglage « Moteur IA » avec URL de base et modèle
  (ex. gpt-oss-120b sur vLLM/Ollama), modèle optionnel distinct pour fiches et résumés,
  sorties structurées via `response_format` avec repli automatique (consigne JSON +
  extraction) si le serveur ne supporte pas les schémas (#27)
- **Profils multiples** : réglages, carnet, révisions et historique par profil ; le profil
  « défaut » conserve les données existantes (#28)
- Documentation 1.0 : installation PWA, configuration du serveur local, profils (#29)

## [0.5.0] — 2026-08-16

### Added
- Bibliothèque de scénarios culturels : 3 jeux de rôle ancrés par langue (calçotada et Sant
  Jordi, izakaya et onsen, Biergarten et Bürgeramt, souk et iftar, fado et tram 28…),
  ajoutés au sélecteur selon la langue choisie (#23)
- Notes culturelles 💡 : le tuteur glisse occasionnellement une brève note en français liée
  à l'échange, dans une bulle dédiée non vocalisée (#24)
- Mode 🌊 Immersion totale : langue cible uniquement, corrections par reformulation
  naturelle (aucune bulle de correction), traductions masquées, translittérations
  conservées (#25)

## [0.4.0] — 2026-08-16

### Added
- Test de positionnement CECRL conversationnel : 5 à 8 échanges, verdict A1–C1 justifié en
  français, niveau appliqué automatiquement (#17)
- Difficulté adaptative : le tuteur enrichit ou simplifie en continu selon l'aisance de
  l'élève, dans les limites du niveau choisi (#18)
- Écran « 🧠 Grammaire & conjugaison » : fiches à la demande (explications, tableaux de
  conjugaison, exemples traduits) et cartes mentales rendues en SVG avec info-bulles ;
  bouton « Approfondir » sur chaque correction (#19)
- Mode compréhension orale : texte des réponses flouté, révélation via 👁 (#20)
- Exercices de dictée : 5 phrases adaptées au niveau, correction mot à mot par alignement
  LCS (normalisation casse/ponctuation/diacritiques arabes, comparaison par caractère en
  japonais), score par phrase et bilan (#21)
- Exercice de prononciation : lecture à voix haute comparée à la phrase attendue via la
  reconnaissance vocale, avec réessais (#22)

## [0.3.0] — 2026-08-16

### Added
- Extraction automatique du vocabulaire : le tuteur identifie à chaque tour 0 à 2 mots
  importants (terme, traduction, translittération) via le champ `vocabulary` du schéma (#11)
- Carnet de vocabulaire persistant multi-langues avec dédoublonnage, consultation et
  suppression (#12)
- Révision par répétition espacée : boîtes de Leitner (intervalles 1/2/4/8/16 jours),
  flashcards avec audio dans la voix de la langue de la carte (#13)
- Export du carnet compatible Anki (fichier texte tabulé) (#14)
- Historique des sessions et statistiques : sessions totales, série de jours consécutifs,
  pratique par langue, taille du carnet, cartes dues (#15)
- Écran « 📚 Progrès » avec pastille du nombre de cartes à réviser (#16)

## [0.2.0] — 2026-08-16

Commit : `db178da`.

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
