# Polyglotte 🗣️ — Apprends une langue en parlant

Application web d'apprentissage des langues pour **francophones**, centrée sur la fonctionnalité
à plus forte valeur ajoutée : **la conversation orale avec un tuteur IA**.

Tu parles dans ton micro dans la langue cible, le tuteur (propulsé par Claude) te répond à ton
niveau, te lit sa réponse à voix haute, te corrige en français et te propose des réponses
possibles pour continuer.

🌐 **En ligne** : [jacquesblr.github.io/polyglotte](https://jacquesblr.github.io/polyglotte/)
— l'app universelle Expo (v2). L'ancienne webapp v1, gelée, reste consultable sous
[`/v1/`](https://jacquesblr.github.io/polyglotte/v1/).

📍 Feuille de route : [ROADMAP.md](ROADMAP.md) · Journal des changements : [CHANGELOG.md](CHANGELOG.md)

> 🧊 La v1 (webapp statique) est **gelée** : correctifs seulement. Depuis le 31/08/2026,
> l'app universelle v2 (`app/`) est servie à la racine ; la v1 est archivée sous `/v1/`.

## Langues disponibles

| Langue | Tuteur | Support vocal |
|---|---|---|
| Catalan | Núria (Barcelone) | ✅ (voix catalane à installer) |
| Espagnol | Carmen (Séville) | ✅ |
| Anglais (GB) | Oliver (Londres) | ✅ |
| Allemand | Lena (Berlin) | ✅ |
| Suisse allemand | Reto (Zurich) | ⚠️ dégradé (pas de moteur vocal dialectal) |
| Portugais (Portugal) | Inês (Lisbonne) | ✅ |
| Portugais (Brésil) | João (Rio de Janeiro) | ✅ |
| Japonais | Yuki (Tokyo) | ✅ + rōmaji affiché |
| Arabe standard | Amina (Le Caire) | ✅ + translittération, affichage RTL |
| Tunisien (derja) | Selma (Tunis) | ⚠️ dégradé — écriture arabe **ou** arabizi au choix |

Le niveau de support vocal est annoncé honnêtement au démarrage de chaque session : pour les
dialectes sans moteur vocal dédié (suisse allemand, tunisien), la conversation écrite est
complète mais l'oral est approximatif.

## Fonctionnalités

- 📚 **Parcours guidé** : 30 leçons de A1 à C1 (6 par niveau CECRL), communes aux 10 langues
  et ancrées dans la ville du tuteur. Chaque leçon a trois objectifs « je peux », cochés en
  conversation, ainsi qu'un point de grammaire et un lexique que le tuteur fait réemployer.
  L'accueil propose la prochaine leçon ; rien n'est verrouillé. Un **bilan** clôt chaque
  niveau CECRL : trois missions tirées dans trois leçons différentes, et le niveau validé 🏅.
  Chaque leçon peut se **préparer** : 5 phrases clés à écouter avant de parler, que le
  tuteur fait ensuite réemployer.
- 🧠 **Programme de grammaire par langue** : 6 points par niveau pour chacune des 10 langues
  (ser/estar en espagnol, cas en allemand, particules et forme en て en japonais, racine
  trilitère en arabe, ma… ch en tunisien…), avec fiche ou carte mentale à la demande et ✓
  sur les points étudiés.
- 📖 **Histoires à écouter** : une courte histoire au niveau, ancrée dans la ville du tuteur,
  lue à voix haute avec le texte masqué, puis 3 questions de compréhension en français.
  En conversation, le **mode écoute** masque le texte du tuteur jusqu'à ce que tu le demandes.
- 🧩 **Texte à trous** : 5 phrases à compléter sur le point de grammaire de ton choix, avec
  un indice en français. La correction est locale, tolère les accents (« attention à
  l'accent ») et la phrase complète est lue à voix haute.
- 🎤 **Conversation orale** : reconnaissance vocale dans la langue cible (Web Speech API),
  synthèse vocale avec la meilleure voix disponible, mode mains libres, bouton « réécouter ».
- 🗣️ **« Répète après moi »** : chaque réplique du tuteur se répète au micro ; les mots
  reconnus et manqués sont colorés, avec un score et ce qui a été entendu — moyenne de
  prononciation par séance sur l'écran Progrès. Local, sans appel au modèle.
- ✏️ **Corrections pédagogiques** : chaque erreur importante est corrigée avec une explication
  brève en français (une correction par tour, uniquement si le tuteur est certain).
- 🇫🇷 **Traductions** françaises (désactivables) et **translittérations** (rōmaji, arabizi,
  translittération arabe) pour les écritures non latines.
- 💬 **Suggestions de réponses** cliquables adaptées au niveau.
- 🎭 **Scénarios de jeu de rôle** ancrés dans la ville du tuteur : café, marché, demander son
  chemin, se présenter, voyage, travail — chacun avec **trois missions** proposées au premier
  tour et cochées au fil de la conversation, graduées au niveau (A1–A2 : saluer, commander ;
  B1–B2 : négocier, expliquer ; C1 : convaincre, nuancer).
- 📈 **Trois niveaux** : débutant (A1–A2), intermédiaire (B1–B2), avancé (C1).
- 📋 **Résumé de session** : vocabulaire vu, erreurs commises, phrases à réviser, points forts,
  conseil pour la prochaine fois et **niveau CECRL observé** pendant la séance. Ses erreurs et
  son vocabulaire rejoignent les carnets ; les bilans se relisent depuis l'écran Progrès, où
  la tendance du niveau observé s'affiche séance après séance.
- 🎯 **Objectif hebdomadaire** : des jours de pratique à tenir chaque semaine (3, 4, 5 ou 7),
  frise lundi → dimanche sur l'écran Progrès, minutes de la semaine et semaines tenues
  d'affilée — calculé depuis l'historique, rien de plus n'est stocké.
- 🩹 **Carnet d'erreurs** : chaque correction reçue en conversation devient une carte de
  révision espacée (FSRS), et les erreurs les plus fragiles reviennent discrètement dans la
  séance suivante — le tuteur amène la situation où la forme correcte sert, sans les lister.
- 🔔 **Rappels de révision** (app iOS/Android) : notification locale quand des cartes
  arrivent à échéance — sur l'appareil, sans serveur ni compte.

## Démarrage rapide (recommandé : clé gérée par le serveur)

1. **Obtenir une clé API Anthropic** : [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. **Lancer le serveur local** avec la clé (aucune dépendance, Python standard uniquement) :

   ```bash
   echo 'ANTHROPIC_API_KEY=sk-ant-…' > .env   # ou : export ANTHROPIC_API_KEY=sk-ant-…
   python3 server.py
   ```

   La clé reste côté serveur (`.env` est ignoré par git) ; le navigateur passe par le proxy
   `/api/chat` et il n'y a **rien à configurer dans l'interface**.
3. Ouvrir <http://localhost:8080> dans **Chrome, Edge ou Safari**.
4. Choisir langue, niveau et scénario, puis **« Commencer la conversation »**. Autoriser le
   micro quand le navigateur le demande.

### Variante sans serveur (hébergement statique)

L'application fonctionne aussi servie en statique (GitHub Pages, `python3 -m http.server`) :
coller alors la clé API dans les réglages ⚙️ — elle reste dans le `localStorage` du navigateur
et n'est envoyée qu'à l'API Anthropic. À réserver à un usage personnel.

### Installer comme application (PWA)

Sur iPad/iPhone : ouvrir l'app dans Safari → **Partager** → **« Sur l'écran d'accueil »**.
Polyglotte s'ouvre alors en plein écran avec son icône, et la coquille de l'application est
mise en cache pour un démarrage instantané (les conversations, elles, nécessitent le réseau).

### Moteur compatible OpenAI (hébergé ou local)

> ⚙️ **Une installation neuve arrive déjà configurée** sur le moteur local du DGX (URL de la
> passerelle, modèle et serveur vocal préremplis) — rien à saisir pour l'usage courant. Les
> clés API restent vides, et tous les champs ci-dessous restent modifiables. Attention : les
> réglages déjà enregistrés gagnent sur ces défauts, donc une installation existante garde
> les siens.

Dans ⚙️ → **Moteur IA** → « Serveur compatible OpenAI (local ou hébergé) » :

**API hébergée — ex. Nous Portal (Hermes, mais aussi Claude, GPT, Gemini…) :**

1. **URL de base** : `https://inference-api.nousresearch.com/v1`
2. **Clé API** : créée sur [portal.nousresearch.com](https://portal.nousresearch.com)
   (envoyée en `Authorization: Bearer`, uniquement vers l'URL configurée)
3. **Modèle** : le portail est un agrégateur (368 modèles au format `fournisseur/modèle`,
   catalogue vérifié) — `anthropic/claude-sonnet-4.6`, `anthropic/claude-haiku-4.5`,
   `anthropic/claude-opus-5`, `nousresearch/hermes-4-405b`, `openai/gpt-oss-120b`…
   Catalogue complet public : `https://inference-api.nousresearch.com/v1/models`.
4. **🔌 Tester la connexion** : le bouton des réglages vérifie la joignabilité, la présence
   du modèle au catalogue, puis la clé de bout en bout.

**Serveur local — ex. gpt-oss-120b sur un DGX :**

1. **URL de base** : vLLM `http://dgx:8000/v1`, Ollama `http://dgx:11434/v1`,
   llama.cpp `http://dgx:8080/v1` (pas de clé nécessaire)
2. **Modèle principal** : ex. `gpt-oss-120b`

Dans les deux cas, un second champ permet un modèle différent pour les fiches de grammaire
et les résumés, et l'app tente les sorties structurées (`response_format` json_schema) avec
repli automatique (consigne JSON) si le serveur ne les supporte pas.

> ℹ️ Si un fournisseur hébergé n'autorise pas les appels directs depuis un navigateur
> (CORS), la requête échouera avec une erreur réseau : il faut alors passer par un petit
> proxy (le même principe que `server.py` pour Anthropic).

⚠️ **Réseau** : une page servie en HTTPS (GitHub Pages) ne peut pas appeler un serveur en
HTTP (« mixed content »). Pour utiliser le moteur local : sers l'application depuis le
serveur lui-même (`python3 server.py` sur le DGX), ou expose le serveur en HTTPS
(Tailscale `tailscale cert`, reverse proxy…). Pense aussi à activer CORS sur le serveur
d'inférence (vLLM : `--allowed-origins '["*"]'`, Ollama : `OLLAMA_ORIGINS`).

### Profils multiples

⚙️ → **Profil** : chaque profil a ses réglages, son carnet de vocabulaire, ses révisions et
son historique — pratique à plusieurs sur le même iPad, ou pour séparer deux langues
d'étude. Le profil « défaut » conserve les données antérieures à la 1.0.

## Conseils voix

La qualité de la synthèse dépend des voix installées sur le système :

- **iOS/iPadOS** : Réglages → Accessibilité → Contenu énoncé → Voix → ajouter les voix des
  langues pratiquées (ex. « Montserrat » pour le catalan).
- **macOS** : Réglages → Accessibilité → Contenu énoncé → Voix du système.
- **Windows** : Paramètres → Heure et langue → Langue → ajouter la langue avec synthèse vocale.

## Serveur vocal local (Whisper + Piper)

Le suisse allemand et le tunisien n'ont pas de moteur vocal dédié : les moteurs du
navigateur et de l'appareil les rendent mal. `serveur-vocal/` est un service FastAPI à
faire tourner sur une machine à soi (le DGX, par exemple) qui expose `/stt`
(faster-whisper) et `/tts` (7 voix Piper : ca, es, en-GB, de, pt-PT, pt-BR, ar),
plus une voix tunisienne dédiée (voir plus bas).

⚙️ → **Serveur vocal** : colle son URL et appuie sur **🎙️ Tester le serveur vocal**.
Quand il est configuré, les langues au support **partiel** passent par lui — micro en mode
appuyer-parler-retoucher — avec repli automatique sur les moteurs du système en cas
d'échec. Les autres langues continuent d'utiliser les moteurs du système, plus rapides.

Installation, voix et exposition HTTPS (nécessaire depuis la PWA, qui est servie en
HTTPS) : voir [`serveur-vocal/README.md`](serveur-vocal/README.md).

### Voix tunisienne (derja)

Piper ne publie qu'une voix arabe, **jordanienne et masculine** : lire de la derja avec
elle donne du tunisien à l'accent levantin. `serveur-vocal/derja.py` est un second service,
dans son propre environnement Python, qui synthétise en tunisien avec le modèle
[`Ghazouaniwala/silma-tts-derja`](https://huggingface.co/Ghazouaniwala/silma-tts-derja)
(fine-tune F5-TTS).

```bash
cd serveur-vocal && ./telecharge-derja.sh     # environnement, modèle, extrait de référence
sudo cp polyglotte-derja.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now polyglotte-derja
```

Le serveur vocal l'appelle quand la langue est `ar-TN`, via `VOCAL_DERJA_URL`. **Le repli
est automatique** : service absent, arrêté ou en erreur, la réplique repart par la voix
arabe de Piper — une voix au mauvais accent vaut mieux que le silence.

Pourquoi un service séparé : la pile F5-TTS tire torch et les bibliothèques CUDA, soit
plusieurs gigaoctets. Le serveur vocal reste léger, démarre vite, et une panne de la
synthèse derja ne coupe ni la transcription ni les autres langues. Le modèle n'est chargé
qu'à la première requête.

Mesuré sur le GPU du DGX : ~7 s à la première réplique (chargement compris), **~0,7 s**
ensuite pour une phrase courte.

**Deux garde-fous**, nés d'une voix jugée saccadée à l'usage (#81) :

- le service **rogne le silence de tête et de queue** du rendu. F5-TTS en produit 0,5 à
  1,25 s avant la parole, qui s'additionnaient entre chaque phrase d'une lecture en
  streaming ;
- un rendu sans parole (texte trop court : l'estimation de durée se fait sur le rapport
  des longueurs avec l'extrait de référence) est **rejoué une fois, puis refusé en 503** —
  le serveur vocal retombe alors sur Piper. `أهلا بيك!` seul rendait 0,74 s de silence
  numérique.

Côté app, le tunisien déclare `voixMinCar: 60` : les phrases sont regroupées jusqu'à 60
caractères avant d'être synthétisées, pour ne jamais envoyer de fragment à une voix clonée.

> ⚠️ **Licences.** Le modèle est sous CC-BY-NC 4.0, et l'extrait de référence est dérivé
> d'un corpus de recherche. Usage personnel ; à revérifier avant tout autre usage. Ni le
> modèle ni l'extrait ne sont versionnés — `telecharge-derja.sh` les reconstruit.

> F5-TTS calque sa prosodie sur un extrait de référence ; celui livré avec le modèle est
> en anglais, ce que sa fiche donne pour sa faiblesse principale. Le script en choisit donc
> un tunisien et féminin, la tutrice annoncée dans l'app étant Selma. Le genre est établi
> par un classifieur, **d'abord validé sur les voix Piper de genre connu** : le script
> s'arrête s'il se trompe sur l'une d'elles. Une première version jugeait à la hauteur de
> la voix et retenait des hommes, le suivi de hauteur doublant d'octave sur de la parole
> de podcast (#73).

### Tunisien : d'où vient la langue elle-même

La voix ne fait que lire : ce que le tuteur **écrit** doit d'abord être du tunisien. Laissé
à lui-même, un modèle produit un « arabe maghrébin moyen » qui dérive vers l'ouest — il a
écrit `أتاي` (le thé, forme marocaine) et `كيف` au lieu de `كيفاش`.

`app/core/derja.js` ancre donc le prompt du tunisien dans un corpus : `fbougares/TUNIFRA`,
1 950 phrases de radio tunisienne transcrites et alignées au français — celui dont vient
déjà l'extrait de référence de la voix. Les oppositions du guide y sont comptées, pas
devinées :

| forme tunisienne | n | forme d'un autre dialecte | n |
|---|---|---|---|
| برشا / برشة | 158 | بزاف | 0 |
| قداش | 21 | شحال | 0 |
| توة | 77 | دابا | 0 |
| متاع | 287 | ديال | 0 |
| نحب | 43 | بغيت | 0 |
| هاذا / هاذي | 76 | هاد | 0 |

Trois phrases du corpus sont citées en exemple dans le guide : du tunisien attesté, pas
reconstitué. Le guide ne part que dans le prompt du tunisien.

> ⚠️ Corpus de recherche, cité à l'échelle de l'extrait. Même réserve que pour l'extrait
> de référence de la voix : usage personnel, à revérifier avant tout autre usage.

### Relais vers le moteur LLM

Le même service peut relayer `/v1/*` vers un serveur compatible OpenAI, via la variable
`VOCAL_LLM_BASE` (sans valeur par défaut : non renseignée, `/v1/*` répond `503` et le
service reste purement vocal).

À quoi ça sert : un navigateur n'appelle un serveur d'une autre origine que si celui-ci
renvoie les en-têtes CORS voulus. Beaucoup de serveurs d'inférence ne le font pas, et la
requête échoue alors sans que les réglages y soient pour quelque chose. Passer par ce relais
règle le problème sans toucher au serveur d'inférence — utile quand il est partagé avec
d'autres usages. Le flux est relayé tel quel, donc le streaming phrase par phrase
fonctionne à travers lui.

Les origines autorisées sont énumérées dans `serveur-vocal/app.py` (`ORIGINES`) : GitHub
Pages et `localhost`. C'est volontairement restrictif — un relais LLM ouvert à toutes les
origines laisserait n'importe quelle page du navigateur consommer le moteur. Si tu sers
l'app depuis une autre adresse (une IP de LAN, par exemple), ajoute-la là.

> ⚠️ Ce relais ne porte **aucune authentification** : il hérite de celle du réseau sur
> lequel il est exposé. Ne l'expose pas sur l'internet public.

## Application iOS (TestFlight)

L'app native se construit avec **EAS Build** (dans le cloud d'Expo — aucun Mac requis) ;
`app/eas.json` contient les profils. Il faut un compte Expo (gratuit) et un compte
développeur Apple.

```sh
cd app
npm install -g eas-cli      # ou npx eas-cli@latest à chaque commande
npx eas login               # compte Expo
npx eas init                # relie le projet (écrit extra.eas.projectId dans app.json)

# 1. Build de développement, à installer sur ton iPhone/iPad pour développer.
#    Indispensable : la reconnaissance vocale native n'existe pas dans Expo Go.
npx eas device:create       # enregistre l'appareil (ad hoc)
npx eas build -p ios --profile development

# 2. Build de production, puis envoi sur TestFlight.
npx eas build -p ios --profile production
npx eas submit -p ios --latest
```

Au premier build, EAS propose de se connecter à Apple et crée seul les certificats, le
profil de provisionnement et l'app dans App Store Connect. Les identifiants de soumission
(`appleId`, `ascAppId`, `appleTeamId`) se renseignent dans `app/eas.json`.

**Spécificités natives** : reconnaissance vocale système (`SFSpeechRecognizer`), serveur
vocal pour les langues au support partiel, et **rappels de révision** — une notification
locale à 19 h le premier jour où des cartes sont à revoir (⚙️ → réglage désactivé par
défaut ; planifiée sur l'appareil, sans serveur ni compte).

## Architecture

Deux applications cohabitent dans le dépôt : la **v2** (`app/`, Expo, servie à la racine
du site) et la **v1** gelée (statique, archivée sous `/v1/`).

**v2 — app universelle Expo** (iOS, Android, web depuis une seule base de code) :

| Chemin | Rôle |
|---|---|
| `app/App.js` | Navigation, conversation, état de session |
| `app/core/` | Cœur partagé, sans dépendance à la plateforme : registre des langues, prompts, schémas JSON, appels aux moteurs, streaming, FSRS, rappels — couvert par les tests |
| `app/speech/` | Abstraction vocale, une implémentation par plateforme (`.web.js` / `.native.js`) : moteurs du système ou serveur vocal |
| `app/notify/`, `app/export/`, `app/pwa/` | Mêmes couches par plateforme : rappels locaux, export de fichier, service worker |
| `app/ui/` | Écrans grammaire, exercices, progrès et réglages |
| `app/eas.json` | Profils de build et de soumission EAS (iOS) |
| `serveur-vocal/` | Service FastAPI optionnel : `/stt` (faster-whisper) et `/tts` (voix Piper) |

**v1 — webapp statique gelée** (correctifs seulement) :

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page (accueil, chat, modales) |
| `css/style.css` | Styles (thème terre cuite) |
| `js/app.js` | Registre des langues, Web Speech API (STT/TTS), appels Claude, conversation |
| `server.py` | Serveur local optionnel : fichiers statiques + proxy `/api/chat` gardant la clé côté serveur |

Détails techniques notables :

- **Registre de langues central** (`LANGUAGES`, dans `app/core/languages.js` pour la v2 et
  `js/app.js` pour la v1) : locales vocales, persona,
  direction d'écriture, translittération, niveau de support — ajouter une langue = une entrée.
- **Deux modes de clé API détectés automatiquement** : proxy local (`server.py`) ou appels
  directs navigateur → API Anthropic.
- **Sorties structurées** (schéma JSON) : `{ reply, translation, reading, correction, suggestions }`.
- Modèle par défaut `claude-opus-5` ; `claude-sonnet-5` et `claude-haiku-4-5` sélectionnables.
- Développement piloté par issues GitHub, versionnage SemVer, changelog — voir [ROADMAP.md](ROADMAP.md).
