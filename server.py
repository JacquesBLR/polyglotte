#!/usr/bin/env python3
"""Serveur local pour Parla! — sert les fichiers statiques et fait proxy vers l'API Anthropic.

La clé API reste côté serveur : elle est lue depuis la variable d'environnement
ANTHROPIC_API_KEY ou depuis un fichier .env (ligne `ANTHROPIC_API_KEY=sk-ant-...`).
Le navigateur appelle /api/chat sans jamais voir la clé.

Usage :
    ANTHROPIC_API_KEY=sk-ant-... python3 server.py
    # ou : echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env && python3 server.py

Aucune dépendance : uniquement la bibliothèque standard.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
PORT = int(os.environ.get("PORT", "8080"))
ROOT = os.path.dirname(os.path.abspath(__file__))


def load_env_file():
    """Charge un éventuel fichier .env (KEY=VALUE, sans écraser l'environnement)."""
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def api_key():
    return os.environ.get("ANTHROPIC_API_KEY", "").strip()


class ParlaHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/health":
            self.send_json(200, {"ok": True, "hasKey": bool(api_key())})
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/chat":
            self.send_json(404, {"error": {"message": "Route inconnue"}})
            return
        key = api_key()
        if not key:
            self.send_json(500, {"error": {"message": "ANTHROPIC_API_KEY non configurée côté serveur"}})
            return

        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 1_000_000:
            self.send_json(400, {"error": {"message": "Corps de requête invalide"}})
            return
        body = self.rfile.read(length)

        headers = {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        }
        # Le frontend peut demander une fonctionnalité beta (ex. repli serveur sur Opus 5).
        beta = self.headers.get("anthropic-beta")
        if beta:
            headers["anthropic-beta"] = beta

        request = urllib.request.Request(ANTHROPIC_URL, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=180) as resp:
                payload = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as err:
            payload = err.read()
            self.send_response(err.code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except urllib.error.URLError as err:
            self.send_json(502, {"error": {"message": f"Impossible de joindre l'API Anthropic : {err.reason}"}})

    def log_message(self, fmt, *args):
        # Journal minimal, sans jamais logger de contenu de requête.
        sys.stderr.write(f"{self.address_string()} — {fmt % args}\n")


def main():
    load_env_file()
    if not api_key():
        print("⚠️  ANTHROPIC_API_KEY absente : l'application basculera en mode « clé dans le navigateur ».")
        print("   Pour gérer la clé côté serveur : ANTHROPIC_API_KEY=sk-ant-... python3 server.py")
        print("   ou crée un fichier .env contenant : ANTHROPIC_API_KEY=sk-ant-...")
    else:
        print("🔑 Clé API chargée côté serveur — aucune clé à saisir dans le navigateur.")
    print(f"🗣️  Parla! disponible sur http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), ParlaHandler).serve_forever()


if __name__ == "__main__":
    main()
