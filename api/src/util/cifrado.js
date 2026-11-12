// Cifrado de datos sensibles en reposo (HU-RNF06) con AES-256-GCM.
import crypto from 'node:crypto';
import { config } from '../config.js';

const clave = crypto.createHash('sha256').update(config.claveCifrado).digest();
const PREFIJO = 'c1:';

export function cifrar(texto) {
  if (texto === null || texto === undefined || texto === '') return texto ?? null;
  const iv = crypto.randomBytes(12);
  const cifrador = crypto.createCipheriv('aes-256-gcm', clave, iv);
  const datos = Buffer.concat([cifrador.update(String(texto), 'utf8'), cifrador.final()]);
  return PREFIJO + Buffer.concat([iv, cifrador.getAuthTag(), datos]).toString('base64');
}

export function descifrar(valor) {
  if (typeof valor !== 'string' || !valor.startsWith(PREFIJO)) return valor;
  const bruto = Buffer.from(valor.slice(PREFIJO.length), 'base64');
  const descifrador = crypto.createDecipheriv('aes-256-gcm', clave, bruto.subarray(0, 12));
  descifrador.setAuthTag(bruto.subarray(12, 28));
  return Buffer.concat([descifrador.update(bruto.subarray(28)), descifrador.final()]).toString('utf8');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function tokenAleatorio(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Código corto para vincular la app con el dispositivo, sin caracteres que se confundan (0/O, 1/I). */
export function codigoVinculacion() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(6), (b) => letras[b % letras.length]).join('');
}
