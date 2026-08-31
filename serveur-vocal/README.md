# Serveur vocal Polyglotte (#45)

STT (**faster-whisper**) et TTS (**Piper**) locaux sur le DGX, pour les langues dont le
navigateur n'a pas de moteur vocal correct — suisse allemand et tunisien en tête
(Whisper reconnaît les dialectes bien mieux que la Web Speech API). Tout est local,
aucune API payante — même principe que le backend LLM.

## Installation (DGX)

```bash
cd serveur-vocal
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
./download-voix.sh                      # voix Piper (~60 Mo chacune)
.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8664   # essai manuel
# puis en service :
sudo cp polyglotte-vocal.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now polyglotte-vocal
```

Whisper : modèle `small` par défaut (`VOCAL_STT_MODEL=medium` pour plus de précision),
téléchargé au premier appel ; GPU si disponible, sinon CPU int8.

## Endpoints

| Méthode | Chemin | Corps | Réponse |
|---|---|---|---|
| GET | `/health` | — | état + moteurs chargés |
| GET | `/voices` | — | voix par préfixe de langue + disponibilité |
| POST | `/stt` | multipart `file` (webm/ogg/wav) + `lang` (ex. `ca-ES`, vide = auto) | `{ text, language, duration }` |
| POST | `/tts` | JSON `{ text, lang }` | `audio/wav` (404 si pas de voix → repli client) |

Voix : ca, es, en-GB, de (aussi pour de-CH), pt-PT, pt-BR, ar (aussi pour ar-TN).
Pas de voix japonaise chez Piper : l'app garde la synthèse du navigateur pour `ja`.

## HTTPS (PWA)

L'app est servie en HTTPS (GitHub Pages) : le navigateur bloque les appels vers du HTTP
local (contenu mixte). Exposition HTTPS sur le tailnet (fait sur le DGX) :

```bash
sudo tailscale serve --bg --https=8664 http://127.0.0.1:8664
```

URL à coller dans les réglages de l'app : `https://spark-4569.tail34da6b.ts.net:8664`.
L'appli écoute 127.0.0.1 uniquement — c'est tailscale serve qui possède l'IP tailnet
et termine le TLS (un bind 0.0.0.0 recevrait les octets TLS en direct et casserait tout).
Alternative sans tailnet : utiliser l'app en local (`localhost` est exempté de la règle
du contenu mixte).
