#!/usr/bin/env bash
# Prepara una Raspberry Pi (Raspberry Pi OS de 64 bits) para ejecutar TIVO.
# Uso: bash despliegue/instalar-pi.sh     (desde la carpeta asistente/)
set -euo pipefail

echo "== Paquetes del sistema =="
sudo apt update
sudo apt install -y python3-pip python3-numpy libportaudio2 espeak-ng mpg123 alsa-utils unzip curl

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  echo "== Node.js 22 =="
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
fi

echo "== Reconocimiento de voz (Vosk) =="
pip3 install --break-system-packages vosk sounddevice
mkdir -p modelos
if [ ! -d modelos/vosk-model-small-es-0.42 ]; then
  curl -L -o modelos/vosk-es.zip https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip
  unzip -q modelos/vosk-es.zip -d modelos && rm modelos/vosk-es.zip
fi

[ -f .env ] || cp .env.example .env
echo
echo "Listo. Edite el archivo .env (TOKEN_DISPOSITIVO, URL_API, ENTRADA_VOZ=vosk, SALIDA_VOZ=espeak) y ejecute: npm start"
