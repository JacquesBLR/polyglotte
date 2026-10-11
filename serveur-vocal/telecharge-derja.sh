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
# donne pour sa faiblesse principale. On en choisit donc un tunisien, en retenant la voix
# la plus aiguë parmi des extraits propres : la tutrice annoncée dans l'app est Selma.
echo "→ extrait de référence tunisien (voix féminine)"
"$VENV/bin/python" - <<'PY'
import io, pathlib
import numpy as np, soundfile as sf, librosa
from huggingface_hub import hf_hub_download
import pyarrow.parquet as pq

chemin = hf_hub_download("fbougares/TUNIFRA", "data/test-00000-of-00001.parquet", repo_type="dataset")
meilleur = None
for lot in pq.ParquetFile(chemin).iter_batches(batch_size=64):
    d = lot.to_pydict()
    for a, tr in zip(d["audio"], d["transcription"]):
        y, sr = sf.read(io.BytesIO(a["bytes"]), dtype="float32")
        if y.ndim > 1:
            y = y.mean(1)
        duree = len(y) / sr
        if not (6.0 <= duree <= 10.0) or len(tr.split()) < 8:
            continue
        f0, voise, _ = librosa.pyin(y, fmin=70, fmax=400, sr=sr, frame_length=2048)
        v = f0[voise & ~np.isnan(f0)]
        if v.size < 50:
            continue
        note = float(np.median(v))
        if meilleur is None or note > meilleur[0]:
            meilleur = (note, y, sr, tr, a["path"])

assert meilleur, "aucun extrait exploitable"
note, y, sr, tr, nom = meilleur
dest = pathlib.Path("voix-derja")
sf.write(dest / "reference.wav", y, sr)
(dest / "reference.txt").write_text(tr, encoding="utf-8")
print(f"   {nom} — F0 médiane {note:.0f} Hz")
PY
echo "✅ prêt. Démarrer : $VENV/bin/uvicorn derja:app --host 127.0.0.1 --port 8665"
