import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

if (config.rutaBd !== ':memory:') fs.mkdirSync(path.dirname(config.rutaBd), { recursive: true });

export const db = new DatabaseSync(config.rutaBd);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS dispositivos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  adulto_nombre TEXT,
  codigo_vinculacion TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  config TEXT NOT NULL,
  estado TEXT,
  ultima_conexion TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL UNIQUE,
  clave_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('administrador','familiar','usuario')),
  dispositivo_id INTEGER NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recordatorios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispositivo_id INTEGER NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('medicamento','llamada','otro')),
  hora TEXT NOT NULL,
  fecha TEXT NOT NULL,
  repeticion TEXT NOT NULL CHECK (repeticion IN ('diario','semanal','una_vez')),
  dias_semana TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  origen TEXT NOT NULL DEFAULT 'app',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medicamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispositivo_id INTEGER NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  dosis TEXT,
  frecuencia TEXT NOT NULL CHECK (frecuencia IN ('diario','cada_12_horas','cada_8_horas','semanal')),
  hora TEXT NOT NULL,
  dia_semana INTEGER,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS familiares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispositivo_id INTEGER NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  relacion TEXT NOT NULL,
  telefono TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mensajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispositivo_id INTEGER NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  autor_nombre TEXT NOT NULL,
  texto TEXT NOT NULL,
  escuchado INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Qué pasó con cada aviso: anunciado, confirmado u omitido.
CREATE TABLE IF NOT EXISTS registros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispositivo_id INTEGER NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  origen TEXT NOT NULL CHECK (origen IN ('recordatorio','medicamento')),
  origen_id INTEGER NOT NULL,
  fecha_local TEXT NOT NULL,
  hora_programada TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('anunciado','confirmado','omitido')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (dispositivo_id, origen, origen_id, fecha_local, hora_programada)
);

-- Comandos, errores y tiempos de respuesta que reporta el asistente (HU-RNF04).
CREATE TABLE IF NOT EXISTS diagnosticos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispositivo_id INTEGER NOT NULL REFERENCES dispositivos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('comando','error','sistema')),
  intencion TEXT,
  detalle TEXT,
  latencia_ms INTEGER,
  exito INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recordatorios_disp ON recordatorios(dispositivo_id);
CREATE INDEX IF NOT EXISTS idx_medicamentos_disp ON medicamentos(dispositivo_id);
CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros(dispositivo_id, fecha_local);
CREATE INDEX IF NOT EXISTS idx_diagnosticos_disp ON diagnosticos(dispositivo_id, creado_en);
`);

/** Política de retención: borra registros y diagnósticos antiguos. */
export function aplicarRetencion() {
  const limite = `-${config.retencionDias} days`;
  db.prepare("DELETE FROM diagnosticos WHERE creado_en < datetime('now', ?)").run(limite);
  db.prepare("DELETE FROM registros WHERE actualizado_en < datetime('now', ?)").run(limite);
}

export function transaccion(fn) {
  db.exec('BEGIN');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
