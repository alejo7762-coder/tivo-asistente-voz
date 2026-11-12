import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const rutaEnv = path.join(raiz, '.env');
if (fs.existsSync(rutaEnv)) process.loadEnvFile(rutaEnv);

// Los argumentos --entrada=texto y --salida=consola tienen prioridad sobre el .env
const argumentos = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const ruta = (valor, porDefecto) => path.resolve(raiz, valor || porDefecto);

export const config = {
  version: '1.0.0',
  urlApi: (process.env.URL_API || 'http://localhost:3000/api').replace(/\/+$/, ''),
  tokenDispositivo: process.env.TOKEN_DISPOSITIVO || '',
  claveOpenAI: process.env.OPENAI_API_KEY || '',
  modeloIA: process.env.MODELO_IA || 'gpt-4o-mini',
  entrada: argumentos.entrada || process.env.ENTRADA_VOZ || 'texto',
  salida: argumentos.salida || process.env.SALIDA_VOZ || 'consola',
  rutaModeloVosk: ruta(process.env.RUTA_MODELO_VOSK, './modelos/vosk-model-small-es-0.42'),
  microfono: process.env.MICROFONO || '',
  piperModelo: ruta(process.env.PIPER_MODELO, './modelos/es_MX-claude-high.onnx'),
  rutaMusica: ruta(process.env.RUTA_MUSICA, './musica'),
  comandoPantalla: process.env.COMANDO_PANTALLA || '',
  rutaDatos: path.join(raiz, 'datos'),
  sincronizarCadaMs: 30_000,
  revisarAvisosCadaMs: 15_000,
  ventanaEscuchaMs: 12_000, // tiempo que TIVO sigue atento después de la palabra clave
};
