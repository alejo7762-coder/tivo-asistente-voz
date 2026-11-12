// Acceso a datos y validación. Lo usan tanto las rutas de la app como las del dispositivo.
import { ahoraLocal, fechaValida, horaValida, horasMedicamento, horasRecordatorio, textoFrecuencia, textoRepeticion, hora12 } from '../../compartido/horario.js';
import { CONFIG_DISPOSITIVO_INICIAL } from './config.js';
import { db } from './db.js';
import { cifrar, descifrar } from './util/cifrado.js';
import { ErrorHttp, booleano, entero, opcion, texto } from './util/validar.js';

// ---------- Dispositivo y configuración ----------

export function obtenerDispositivo(dispositivoId) {
  const d = db.prepare('SELECT * FROM dispositivos WHERE id = ?').get(dispositivoId);
  if (!d) throw new ErrorHttp(404, 'Dispositivo no encontrado.');
  return d;
}

export function configDe(dispositivoId) {
  return { ...CONFIG_DISPOSITIVO_INICIAL, ...JSON.parse(obtenerDispositivo(dispositivoId).config) };
}

export function actualizarConfig(dispositivoId, cambios) {
  const actual = configDe(dispositivoId);
  const nueva = {
    sensibilidadMicrofono: opcion(cambios.sensibilidadMicrofono, 'sensibilidadMicrofono', ['baja', 'media', 'alta'], actual.sensibilidadMicrofono),
    activacionPorVoz: booleano(cambios.activacionPorVoz, 'activacionPorVoz', actual.activacionPorVoz),
    palabraClave: cambios.palabraClave === undefined ? actual.palabraClave : texto(cambios.palabraClave, 'palabraClave', { min: 3, max: 30 }).toLowerCase(),
    volumen: entero(cambios.volumen, 'volumen', { min: 0, max: 100, porDefecto: actual.volumen }),
    velocidadVoz: opcion(cambios.velocidadVoz, 'velocidadVoz', ['lenta', 'normal'], actual.velocidadVoz),
    tamanoLetra: opcion(cambios.tamanoLetra, 'tamanoLetra', ['normal', 'grande', 'extra_grande'], actual.tamanoLetra),
    repetirCadaMinutos: entero(cambios.repetirCadaMinutos, 'repetirCadaMinutos', { min: 1, max: 60, porDefecto: actual.repetirCadaMinutos }),
    repeticionesMaximas: entero(cambios.repeticionesMaximas, 'repeticionesMaximas', { min: 1, max: 10, porDefecto: actual.repeticionesMaximas }),
    zonaHoraria: actual.zonaHoraria,
  };
  if (cambios.zonaHoraria !== undefined) {
    try {
      new Intl.DateTimeFormat('es', { timeZone: cambios.zonaHoraria });
      nueva.zonaHoraria = cambios.zonaHoraria;
    } catch {
      throw new ErrorHttp(400, 'Zona horaria no válida.');
    }
  }
  db.prepare('UPDATE dispositivos SET config = ? WHERE id = ?').run(JSON.stringify(nueva), dispositivoId);
  return nueva;
}

// ---------- Registros de avisos (estado de hoy) ----------

function registrosDe(dispositivoId, fecha) {
  const filas = db.prepare('SELECT origen, origen_id, hora_programada, estado FROM registros WHERE dispositivo_id = ? AND fecha_local = ?').all(dispositivoId, fecha);
  return new Map(filas.map((f) => [`${f.origen}:${f.origen_id}:${f.hora_programada}`, f.estado]));
}

/** Resume el día: confirmado, pendiente, omitido, o sin_aviso_hoy / inactivo. */
function estadoDelDia(origen, id, horas, registros, activo) {
  if (!activo) return 'inactivo';
  if (!horas.length) return 'sin_aviso_hoy';
  const estados = horas.map((h) => registros.get(`${origen}:${id}:${h}`));
  if (estados.includes('omitido')) return 'omitido';
  if (estados.every((e) => e === 'confirmado')) return 'confirmado';
  return 'pendiente';
}

