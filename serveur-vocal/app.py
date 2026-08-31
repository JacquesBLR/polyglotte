"""Serveur vocal Polyglotte (#45) — STT (faster-whisper) et TTS (Piper) sur le DGX.

Débloque les langues sans moteur vocal navigateur digne de ce nom (suisse allemand,
tunisien) : Whisper reconnaît les dialectes bien mieux que la Web Speech API, et Piper
fournit des voix locales. Même principe économique que le backend LLM : tout est local,
aucune API payante.

Endpoints :
  GET  /health          — état + moteurs chargés
  GET  /voices          — voix TTS disponibles (par préfixe de langue)
  POST /stt             — multipart : file=<audio webm/ogg/wav>, lang=<code, ex. ca-ES>
  POST /tts             — JSON { text, lang } → audio/wav

Configuration par variables d'environnement :
  VOCAL_STT_MODEL  (défaut "small")  — taille du modèle Whisper
  VOCAL_VOIX_DIR   (défaut "./voix") — répertoire des modèles Piper (.onnx + .onnx.json)
"""

import io
import json
import os
import tempfile
import wave
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

STT_MODEL = os.environ.get("VOCAL_STT_MODEL", "small")
VOIX_DIR = Path(os.environ.get("VOCAL_VOIX_DIR", Path(__file__).parent / "voix"))

# Préfixe de langue (envoyé par l'app, insensible à la région) → nom de voix Piper.
# Pas de voix japonaise chez Piper : l'app garde alors sa synthèse Web Speech.
VOIX = {
    "ca": "ca_ES-upc_ona-medium",
    "es": "es_ES-sharvard-medium",
    "en": "en_GB-alba-medium",
    "de": "de_DE-thorsten-medium",   # aussi utilisée pour de-CH (pas de voix suisse)
    "pt-pt": "pt_PT-tugão-medium",
    "pt-br": "pt_BR-faber-medium",
    "ar": "ar_JO-kareem-medium",     # aussi utilisée pour ar-TN (pas de voix tunisienne)
}

app = FastAPI(title="Serveur vocal Polyglotte")
app.add_middleware(  # l'app est servie depuis GitHub Pages : CORS indispensable
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# ---------- STT : faster-whisper ----------

_whisper = None
_whisper_device = None

def get_whisper():
    global _whisper, _whisper_device
    if _whisper is None:
        from faster_whisper import WhisperModel
        try:
            _whisper = WhisperModel(STT_MODEL, device="cuda", compute_type="float16")
            _whisper_device = "cuda"
        except Exception:
            _whisper = WhisperModel(STT_MODEL, device="cpu", compute_type="int8")
            _whisper_device = "cpu"
    return _whisper

def code_whisper(lang: str) -> str | None:
    """ca-ES → ca ; de-CH → de ; ar-TN → ar. Vide → détection automatique."""
    lang = (lang or "").strip().lower()
    return lang.split("-")[0] or None

@app.post("/stt")
async def stt(file: UploadFile = File(...), lang: str = Form("")):
    data = await file.read()
    if not data:
        raise HTTPException(400, "Fichier audio vide.")
    model = get_whisper()
    segments, info = model.transcribe(
        io.BytesIO(data), language=code_whisper(lang), beam_size=5, vad_filter=True,
    )
    text = " ".join(s.text.strip() for s in segments).strip()
    return {"text": text, "language": info.language, "duration": round(info.duration, 2)}

# ---------- TTS : Piper ----------

_voix_chargees = {}

def prefixe_voix(lang: str) -> str | None:
    """Meilleure voix pour un code de langue : pt-PT → pt-pt, de-CH → de, ar-TN → ar."""
    lang = (lang or "").strip().lower()
    if lang in VOIX:
        return lang
    base = lang.split("-")[0]
    return base if base in VOIX else None

def get_voix(prefixe: str):
    if prefixe not in _voix_chargees:
        from piper import PiperVoice
        chemin = VOIX_DIR / f"{VOIX[prefixe]}.onnx"
        if not chemin.exists():
            raise HTTPException(404, f"Voix « {VOIX[prefixe]} » absente — lance download-voix.sh.")
        _voix_chargees[prefixe] = PiperVoice.load(str(chemin))
    return _voix_chargees[prefixe]

class TtsRequete(BaseModel):
    text: str
    lang: str = ""

@app.post("/tts")
def tts(req: TtsRequete):
    texte = req.text.strip()
    if not texte:
        raise HTTPException(400, "Texte vide.")
    prefixe = prefixe_voix(req.lang)
    if not prefixe:
        raise HTTPException(404, f"Pas de voix Piper pour « {req.lang} » — repli côté client.")
    voice = get_voix(prefixe)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        chemin = tmp.name
    try:
        with wave.open(chemin, "wb") as wav:
            if hasattr(voice, "synthesize_wav"):      # piper-tts ≥ 1.5
                voice.synthesize_wav(texte, wav)
            else:                                     # anciennes versions
                voice.synthesize(texte, wav)
        audio = Path(chemin).read_bytes()
    finally:
        Path(chemin).unlink(missing_ok=True)
    return Response(content=audio, media_type="audio/wav")

# ---------- Diagnostic ----------

@app.get("/voices")
def voices():
    return {
        p: {"modele": nom, "disponible": (VOIX_DIR / f"{nom}.onnx").exists()}
        for p, nom in VOIX.items()
    }

@app.get("/health")
def health():
    return {
        "ok": True,
        "stt": {"modele": STT_MODEL, "device": _whisper_device or "non chargé"},
        "tts": {"voix_chargees": sorted(_voix_chargees), "dir": str(VOIX_DIR)},
    }
