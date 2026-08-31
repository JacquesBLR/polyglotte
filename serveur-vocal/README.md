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
.venv/bin/uvicorn app:app --host 0.0.0.0 --port 8664   # essai manuel
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
local (contenu mixte). Solutions : exposer le port en HTTPS via `tailscale serve 8664`
(URL `https://spark-4569.<tailnet>.ts.net`), ou utiliser l'app en local (`localhost`
est exempté).