export function guardarRegistro(dispositivoId, cuerpo) {
  const origen = opcion(cuerpo.origen, 'origen', ['recordatorio', 'medicamento']);
  const origenId = entero(cuerpo.origenId, 'origenId', { min: 1, max: Number.MAX_SAFE_INTEGER });
  const estado = opcion(cuerpo.estado, 'estado', ['anunciado', 'confirmado', 'omitido']);
  if (!fechaValida(cuerpo.fecha)) throw new ErrorHttp(400, 'La fecha debe tener el formato AAAA-MM-DD.');
  if (!horaValida(cuerpo.hora)) throw new ErrorHttp(400, 'La hora debe tener el formato HH:MM.');
  db.prepare(`INSERT INTO registros (dispositivo_id, origen, origen_id, fecha_local, hora_programada, estado)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (dispositivo_id, origen, origen_id, fecha_local, hora_programada)
    DO UPDATE SET estado = excluded.estado, actualizado_en = datetime('now')`)
    .run(dispositivoId, origen, origenId, cuerpo.fecha, cuerpo.hora, estado);
  // Un recordatorio de una sola vez ya cumplido se desactiva.
  if (origen === 'recordatorio' && estado !== 'anunciado') {
    db.prepare("UPDATE recordatorios SET activo = 0 WHERE id = ? AND dispositivo_id = ? AND repeticion = 'una_vez'").run(origenId, dispositivoId);
  }
}

// ---------- Recordatorios ----------

