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
  *    /v1/*            — passe-plat vers la passerelle LLM (streaming préservé)

Configuration par variables d'environnement :
  VOCAL_STT_MODEL  (défaut "small")  — taille du modèle Whisper
  VOCAL_VOIX_DIR   (défaut "./voix") — répertoire des modèles Piper (.onnx + .onnx.json)
  VOCAL_LLM_BASE   (sans défaut)     — base OpenAI de la passerelle, ex.
                                       http://127.0.0.1:8646/v1 ; vide = /v1/* désactivé
"""

import io
import json
import os
import tempfile
import wave
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

STT_MODEL = os.environ.get("VOCAL_STT_MODEL", "small")
VOIX_DIR = Path(os.environ.get("VOCAL_VOIX_DIR", Path(__file__).parent / "voix"))
LLM_BASE = os.environ.get("VOCAL_LLM_BASE", "").rstrip("/")
# Service de synthèse derja (#71), dans son propre environnement Python. Vide ⇒ le
# tunisien retombe sur la voix arabe de Piper, comme avant.
DERJA_URL = os.environ.get("VOCAL_DERJA_URL", "").rstrip("/")

_client: "httpx.AsyncClient | None" = None

# Préfixe de langue (envoyé par l'app, insensible à la région) → nom de voix Piper.
# Pas de voix japonaise chez Piper : l'app garde alors sa synthèse Web Speech.
VOIX = {
    "ca": "ca_ES-upc_ona-medium",
    "es": "es_ES-sharvard-medium",
    "en": "en_GB-alba-medium",
    "de": "de_DE-thorsten-medium",   # aussi utilisée pour de-CH (pas de voix suisse)
    "pt-pt": "pt_PT-tugão-medium",
    "pt-br": "pt_BR-faber-medium",
    # Seule voix arabe publiée par Piper : jordanienne (levantine) et masculine. Elle sert
    # aussi au tunisien, faute de mieux — l'app le dit maintenant à l'élève (#69) plutôt
    # que d'annoncer un « arabe standard » qui n'est pas ce qu'il entend.
    "ar": "ar_JO-kareem-medium",
}

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Ferme proprement le client du relais LLM à l'arrêt (cf. plus bas)."""
    yield
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


app = FastAPI(title="Serveur vocal Polyglotte", lifespan=lifespan)
# L'app est servie depuis GitHub Pages : CORS indispensable. Les origines sont
# énumérées plutôt que « * » (#59) — depuis que /v1/* relaie le LLM, un CORS ouvert
# laisserait n'importe quelle page du navigateur consommer le moteur local.
ORIGINES = ["https://jacquesblr.github.io"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINES,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",  # dev local
    allow_methods=["*"],
    allow_headers=["*"],
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

def est_tunisien(lang: str) -> bool:
    return (lang or "").strip().lower().startswith("ar-tn")

def tts_derja(texte: str) -> bytes | None:
    """Synthèse par le service derja. Retourne None s'il est absent ou en échec :
    l'appelant retombe alors sur Piper, une voix arabe vaut mieux que le silence."""
    if not DERJA_URL:
        return None
    try:
        # Généreux à dessein : la première requête charge le modèle sur le GPU.
        reponse = httpx.post(f"{DERJA_URL}/tts", json={"text": texte}, timeout=120.0)
        reponse.raise_for_status()
        return reponse.content
    except Exception:
        return None

@app.post("/tts")
def tts(req: TtsRequete):
    texte = req.text.strip()
    if not texte:
        raise HTTPException(400, "Texte vide.")
    if est_tunisien(req.lang):
        audio = tts_derja(texte)
        if audio:
            return Response(content=audio, media_type="audio/wav")
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
        "llm": {"relais": bool(LLM_BASE)},
        "derja": {"service": bool(DERJA_URL)},
    }


# ---------- Passe-plat LLM (#59) ----------
#
# La passerelle compatible OpenAI du DGX ne renvoie aucun en-tête CORS : le navigateur
# bloque donc les appels directs depuis l'app servie par GitHub Pages. Plutôt que d'ouvrir
# CORS sur une infra partagée par tous les projets, on relaie ici — ce serveur appartient
# au projet, est déjà exposé en HTTPS sur le tailnet, et porte déjà la politique CORS.
#
# Le flux est relayé tel quel, octet par octet : le streaming SSE de la conversation
# (lecture phrase par phrase, #43) doit continuer d'arriver au fur et à mesure. Aucun
# `await` sur le corps complet, donc, et pas de mise en tampon.

def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        # Génération longue possible : pas de timeout de lecture, mais une connexion qui
        # ne s'établit pas doit échouer vite.
        _client = httpx.AsyncClient(timeout=httpx.Timeout(None, connect=10.0))
    return _client


# En-têtes repris dans chaque sens : le reste (hop-by-hop, longueur, encodage) est
# recalculé par uvicorn, et les en-têtes CORS sont posés par le middleware.
_ENTETES_ALLER = ("content-type", "authorization", "accept")
_ENTETES_RETOUR = ("content-type", "cache-control")


@app.api_route("/v1/{chemin:path}", methods=["GET", "POST"])
async def relais_llm(chemin: str, requete: Request):
    if not LLM_BASE:
        raise HTTPException(503, "Relais LLM non configuré (VOCAL_LLM_BASE).")

    client = get_client()
    amont = client.build_request(
        requete.method,
        f"{LLM_BASE}/{chemin}",
        content=requete.stream(),
        headers={k: v for k, v in requete.headers.items() if k.lower() in _ENTETES_ALLER},
        params=requete.query_params,
    )
    try:
        reponse = await client.send(amont, stream=True)
    except httpx.RequestError as err:
        raise HTTPException(502, f"Passerelle LLM injoignable : {err}") from err

    async def flux():
        try:
            async for bloc in reponse.aiter_raw():
                yield bloc
        finally:
            await reponse.aclose()

    return StreamingResponse(
        flux(),
        status_code=reponse.status_code,
        headers={k: v for k, v in reponse.headers.items() if k.lower() in _ENTETES_RETOUR},
    )
