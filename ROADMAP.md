# Feuille de route — Polyglotte

Application web d'apprentissage des langues pour francophones, centrée sur la conversation
orale avec un tuteur IA. Feuille de route validée le 16/08/2026.

## Méthode de travail

- **Développement piloté par les issues GitHub** : chaque fonctionnalité fait l'objet d'une
  issue avant développement ; les commits la référencent (`#N`).
- **Versionnage sémantique** : versions `X.Y.Z`, version affichée dans l'application,
  releases GitHub. ⚠️ Les tags git sont posés via l'interface GitHub (Releases), le push de
  tags étant bloqué depuis l'environnement de développement.
- **CHANGELOG.md** au format [Keep a Changelog](https://keepachangelog.com/fr/) : tout
  changement notable y est consigné.
- Le renommage du dépôt GitHub (`hello-world` → `polyglotte`) est **reporté** (décision du
  16/08/2026) ; l'URL GitHub Pages reste inchangée d'ici là.

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

### v0.5.0 — Contenu et immersion
Bibliothèque de scénarios ancrés culturellement par langue ; notes culturelles ; mode
immersion totale (zéro français, corrections par reformulation).

### v1.0.0 — Plateforme
PWA installable (iPad) ; profils multiples ; **backend local** (serveur compatible OpenAI,
ex. gpt-oss-120b sur DGX) avec modèle configurable par fonction (conversation / corrections /
résumés) ; configuration hybride local + Claude ; STT/TTS améliorés via serveur local
(Whisper, voix dédiées) pour les langues à support vocal partiel.