function fechaCorta(fecha) {
  return new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${fecha}T12:00:00Z`));
}

function aRecordatorio(f, hoy) {
  const r = {
    id: f.id,
    titulo: f.titulo,
    descripcion: f.descripcion,
    tipo: f.tipo,
    hora: f.hora,
    fecha: f.fecha,
    repeticion: f.repeticion,
    diasSemana: f.dias_semana ? f.dias_semana.split(',').map(Number) : [],
    activo: Boolean(f.activo),
    origen: f.origen,
  };
  const repeticionTexto = r.repeticion !== 'una_vez' ? textoRepeticion(r) : (r.fecha === hoy ? 'Solo hoy' : `Una vez: ${fechaCorta(r.fecha)}`);
  return { ...r, horaTexto: hora12(r.hora), repeticionTexto };
}

function validarRecordatorio(cuerpo, previo, hoy) {
  const r = {
    titulo: cuerpo.titulo === undefined && previo ? previo.titulo : texto(cuerpo.titulo, 'titulo', { max: 60 }),
    descripcion: cuerpo.descripcion === undefined && previo ? previo.descripcion : texto(cuerpo.descripcion, 'descripcion', { max: 200, opcional: true }),
    tipo: opcion(cuerpo.tipo, 'tipo', ['medicamento', 'llamada', 'otro'], previo?.tipo ?? 'otro'),
    hora: cuerpo.hora ?? previo?.hora,
    fecha: cuerpo.fecha ?? previo?.fecha ?? hoy,
    repeticion: opcion(cuerpo.repeticion, 'repeticion', ['diario', 'semanal', 'una_vez'], previo?.repeticion ?? 'una_vez'),
    diasSemana: cuerpo.diasSemana ?? previo?.diasSemana ?? [],
    activo: booleano(cuerpo.activo, 'activo', previo?.activo ?? true),
  };
  if (!horaValida(r.hora)) throw new ErrorHttp(400, 'La hora debe tener el formato HH:MM (24 horas).');
  if (!fechaValida(r.fecha)) throw new ErrorHttp(400, 'La fecha debe tener el formato AAAA-MM-DD.');
  if (!Array.isArray(r.diasSemana) || r.diasSemana.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new ErrorHttp(400, 'diasSemana debe ser una lista de números de 0 (domingo) a 6 (sábado).');
  }
  r.diasSemana = r.repeticion === 'semanal' ? [...new Set(r.diasSemana)].sort() : [];
  return r;
}

export function listarRecordatorios(dispositivoId) {
  const hoy = ahoraLocal(configDe(dispositivoId).zonaHoraria).fecha;
  const registros = registrosDe(dispositivoId, hoy);
  return db.prepare('SELECT * FROM recordatorios WHERE dispositivo_id = ? ORDER BY hora, id').all(dispositivoId)
    .map((f) => aRecordatorio(f, hoy))
    .map((r) => ({ ...r, estadoHoy: estadoDelDia('recordatorio', r.id, horasRecordatorio(r, hoy), registros, r.activo) }));
}

function buscarRecordatorio(dispositivoId, id) {
  const f = db.prepare('SELECT * FROM recordatorios WHERE id = ? AND dispositivo_id = ?').get(id, dispositivoId);
  if (!f) throw new ErrorHttp(404, 'Recordatorio no encontrado.');
  return aRecordatorio(f, ahoraLocal(configDe(dispositivoId).zonaHoraria).fecha);
}

export function crearRecordatorio(dispositivoId, cuerpo, origen = 'app') {
  const hoy = ahoraLocal(configDe(dispositivoId).zonaHoraria).fecha;
  const r = validarRecordatorio(cuerpo, null, hoy);
  const { lastInsertRowid } = db.prepare(`INSERT INTO recordatorios
    (dispositivo_id, titulo, descripcion, tipo, hora, fecha, repeticion, dias_semana, activo, origen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(dispositivoId, r.titulo, r.descripcion, r.tipo, r.hora, r.fecha, r.repeticion, r.diasSemana.join(',') || null, r.activo ? 1 : 0, origen);
  return buscarRecordatorio(dispositivoId, Number(lastInsertRowid));
}

export function actualizarRecordatorio(dispositivoId, id, cuerpo) {
  const previo = buscarRecordatorio(dispositivoId, id);
  const r = validarRecordatorio(cuerpo, previo);
  db.prepare(`UPDATE recordatorios SET titulo = ?, descripcion = ?, tipo = ?, hora = ?, fecha = ?, repeticion = ?, dias_semana = ?, activo = ?
    WHERE id = ? AND dispositivo_id = ?`)
    .run(r.titulo, r.descripcion, r.tipo, r.hora, r.fecha, r.repeticion, r.diasSemana.join(',') || null, r.activo ? 1 : 0, id, dispositivoId);
  return buscarRecordatorio(dispositivoId, id);
}

export function eliminarRecordatorio(dispositivoId, id) {
  buscarRecordatorio(dispositivoId, id);
  db.prepare('DELETE FROM recordatorios WHERE id = ? AND dispositivo_id = ?').run(id, dispositivoId);
  db.prepare("DELETE FROM registros WHERE dispositivo_id = ? AND origen = 'recordatorio' AND origen_id = ?").run(dispositivoId, id);
}

// ---------- Medicamentos ----------

function aMedicamento(f) {
  const m = {
    id: f.id,
    nombre: descifrar(f.nombre),
    dosis: descifrar(f.dosis),
    frecuencia: f.frecuencia,
    hora: f.hora,
    diaSemana: f.dia_semana,
    activo: Boolean(f.activo),
  };
  return { ...m, frecuenciaTexto: textoFrecuencia(m) };
}

function validarMedicamento(cuerpo, previo) {
  const m = {
    nombre: cuerpo.nombre === undefined && previo ? previo.nombre : texto(cuerpo.nombre, 'nombre', { max: 60 }),
    dosis: cuerpo.dosis === undefined && previo ? previo.dosis : texto(cuerpo.dosis, 'dosis', { max: 40, opcional: true }),
    frecuencia: opcion(cuerpo.frecuencia, 'frecuencia', ['diario', 'cada_12_horas', 'cada_8_horas', 'semanal'], previo?.frecuencia ?? 'diario'),
    hora: cuerpo.hora ?? previo?.hora,
    diaSemana: cuerpo.diaSemana ?? previo?.diaSemana ?? null,
    activo: booleano(cuerpo.activo, 'activo', previo?.activo ?? true),
  };
  if (!horaValida(m.hora)) throw new ErrorHttp(400, 'La hora debe tener el formato HH:MM (24 horas).');
  if (m.frecuencia === 'semanal') {
    m.diaSemana = entero(m.diaSemana, 'diaSemana', { min: 0, max: 6 });
  } else {
    m.diaSemana = null;
  }
  return m;
}

export function listarMedicamentos(dispositivoId) {
  const hoy = ahoraLocal(configDe(dispositivoId).zonaHoraria).fecha;
  const registros = registrosDe(dispositivoId, hoy);
  return db.prepare('SELECT * FROM medicamentos WHERE dispositivo_id = ? ORDER BY hora, id').all(dispositivoId)
    .map(aMedicamento)
    .map((m) => ({ ...m, estadoHoy: estadoDelDia('medicamento', m.id, horasMedicamento(m, hoy), registros, m.activo) }));
}

function buscarMedicamento(dispositivoId, id) {
  const f = db.prepare('SELECT * FROM medicamentos WHERE id = ? AND dispositivo_id = ?').get(id, dispositivoId);
  if (!f) throw new ErrorHttp(404, 'Medicamento no encontrado.');
  return aMedicamento(f);
}

export function crearMedicamento(dispositivoId, cuerpo) {
  const m = validarMedicamento(cuerpo, null);
  const { lastInsertRowid } = db.prepare(`INSERT INTO medicamentos (dispositivo_id, nombre, dosis, frecuencia, hora, dia_semana, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(dispositivoId, cifrar(m.nombre), cifrar(m.dosis), m.frecuencia, m.hora, m.diaSemana, m.activo ? 1 : 0);
  return buscarMedicamento(dispositivoId, Number(lastInsertRowid));
}

export function actualizarMedicamento(dispositivoId, id, cuerpo) {
  const m = validarMedicamento(cuerpo, buscarMedicamento(dispositivoId, id));
  db.prepare('UPDATE medicamentos SET nombre = ?, dosis = ?, frecuencia = ?, hora = ?, dia_semana = ?, activo = ? WHERE id = ? AND dispositivo_id = ?')
    .run(cifrar(m.nombre), cifrar(m.dosis), m.frecuencia, m.hora, m.diaSemana, m.activo ? 1 : 0, id, dispositivoId);
  return buscarMedicamento(dispositivoId, id);
}

export function eliminarMedicamento(dispositivoId, id) {
  buscarMedicamento(dispositivoId, id);
  db.prepare('DELETE FROM medicamentos WHERE id = ? AND dispositivo_id = ?').run(id, dispositivoId);
  db.prepare("DELETE FROM registros WHERE dispositivo_id = ? AND origen = 'medicamento' AND origen_id = ?").run(dispositivoId, id);
}

// ---------- Familiares ----------

const aFamiliar = (f) => ({ id: f.id, nombre: f.nombre, relacion: f.relacion, telefono: descifrar(f.telefono) });

function validarFamiliar(cuerpo, previo) {
  const f = {
    nombre: cuerpo.nombre === undefined && previo ? previo.nombre : texto(cuerpo.nombre, 'nombre', { max: 60 }),
    relacion: cuerpo.relacion === undefined && previo ? previo.relacion : texto(cuerpo.relacion, 'relacion', { max: 30 }).toLowerCase(),
    telefono: cuerpo.telefono === undefined && previo ? previo.telefono : texto(cuerpo.telefono, 'telefono', { min: 7, max: 20 }),
  };
  if (!/^\+?[\d\s-]{7,20}$/.test(f.telefono)) throw new ErrorHttp(400, 'El teléfono solo puede tener números, espacios y guiones.');
  return f;
}

export function listarFamiliares(dispositivoId) {
  return db.prepare('SELECT * FROM familiares WHERE dispositivo_id = ? ORDER BY nombre').all(dispositivoId).map(aFamiliar);
}

function buscarFamiliar(dispositivoId, id) {
  const f = db.prepare('SELECT * FROM familiares WHERE id = ? AND dispositivo_id = ?').get(id, dispositivoId);
  if (!f) throw new ErrorHttp(404, 'Familiar no encontrado.');
  return aFamiliar(f);
}

export function crearFamiliar(dispositivoId, cuerpo) {
  const f = validarFamiliar(cuerpo, null);
  const { lastInsertRowid } = db.prepare('INSERT INTO familiares (dispositivo_id, nombre, relacion, telefono) VALUES (?, ?, ?, ?)')
    .run(dispositivoId, f.nombre, f.relacion, cifrar(f.telefono));
  return buscarFamiliar(dispositivoId, Number(lastInsertRowid));
}

export function actualizarFamiliar(dispositivoId, id, cuerpo) {
  const f = validarFamiliar(cuerpo, buscarFamiliar(dispositivoId, id));
  db.prepare('UPDATE familiares SET nombre = ?, relacion = ?, telefono = ? WHERE id = ? AND dispositivo_id = ?')
    .run(f.nombre, f.relacion, cifrar(f.telefono), id, dispositivoId);
  return buscarFamiliar(dispositivoId, id);
}

export function eliminarFamiliar(dispositivoId, id) {
  buscarFamiliar(dispositivoId, id);
  db.prepare('DELETE FROM familiares WHERE id = ? AND dispositivo_id = ?').run(id, dispositivoId);
}

// ---------- Mensajes de la familia ----------

const aMensaje = (f) => ({ id: f.id, autor: f.autor_nombre, texto: descifrar(f.texto), escuchado: Boolean(f.escuchado), creadoEn: `${f.creado_en.replace(' ', 'T')}Z` });

export function listarMensajes(dispositivoId, { soloPendientes = false } = {}) {
  const sql = `SELECT * FROM mensajes WHERE dispositivo_id = ? ${soloPendientes ? 'AND escuchado = 0' : ''} ORDER BY id DESC LIMIT 100`;
  return db.prepare(sql).all(dispositivoId).map(aMensaje);
}

export function crearMensaje(dispositivoId, autorNombre, cuerpo) {
  const contenido = texto(cuerpo.texto, 'texto', { max: 500 });
  const { lastInsertRowid } = db.prepare('INSERT INTO mensajes (dispositivo_id, autor_nombre, texto) VALUES (?, ?, ?)')
    .run(dispositivoId, autorNombre, cifrar(contenido));
  return aMensaje(db.prepare('SELECT * FROM mensajes WHERE id = ?').get(Number(lastInsertRowid)));
}

export function marcarMensajeEscuchado(dispositivoId, id) {
  const { changes } = db.prepare('UPDATE mensajes SET escuchado = 1 WHERE id = ? AND dispositivo_id = ?').run(id, dispositivoId);
  if (!changes) throw new ErrorHttp(404, 'Mensaje no encontrado.');
}

export function eliminarMensaje(dispositivoId, id) {
  const { changes } = db.prepare('DELETE FROM mensajes WHERE id = ? AND dispositivo_id = ?').run(id, dispositivoId);
  if (!changes) throw new ErrorHttp(404, 'Mensaje no encontrado.');
}

// ---------- Estado y diagnóstico ----------

/** El dispositivo se considera conectado si reportó en los últimos 3 minutos. */
export function estadoDispositivo(dispositivoId) {
  const d = obtenerDispositivo(dispositivoId);
  const ultima = d.ultima_conexion ? new Date(`${d.ultima_conexion.replace(' ', 'T')}Z`) : null;
  const enLinea = Boolean(ultima) && Date.now() - ultima.getTime() < 3 * 60 * 1000;
  return {
    id: d.id,
    nombre: d.nombre,
    adultoNombre: d.adulto_nombre,
    codigoVinculacion: d.codigo_vinculacion,
    enLinea,
    ultimaConexion: ultima ? ultima.toISOString() : null,
    estado: d.estado ? JSON.parse(d.estado) : null,
  };
}

export function guardarEstado(dispositivoId, cuerpo) {
  const numero = (v, min, max) => (typeof v === 'number' && v >= min && v <= max ? Math.round(v * 10) / 10 : null);
  const estado = {
    internet: Boolean(cuerpo.internet),
    microfono: Boolean(cuerpo.microfono),
    altavoz: Boolean(cuerpo.altavoz),
    volumen: numero(cuerpo.volumen, 0, 100),
    pantalla: Boolean(cuerpo.pantalla),
    temperaturaCpu: numero(cuerpo.temperaturaCpu, -20, 150),
    memoriaUsada: numero(cuerpo.memoriaUsada, 0, 100),
    version: typeof cuerpo.version === 'string' ? cuerpo.version.slice(0, 20) : null,
    modoVoz: typeof cuerpo.modoVoz === 'string' ? cuerpo.modoVoz.slice(0, 20) : null,
    inicio: typeof cuerpo.inicio === 'string' ? cuerpo.inicio.slice(0, 30) : null,
  };
  db.prepare('UPDATE dispositivos SET estado = ? WHERE id = ?').run(JSON.stringify(estado), dispositivoId);
  return estado;
}

export function guardarDiagnosticos(dispositivoId, eventos) {
  if (!Array.isArray(eventos) || eventos.length > 200) throw new ErrorHttp(400, 'Se espera una lista de hasta 200 eventos.');
  const insertar = db.prepare('INSERT INTO diagnosticos (dispositivo_id, tipo, intencion, detalle, latencia_ms, exito) VALUES (?, ?, ?, ?, ?, ?)');
  for (const e of eventos) {
    const tipo = opcion(e.tipo, 'tipo', ['comando', 'error', 'sistema']);
    const latencia = Number.isFinite(e.latenciaMs) ? Math.max(0, Math.round(e.latenciaMs)) : null;
    insertar.run(dispositivoId, tipo, String(e.intencion ?? '').slice(0, 40) || null, String(e.detalle ?? '').slice(0, 300) || null, latencia, e.exito === false ? 0 : 1);
  }
}

export function resumenDiagnostico(dispositivoId) {
  const r = db.prepare(`SELECT
      COUNT(*) AS comandos,
      SUM(CASE WHEN exito = 0 THEN 1 ELSE 0 END) AS fallidos,
      AVG(latencia_ms) AS latenciaPromedio,
      MAX(latencia_ms) AS latenciaMaxima,
      SUM(CASE WHEN latencia_ms < 2000 THEN 1 ELSE 0 END) AS dentroDeMeta
    FROM diagnosticos WHERE dispositivo_id = ? AND tipo = 'comando' AND creado_en >= datetime('now', '-7 days')`).get(dispositivoId);
  const recientes = db.prepare('SELECT tipo, intencion, detalle, latencia_ms, exito, creado_en FROM diagnosticos WHERE dispositivo_id = ? ORDER BY id DESC LIMIT 30').all(dispositivoId)
    .map((f) => ({ tipo: f.tipo, intencion: f.intencion, detalle: f.detalle, latenciaMs: f.latencia_ms, exito: Boolean(f.exito), creadoEn: `${f.creado_en.replace(' ', 'T')}Z` }));
  const comandos = r.comandos || 0;
  return {
    periodoDias: 7,
    comandos,
    fallidos: r.fallidos || 0,
    porcentajeExito: comandos ? Math.round(((comandos - (r.fallidos || 0)) / comandos) * 100) : null,
    latenciaPromedioMs: r.latenciaPromedio === null ? null : Math.round(r.latenciaPromedio),
    latenciaMaximaMs: r.latenciaMaxima,
    porcentajeBajo2s: comandos ? Math.round(((r.dentroDeMeta || 0) / comandos) * 100) : null,
    recientes,
  };
}
