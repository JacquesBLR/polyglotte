# Feuille de route — Polyglotte

Application web d'apprentissage des langues pour francophones, centrée sur la conversation
orale avec un tuteur IA. Feuille de route validée le 16/08/2026.

## Méthode de travail

- **Développement piloté par les issues GitHub** : chaque fonctionnalité fait l'objet d'une
  issue avant développement ; les commits la référencent (`#N`).
- **Versionnage sémantique** : versions `X.Y.Z`, version affichée dans l'application,
  releases GitHub. Tags et releases sont posés **automatiquement** par `release.yml` à la
  fusion dans `main` quand la version en tête du `CHANGELOG.md` change (le push de tags
  depuis l'environnement de développement reste bloqué — c'est l'action qui les crée).
- **CHANGELOG.md** au format [Keep a Changelog](https://keepachangelog.com/fr/) : tout
  changement notable y est consigné.
- **Branche par défaut `main`** : tout le développement y est fusionné ; chaque changement
  passe par une pull request, dont la CI (`ci.yml`) doit être verte avant fusion. La
  publication GitHub Pages (`deploy-pages.yml`) se déclenche à la fusion dans `main`.
- Le dépôt a été renommé `hello-world` → `polyglotte` le 21/08/2026 ; l'application est
  publiée sur `https://jacquesblr.github.io/polyglotte/` — la v2 à la racine depuis la
  bascule du 31/08/2026 (#42), la v1 gelée archivée sous `/v1/`.

## Langues cibles et support vocal

| Langue | Reconnaissance | Synthèse | Spécificités |
|---|---|---|---|
| Catalan `ca-ES` | ✅ | ✅ (voix à installer) | Langue d'origine du projet |
| Espagnol `es-ES` | ✅ | ✅ | |
| Anglais (GB) `en-GB` | ✅ | ✅ | Vocabulaire et orthographe britanniques |
| Allemand `de-DE` | ✅ | ✅ | |
| Suisse allemand | ⚠️ via `de-CH` | ⚠️ voix allemande | Dialecte : oral dégradé, écrit schwiizerdütsch |
| Portugais (Portugal) `pt-PT` | ✅ | ✅ | |
| Portugais (Brésil) `pt-BR` | ✅ | ✅ | |
| Japonais `ja-JP` | ✅ | ✅ | Rōmaji fourni ; kanji adaptés au niveau |
| Arabe standard `ar` | ✅ | ✅ | Interface RTL ; translittération fournie |
| Tunisien (derja) | ⚠️ via `ar-TN` | ⚠️ voix arabe standard | Double écriture : arabe **et** arabizi |

Le niveau de support vocal est affiché honnêtement dans l'application ; les langues
« ⚠️ » offrent une excellente conversation écrite mais un oral approximatif, en attendant
des moteurs vocaux dédiés (cf. v1.0.0, backend local).

## Jalons

### v0.1.0 — Base (livrée)
Tuteur de catalan « Parla! » : conversation orale (Web Speech API), corrections en français,
traductions, suggestions, scénarios, résumé de session, proxy local optionnel pour la clé
API, déploiement GitHub Pages.

### v0.2.0 — Cœur multilingue (livrée)
Issues [#3](../../issues/3) à [#10](../../issues/10).
Renommage en **Polyglotte** ; registre de 10 langues et sélecteur ; personas et prompts par
langue ; paramétrage vocal par langue avec matrice de support ; RTL ; translittérations
(rōmaji, arabizi) ; versionnage et changelog ; documentation.

### v0.3.0 — Mémoire et progression (livrée)
Issues [#11](../../issues/11) à [#16](../../issues/16).
Vocabulaire personnel (mots rencontrés sauvegardés) ; **répétition espacée** (type Leitner) ;
export Anki ; historique des sessions et statistiques (régularité, temps par langue) ;
persistance locale multi-langues.

### v0.4.0 — Profondeur pédagogique (livrée)
Issues [#17](../../issues/17) à [#22](../../issues/22).
Test de positionnement (niveau CECRL estimé en conversation) ; difficulté adaptative ;
**grammaire et conjugaison** : fiches de conjugaison à la demande, règles grammaticales
expliquées, **cartes mentales interactives** (visualisation des systèmes verbaux, familles
de mots, structures de phrase) ; mode compréhension orale ; mode dictée ; retour sur la
prononciation (écart entre l'attendu et le reconnu).

### v0.5.0 — Contenu et immersion (livrée)
Issues [#23](../../issues/23) à [#25](../../issues/25).
Bibliothèque de scénarios ancrés culturellement par langue ; notes culturelles ; mode
immersion totale (zéro français, corrections par reformulation).

### v1.0.0 — Plateforme (livrée)
Issues [#26](../../issues/26) à [#29](../../issues/29).
PWA installable (iPad) ; profils multiples ; **backend local** (serveur compatible OpenAI,
ex. gpt-oss-120b sur DGX) avec modèle principal + modèle fiches/résumés, et bascule
Claude ↔ local sans rechargement.

### v2.0.0 — Application universelle Expo (en cours)

Issues [#33](../../issues/33) à [#37](../../issues/37).
Migration vers **Expo / React Native** (une seule base de code pour iOS, Android et web).
Livré en alpha : squelette (#33), cœur partagé `app/core` (#33), abstraction vocale +
écran de conversation (#34), build web publié sous `/v2/` (#35). Restent : parité
fonctionnelle complète (#36) et build iOS via EAS/TestFlight (#37 — nécessite un compte
développeur Apple).

**La v1 est gelée depuis le 31/08/2026** : correctifs seulement, toute nouveauté va dans
la v2. Tests unitaires du cœur livrés ([#41](../../issues/41)) ; **bascule `/v2/` → racine
exécutée le 31/08/2026** ([#42](../../issues/42)) : la v2 est servie à la racine, la v1
archivée sous `/v1/`, l'ancien emplacement `/v2/` redirige. Reste le build iOS
([#37](../../issues/37)).

## Après la 1.0 (pistes)

- STT/TTS via serveur local (Whisper, voix Piper dédiées) pour les langues à support
  vocal partiel — l'amélioration la plus forte pour le suisse allemand et le tunisien
  ([#45](../../issues/45)).
- Streaming des réponses avec lecture phrase par phrase (latence) ([#43](../../issues/43)).
- Configuration hybride fine (conversation en local, corrections via Claude).
- Répétition espacée : algorithme FSRS, cartes inversées (français → langue cible)
  ([#44](../../issues/44)).
- ~~Prod Mac mini : runner self-hosted dédié et `deploy.yml`~~ ([#39](../../issues/39) —
  tranché le 31/08/2026 : l'hébergement reste GitHub Pages, les releases sont automatisées
  par `release.yml` sur `ubuntu-latest`, pas de runner self-hosted).
