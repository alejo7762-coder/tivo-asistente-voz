#!/usr/bin/env bash
# Actualiza TIVO en la Raspberry Pi sin reinstalar (HU-RNF08).
# Descarga la última versión del repositorio, la prueba y reinicia el servicio.
# Si algo falla, vuelve a la versión anterior. El archivo .env y la carpeta datos/ no se tocan.
set -euo pipefail
cd "$(dirname "$0")/../.."

anterior=$(git rev-parse HEAD)
volver() {
  echo "La actualización falló: se restaura la versión anterior."
  git reset --hard "$anterior"
  sudo systemctl restart tivo || true
  exit 1
}

git pull --ff-only
(cd asistente && npm test >/dev/null) || volver
sudo systemctl restart tivo
sleep 10
systemctl is-active --quiet tivo || volver
echo "TIVO actualizado a $(git rev-parse --short HEAD)."
