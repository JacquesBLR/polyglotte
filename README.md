# Parla! 🗣️ — Apprendre le catalan en parlant

Application web pour apprendre le **catalan** à partir du **français**, centrée sur la fonctionnalité
à plus forte valeur ajoutée : **une conversation orale avec une IA**.

Tu parles en catalan dans ton micro, la tutrice IA (« Núria », propulsée par Claude) te répond
en catalan à ton niveau, te lit sa réponse à voix haute, te corrige en français et te propose
des réponses possibles pour continuer.

## Fonctionnalités

- 🎤 **Conversation orale** : reconnaissance vocale en catalan (`ca-ES`) via la Web Speech API.
- 🔊 **Synthèse vocale** : les réponses de la tutrice sont lues à voix haute (voix catalane si
  installée, repli sur une voix espagnole sinon), avec vitesse réglable et bouton « réécouter ».
- 🙌 **Mode mains libres** : le micro se rouvre automatiquement après chaque réponse, pour une
  vraie conversation continue.
- ✏️ **Corrections pédagogiques** : chaque erreur importante est corrigée avec une explication
  brève en français (calques du français détectés, grammaire, vocabulaire).
- 🇫🇷 **Traductions** : chaque réplique catalane est traduite en français (désactivable pour se
  challenger).
- 💬 **Suggestions de réponses** : 2–3 phrases catalanes cliquables adaptées au niveau, pour ne
  jamais rester bloqué.
- 🎭 **Scénarios de jeu de rôle** : conversation libre, au café, au marché, demander son chemin,
  se présenter, voyage à Barcelone, au travail.
- 📈 **Trois niveaux** : débutant (A1–A2), intermédiaire (B1–B2), avancé (C1).
- 📋 **Résumé de session** : vocabulaire vu, erreurs commises et phrases à réviser, généré en fin
  de session.

## Démarrage rapide

1. **Obtenir une clé API Anthropic** : [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. **Servir l'application en local** (nécessaire pour l'accès au micro) :

   ```bash
   cd hello-world
   python3 -m http.server 8080
   ```

3. Ouvrir <http://localhost:8080> dans **Chrome ou Edge** (la reconnaissance vocale n'est pas
   disponible dans Firefox ; Safari fonctionne partiellement).
4. Cliquer sur ⚙️, coller la clé API (elle reste dans le `localStorage` du navigateur, elle n'est
   envoyée qu'à l'API Anthropic).
5. Choisir un niveau et un scénario, puis **« Commencer la conversation »**. Autoriser le micro
   quand le navigateur le demande.

## Conseils pour la voix catalane

La qualité de la synthèse vocale dépend des voix installées sur ton système :

- **macOS** : Réglages → Accessibilité → Contenu énoncé → Voix du système → ajouter « Montserrat »
  ou une autre voix *Català*.
- **Windows** : Paramètres → Heure et langue → Langue → ajouter « Català » avec la synthèse vocale.
- **Android/Chrome** : les voix Google incluent généralement le catalan.

Sans voix catalane, l'application se replie sur une voix espagnole (prononciation approximative
mais compréhensible) et l'indique dans les réglages.

## Architecture

Application 100 % statique, sans backend ni dépendance :

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page (accueil, chat, modales réglages/résumé) |
| `css/style.css` | Styles (thème terre cuite catalane) |
| `js/app.js` | Logique : Web Speech API (STT/TTS), appels à l'API Claude, conversation |

Détails techniques notables :

- Appels **directs navigateur → API Anthropic** (`anthropic-dangerous-direct-browser-access`) :
  pas de serveur, la clé reste chez l'utilisateur. Pour un déploiement public multi-utilisateurs,
  il faudrait un petit proxy backend.
- **Sorties structurées** (`output_config.format` avec un schéma JSON) : chaque tour renvoie
  `{ reply, translation, correction, suggestions }`, ce qui garantit un parsing fiable côté client.
- Modèle par défaut : `claude-opus-5` (avec repli serveur `fallbacks: "default"` en cas de refus
  des classificateurs) ; `claude-sonnet-5` et `claude-haiku-4-5` sélectionnables pour réduire les
  coûts ou la latence.
- L'historique envoyé au modèle ne garde que les répliques catalanes (pas les traductions ni les
  corrections), pour rester économe en tokens et naturel.

## Pistes d'évolution

- Répétition espacée du vocabulaire rencontré (export du résumé vers un deck Anki).
- Évaluation de la prononciation (comparaison transcription attendue / reconnue).
- Streaming des réponses avec lecture vocale phrase par phrase pour réduire la latence.
- Petit backend proxy pour partager l'application sans exposer de clé API.
