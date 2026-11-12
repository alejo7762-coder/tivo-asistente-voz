import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { db } from './db.js';
import { hashToken } from './util/cifrado.js';
import { ErrorHttp } from './util/validar.js';

export function crearSesion(usuario) {
  return jwt.sign({ sub: String(usuario.id) }, config.jwtSecreto, { expiresIn: '30d' });
}

/** Exige una sesión de la app (encabezado Authorization: Bearer <token>). */
export function requiereSesion(req, _res, next) {
  const encabezado = req.headers.authorization || '';
  const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : null;
  if (!token) throw new ErrorHttp(401, 'Debe iniciar sesión.');
  let datos;
  try {
    datos = jwt.verify(token, config.jwtSecreto);
  } catch {
    throw new ErrorHttp(401, 'La sesión venció. Ingrese de nuevo.');
  }
  const usuario = db.prepare('SELECT id, nombre, correo, rol, dispositivo_id FROM usuarios WHERE id = ?').get(Number(datos.sub));
  if (!usuario) throw new ErrorHttp(401, 'La cuenta ya no existe.');
  req.usuario = usuario;
  req.dispositivoId = usuario.dispositivo_id;
  next();
}

/** Control de acceso por roles (HU-RNF06). */
export function requiereRol(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.usuario.rol)) throw new ErrorHttp(403, 'Su cuenta no tiene permiso para hacer este cambio.');
    next();
  };
}

export const puedeEditar = requiereRol('administrador', 'familiar');

/** Exige el token del dispositivo físico (encabezado X-Token-Dispositivo). */
export function requiereDispositivo(req, _res, next) {
  const token = req.headers['x-token-dispositivo'];
  if (!token || typeof token !== 'string') throw new ErrorHttp(401, 'Falta el token del dispositivo.');
  const dispositivo = db.prepare('SELECT id FROM dispositivos WHERE token_hash = ?').get(hashToken(token));
  if (!dispositivo) throw new ErrorHttp(401, 'Token de dispositivo no válido.');
  req.dispositivoId = dispositivo.id;
  db.prepare("UPDATE dispositivos SET ultima_conexion = datetime('now') WHERE id = ?").run(dispositivo.id);
  next();
}
