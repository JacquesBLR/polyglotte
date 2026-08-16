# Polyglotte 🗣️ — Apprends une langue en parlant

Application web d'apprentissage des langues pour **francophones**, centrée sur la fonctionnalité
à plus forte valeur ajoutée : **la conversation orale avec un tuteur IA**.

Tu parles dans ton micro dans la langue cible, le tuteur (propulsé par Claude) te répond à ton
niveau, te lit sa réponse à voix haute, te corrige en français et te propose des réponses
possibles pour continuer.

📍 Feuille de route : [ROADMAP.md](ROADMAP.md) · Journal des changements : [CHANGELOG.md](CHANGELOG.md)

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

- 🎤 **Conversation orale** : reconnaissance vocale dans la langue cible (Web Speech API),
  synthèse vocale avec la meilleure voix disponible, mode mains libres, bouton « réécouter ».
- ✏️ **Corrections pédagogiques** : chaque erreur importante est corrigée avec une explication
  brève en français (une correction par tour, uniquement si le tuteur est certain).
- 🇫🇷 **Traductions** françaises (désactivables) et **translittérations** (rōmaji, arabizi,
  translittération arabe) pour les écritures non latines.
- 💬 **Suggestions de réponses** cliquables adaptées au niveau.
- 🎭 **Scénarios de jeu de rôle** ancrés dans la ville du tuteur : café, marché, demander son
  chemin, se présenter, voyage, travail.
- 📈 **Trois niveaux** : débutant (A1–A2), intermédiaire (B1–B2), avancé (C1).
- 📋 **Résumé de session** : vocabulaire vu, erreurs commises, phrases à réviser.

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

Dans ⚙️ → **Moteur IA** → « Serveur compatible OpenAI (local ou hébergé) » :

**API hébergée — ex. Nous Portal (Hermes, mais aussi Claude, GPT, Gemini…) :**

1. **URL de base** : `https://inference-api.nousresearch.com/v1`
2. **Clé API** : créée sur [portal.nousresearch.com](https://portal.nousresearch.com)
   (envoyée en `Authorization: Bearer`, uniquement vers l'URL configurée)
3. **Modèle** : le portail est un agrégateur de ~250 modèles au format `fournisseur/modèle` —
   `Hermes-4-405B`, `anthropic/claude-sonnet-4.6`, `anthropic/claude-haiku-4.5`… Catalogue
   complet sur `https://inference-api.nousresearch.com/v1/models` (public).

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

## Architecture

Application 100 % statique, sans dépendance :

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page (accueil, chat, modales) |
| `css/style.css` | Styles (thème terre cuite) |
| `js/app.js` | Registre des langues, Web Speech API (STT/TTS), appels Claude, conversation |
| `server.py` | Serveur local optionnel : fichiers statiques + proxy `/api/chat` gardant la clé côté serveur |

Détails techniques notables :

- **Registre de langues central** (`LANGUAGES` dans `app.js`) : locales vocales, persona,
  direction d'écriture, translittération, niveau de support — ajouter une langue = une entrée.
- **Deux modes de clé API détectés automatiquement** : proxy local (`server.py`) ou appels
  directs navigateur → API Anthropic.
- **Sorties structurées** (schéma JSON) : `{ reply, translation, reading, correction, suggestions }`.
- Modèle par défaut `claude-opus-5` ; `claude-sonnet-5` et `claude-haiku-4-5` sélectionnables.
- Développement piloté par issues GitHub, versionnage SemVer, changelog — voir [ROADMAP.md](ROADMAP.md).
