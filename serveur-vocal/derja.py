"""Synthèse vocale en tunisien (derja) — service séparé (#71).

Pourquoi un service à part plutôt qu'un bout du serveur vocal : la pile F5-TTS tire
torch, transformers et les bibliothèques CUDA, soit plusieurs gigaoctets de dépendances.
Le serveur vocal, lui, doit rester léger et démarrer vite ; il appelle celui-ci en local
et retombe sur Piper si la réponse n'arrive pas. Une panne ici ne coupe donc ni la
transcription, ni les autres langues.

Endpoints :
  GET  /health  — état, dont le chargement effectif du modèle
  POST /tts     — JSON { text } → audio/wav

Le modèle et l'extrait de référence sont construits par telecharge-derja.sh ; ils ne
sont pas versionnés (poids volumineux, licences non commerciales).
"""

import io
import os
import threading
from pathlib import Path

import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

DERJA_DIR = Path(os.environ.get("VOCAL_DERJA_DIR", Path(__file__).parent / "voix-derja"))
NFE_STEP = int(os.environ.get("VOCAL_DERJA_NFE", "32"))

app = FastAPI(title="Polyglotte — synthèse derja")

# Chargé à la première requête, pas au démarrage : le service peut ainsi être actif sans
# occuper la mémoire du GPU tant que personne n'apprend le tunisien.
_modele = None
_vocoder = None
_ref = None  # (chemin audio prétraité, texte de référence)
_verrou = threading.Lock()


def _charge():
    """Charge modèle, vocodeur et extrait de référence. Idempotent, sous verrou."""
    global _modele, _vocoder, _ref
    if _modele is not None:
        return
    with _verrou:
        if _modele is not None:
            return
        from hydra.utils import get_class
        from omegaconf import OmegaConf
        from f5_tts.infer.utils_infer import load_model, load_vocoder, preprocess_ref_audio_text

        cfg = OmegaConf.load(DERJA_DIR / "config.yaml")
        vocoder = load_vocoder(cfg.model.mel_spec.mel_spec_type)
        modele = load_model(
            get_class(f"f5_tts.model.{cfg.model.backbone}"),
            cfg.model.arch,
            str(DERJA_DIR / "model.pt"),
            mel_spec_type=cfg.model.mel_spec.mel_spec_type,
            vocab_file=str(DERJA_DIR / "vocab.txt"),
            # Le point de contrôle publié ne contient que `model_state_dict` : pas de
            # poids EMA à y chercher, sans quoi le chargement échoue.
            use_ema=False,
        )
        _ref = preprocess_ref_audio_text(
            str(DERJA_DIR / "reference.wav"),
            (DERJA_DIR / "reference.txt").read_text(encoding="utf-8"),
        )
        _vocoder, _modele = vocoder, modele


class TtsRequete(BaseModel):
    text: str


@app.post("/tts")
def tts(req: TtsRequete):
    texte = (req.text or "").strip()
    if not texte:
        raise HTTPException(400, "Texte vide.")
    if not (DERJA_DIR / "model.pt").exists():
        raise HTTPException(503, "Modèle derja absent — lancer telecharge-derja.sh.")
    _charge()
    from f5_tts.infer.utils_infer import infer_process
    from omegaconf import OmegaConf

    type_mel = OmegaConf.load(DERJA_DIR / "config.yaml").model.mel_spec.mel_spec_type
    onde, sr, _ = infer_process(
        _ref[0], _ref[1], texte, _modele, _vocoder, mel_spec_type=type_mel, nfe_step=NFE_STEP,
    )
    tampon = io.BytesIO()
    sf.write(tampon, onde, sr, format="WAV")
    return Response(content=tampon.getvalue(), media_type="audio/wav")


@app.get("/health")
def health():
    return {
        "ok": True,
        "modele_present": (DERJA_DIR / "model.pt").exists(),
        "reference_presente": (DERJA_DIR / "reference.wav").exists(),
        "charge": _modele is not None,
    }
