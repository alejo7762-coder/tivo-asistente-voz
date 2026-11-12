#!/usr/bin/env python3
"""Escucha el micrófono y escribe en la salida una línea JSON por cada frase reconocida.

Lo lanza el asistente (src/voz/entrada.js). El reconocimiento se hace en la Raspberry Pi
con Vosk, sin enviar el audio a Internet.

Dependencias:  pip install vosk sounddevice   (y, opcional, numpy para ajustar la sensibilidad)
"""
import argparse
import json
import queue
import sys


def emitir(**datos):
    print(json.dumps(datos, ensure_ascii=False), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--modelo", help="carpeta del modelo de Vosk en español")
    parser.add_argument("--microfono", help="índice o nombre del micrófono")
    parser.add_argument("--ganancia", type=float, default=1.0)
    parser.add_argument("--listar", action="store_true", help="muestra los micrófonos disponibles")
    args = parser.parse_args()

    try:
        import sounddevice as sd
    except Exception as error:  # falta la librería o PortAudio
        sys.exit(f"Falta sounddevice (pip install sounddevice; sudo apt install libportaudio2): {error}")

    if args.listar:
        print(sd.query_devices())
        return

    try:
        import vosk
    except ImportError:
        sys.exit("Falta vosk (pip install vosk)")
    try:
        import numpy as np
    except ImportError:
        np = None

    vosk.SetLogLevel(-1)
    if not args.modelo:
        sys.exit("Indique la carpeta del modelo con --modelo")
    try:
        modelo = vosk.Model(args.modelo)
    except Exception:
        sys.exit(f"No se pudo cargar el modelo de Vosk en {args.modelo}")

    microfono = args.microfono
    if microfono is not None and microfono.isdigit():
        microfono = int(microfono)
    frecuencia = 16000
    reconocedor = vosk.KaldiRecognizer(modelo, frecuencia)

    # Los adultos mayores suelen hacer pausas largas al hablar: se espera más silencio
    # antes de dar la frase por terminada (si esta versión de Vosk lo permite).
    try:
        reconocedor.SetEndpointerMode(vosk.EndpointerMode.LONG)
    except Exception:
        pass

    cola = queue.Queue()

    def al_recibir(datos, _cuadros, _tiempo, _estado):
        cola.put(bytes(datos))

    with sd.RawInputStream(samplerate=frecuencia, blocksize=4000, device=microfono, dtype="int16", channels=1, callback=al_recibir):
        emitir(evento="listo")
        while True:
            bloque = cola.get()
            if np is not None and args.ganancia != 1.0:
                muestras = np.frombuffer(bloque, dtype=np.int16).astype(np.float32) * args.ganancia
                bloque = np.clip(muestras, -32768, 32767).astype(np.int16).tobytes()
            if reconocedor.AcceptWaveform(bloque):
                texto = json.loads(reconocedor.Result()).get("text", "").strip()
                if texto:
                    emitir(texto=texto)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
