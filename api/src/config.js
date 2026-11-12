import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Carga el archivo .env si existe (Node lo trae incorporado, no hace falta dotenv).
const rutaEnv = path.join(raiz, '.env');
if (fs.existsSync(rutaEnv)) process.loadEnvFile(rutaEnv);

const enProduccion = process.env.NODE_ENV === 'production';

function secreto(nombre, bytes) {
  const valor = process.env[nombre];
  if (valor) return valor;
  if (enProduccion) throw new Error(`Falta la variable ${nombre} en el archivo .env`);
  console.warn(`[config] ${nombre} no está definida: se usa una clave de desarrollo. Defínala en .env antes de desplegar.`);
  return crypto.createHash('sha256').update(`tivo-desarrollo-${nombre}`).digest('hex').slice(0, bytes * 2);
}

export const config = {
  raiz,
  puerto: Number(process.env.PUERTO || 3000),
  jwtSecreto: secreto('JWT_SECRETO', 32),
  claveCifrado: secreto('CLAVE_CIFRADO', 32),
  rutaBd: process.env.RUTA_BD === ':memory:' ? ':memory:' : path.resolve(raiz, process.env.RUTA_BD || './datos/tivo.sqlite'),
  retencionDias: Number(process.env.RETENCION_DIAS || 90),
};

export const CONFIG_DISPOSITIVO_INICIAL = {
  sensibilidadMicrofono: 'media', // baja | media | alta
  activacionPorVoz: true,
  palabraClave: 'hola tivo',
  volumen: 70, // 0 a 100
  velocidadVoz: 'lenta', // lenta | normal
  tamanoLetra: 'grande', // normal | grande | extra_grande
  repetirCadaMinutos: 5, // cada cuánto se repite un recordatorio sin confirmar
  repeticionesMaximas: 3,
  zonaHoraria: 'America/Bogota',
};
