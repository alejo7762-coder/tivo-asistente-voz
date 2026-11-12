import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { crearSesion, requiereSesion } from '../auth.js';
import { db } from '../db.js';
import { ErrorHttp, texto } from '../util/validar.js';

export const rutasAuth = Router();

// Frena los intentos repetidos de adivinar contraseñas.
const limite = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espere unos minutos e intente de nuevo.' } });

const publico = (u) => ({ id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol });

function correoDe(valor) {
  const correo = texto(valor, 'correo', { min: 5, max: 120 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new ErrorHttp(400, 'El correo electrónico no es válido.');
  return correo;
}

rutasAuth.post('/registro', limite, (req, res) => {
  const nombre = texto(req.body.nombre, 'nombre', { max: 60 });
  const correo = correoDe(req.body.correo);
  const clave = texto(req.body.clave, 'clave', { min: 8, max: 72 });
  const codigo = texto(req.body.codigoVinculacion, 'codigoVinculacion', { min: 6, max: 6 }).toUpperCase();

  const dispositivo = db.prepare('SELECT id FROM dispositivos WHERE codigo_vinculacion = ?').get(codigo);
  if (!dispositivo) throw new ErrorHttp(404, 'No existe un dispositivo TIVO con ese código de vinculación.');
  if (db.prepare('SELECT 1 FROM usuarios WHERE correo = ?').get(correo)) throw new ErrorHttp(409, 'Ya existe una cuenta con ese correo.');

  // La primera cuenta vinculada administra el dispositivo; las demás entran como familiares.
  const hayCuentas = db.prepare('SELECT 1 FROM usuarios WHERE dispositivo_id = ?').get(dispositivo.id);
  const rol = hayCuentas ? 'familiar' : 'administrador';
  const { lastInsertRowid } = db.prepare('INSERT INTO usuarios (nombre, correo, clave_hash, rol, dispositivo_id) VALUES (?, ?, ?, ?, ?)')
    .run(nombre, correo, bcrypt.hashSync(clave, 10), rol, dispositivo.id);
  const usuario = { id: Number(lastInsertRowid), nombre, correo, rol };
  res.status(201).json({ token: crearSesion(usuario), usuario });
});

rutasAuth.post('/ingresar', limite, (req, res) => {
  const correo = correoDe(req.body.correo);
  const clave = texto(req.body.clave, 'clave', { min: 1, max: 72 });
  const usuario = db.prepare('SELECT * FROM usuarios WHERE correo = ?').get(correo);
  if (!usuario || !bcrypt.compareSync(clave, usuario.clave_hash)) throw new ErrorHttp(401, 'Correo o contraseña incorrectos.');
  res.json({ token: crearSesion(usuario), usuario: publico(usuario) });
});

rutasAuth.get('/yo', requiereSesion, (req, res) => {
  res.json({ usuario: publico(req.usuario) });
});
