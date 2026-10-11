#!/usr/bin/env bash
# Prépare la synthèse derja (#71) : environnement, modèle, extrait de référence.
#
# Rien de ce que ce script produit n'est versionné — poids de plusieurs centaines de Mo,
# modèle sous licence non commerciale, extrait dérivé d'un corpus de recherche. Usage
# personnel ; vérifier les licences avant tout autre usage.
set -euo pipefail
cd "$(dirname "$0")"

VENV=.venv-tts
DIR=voix-derja

if [ ! -d "$VENV" ]; then
  echo "→ environnement Python dédié (la pile F5-TTS pèse plusieurs Go)"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q --upgrade pip
  "$VENV/bin/pip" install -q -r requirements-derja.txt
fi

mkdir -p "$DIR"
echo "→ modèle Ghazouaniwala/silma-tts-derja"
"$VENV/bin/python" - <<'PY'
from huggingface_hub import hf_hub_download
import shutil, pathlib
dest = pathlib.Path("voix-derja")
for f in ("model.pt", "vocab.txt", "config.yaml"):
    if (dest / f).exists():
        continue
    shutil.copy(hf_hub_download("Ghazouaniwala/silma-tts-derja", f), dest / f)
    print("  ", f)
PY

if [ -f "$DIR/reference.wav" ]; then
  echo "→ extrait de référence déjà présent"
  exit 0
fi

# F5-TTS est une architecture de clonage : la prosodie et le timbre viennent d'un extrait
# de référence, pas du modèle. Celui livré avec le modèle est en anglais — sa fiche le
# donne pour sa faiblesse principale. On en choisit donc un tunisien, et féminin : la
# tutrice annoncée dans l'app est Selma.
#
# Le genre est déterminé par un classifieur, pas par la hauteur de la voix (#73). Sur de
# la parole de podcast, le suivi de hauteur verrouille souvent une harmonique au lieu du
# fondamental : la première version de ce script mesurait un homme à 220 Hz et retenait
# donc préférentiellement des voix masculines — l'inverse du but. Le classifieur est
# d'abord validé sur des voix de genre connu, et le script s'arrête s'il se trompe sur
# l'une d'elles : mieux vaut pas d'extrait du tout qu'un extrait choisi au hasard.
echo "→ extrait de référence tunisien (voix féminine)"
"$VENV/bin/python" - <<'PY'
import io
import logging
import pathlib
import tempfile
import warnings
import wave

import librosa
import numpy as np
import pyarrow.parquet as pq
import soundfile as sf
import torch
from huggingface_hub import hf_hub_download
from piper import PiperVoice
from transformers import pipeline

warnings.filterwarnings("ignore")
logging.getLogger("transformers").setLevel(logging.ERROR)

clf = pipeline(
    "audio-classification",
    model="alefiury/wav2vec2-large-xlsr-53-gender-recognition-librispeech",
    device=0 if torch.cuda.is_available() else -1,
)

def feminin(y, sr):
    """Probabilité que la voix soit féminine, entre 0 et 1."""
    if y.ndim > 1:
        y = y.mean(1)
    if sr != 16000:
        y = librosa.resample(y, orig_sr=sr, target_sr=16000)
    scores = {x["label"]: x["score"] for x in clf({"raw": y, "sampling_rate": 16000})}
    return scores.get("female", 0.0)

# Étalonnage sur les voix Piper déjà téléchargées, dont le genre est connu. Si le
# classifieur se trompe ici, son verdict sur le corpus ne vaut rien.
ETALON = {
    "ar_JO-kareem-medium": 0.0,
    "de_DE-thorsten-medium": 0.0,
    "ca_ES-upc_ona-medium": 1.0,
    "en_GB-alba-medium": 1.0,
}
PHRASE = "Aquesta es una prova de veu per validar el classificador."
for nom, attendu in ETALON.items():
    chemin = pathlib.Path("voix") / f"{nom}.onnx"
    if not chemin.exists():
        print(f"   étalonnage ignoré ({nom} absente — lance download-voix.sh)")
        continue
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        t = tmp.name
    voix = PiperVoice.load(str(chemin))
    with wave.open(t, "wb") as w:
        synth = getattr(voix, "synthesize_wav", None) or voix.synthesize
        synth(PHRASE, w)
    y, sr = sf.read(t, dtype="float32")
    pathlib.Path(t).unlink(missing_ok=True)
    obtenu = feminin(y, sr)
    assert abs(obtenu - attendu) < 0.5, f"classifieur invalide sur {nom} : female={obtenu:.2f}"
    print(f"   étalon {nom} : female={obtenu:.2f} ✓")

# La partie entraînement du corpus, et non celles de test ou de validation : chacune de
# ces dernières ne contient qu'un épisode de podcast, sans aucune voix féminine.
chemin = hf_hub_download(
    "fbougares/TUNIFRA", "data/train-00000-of-00004.parquet", repo_type="dataset"
)
meilleur = None
for lot in pq.ParquetFile(chemin).iter_batches(batch_size=64):
    d = lot.to_pydict()
    for a, tr in zip(d["audio"], d["transcription"]):
        y, sr = sf.read(io.BytesIO(a["bytes"]), dtype="float32")
        if y.ndim > 1:
            y = y.mean(1)
        if not (6.0 <= len(y) / sr <= 10.0) or len(tr.split()) < 8:
            continue
        note = feminin(y, sr)
        if note > 0.95 and (meilleur is None or note > meilleur[0]):
            meilleur = (note, y, sr, tr, a["path"])

assert meilleur, "aucun extrait féminin exploitable"
note, y, sr, tr, nom = meilleur
dest = pathlib.Path("voix-derja")
sf.write(dest / "reference.wav", y, sr)
(dest / "reference.txt").write_text(tr, encoding="utf-8")
print(f"   {nom} — female={note:.3f}")
PY
echo "✅ prêt. Démarrer : $VENV/bin/uvicorn derja:app --host 127.0.0.1 --port 8665"
