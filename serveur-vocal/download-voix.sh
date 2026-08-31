#!/usr/bin/env bash
# Télécharge les voix Piper du serveur vocal (#45) dans ./voix/.
# Source : https://huggingface.co/rhasspy/piper-voices
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p voix

BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main"

# chemin_hf  nom_de_fichier
VOIX=(
  "ca/ca_ES/upc_ona/medium/ca_ES-upc_ona-medium"
  "es/es_ES/sharvard/medium/es_ES-sharvard-medium"
  "en/en_GB/alba/medium/en_GB-alba-medium"
  "de/de_DE/thorsten/medium/de_DE-thorsten-medium"
  "pt/pt_PT/tug%C3%A3o/medium/pt_PT-tug%C3%A3o-medium"
  "pt/pt_BR/faber/medium/pt_BR-faber-medium"
  "ar/ar_JO/kareem/medium/ar_JO-kareem-medium"
)

for chemin in "${VOIX[@]}"; do
  nom=$(basename "$chemin" | python3 -c "import sys,urllib.parse; print(urllib.parse.unquote(sys.stdin.read().strip()))")
  for ext in onnx onnx.json; do
    cible="voix/$nom.$ext"
    if [ -s "$cible" ]; then echo "✔ $cible (déjà là)"; continue; fi
    echo "⬇ $nom.$ext"
    curl -fsSL -o "$cible" "$BASE/$chemin.$ext"
  done
done
echo "✅ Voix prêtes dans $(pwd)/voix/"
