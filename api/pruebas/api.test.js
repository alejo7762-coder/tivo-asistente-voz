import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.RUTA_BD = ':memory:';
process.env.JWT_SECRETO = 'secreto-de-pruebas';
process.env.CLAVE_CIFRADO = 'clave-de-pruebas';

const { crearApp } = await import('../src/app.js');
const { db } = await import('../src/db.js');
const { crearDispositivo } = await import('../scripts/crear-dispositivo.js');
const { ahoraLocal } = await import('../../compartido/horario.js');

let servidor;
let base;
let dispositivo;
let sesion;

async function pedir(metodo, ruta, { cuerpo, token, tokenDispositivo } = {}) {
  const respuesta = await fetch(base + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tokenDispositivo ? { 'X-Token-Dispositivo': tokenDispositivo } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await respuesta.text();
  return { estado: respuesta.status, datos: texto ? JSON.parse(texto) : null };
}

before(async () => {
  dispositivo = crearDispositivo('TIVO de pruebas', 'Doña Carmen');
  servidor = crearApp().listen(0);
  await new Promise((ok) => servidor.once('listening', ok));
  base = `http://127.0.0.1:${servidor.address().port}/api`;
});

after(() => servidor.close());

test('registro: la primera cuenta es administradora y la segunda familiar', async () => {
  const r1 = await pedir('POST', '/auth/registro', { cuerpo: { nombre: 'Ana', correo: 'ana@correo.com', clave: 'clave-segura', codigoVinculacion: dispositivo.codigo } });
  assert.equal(r1.estado, 201);
  assert.equal(r1.datos.usuario.rol, 'administrador');
  sesion = r1.datos.token;

  const r2 = await pedir('POST', '/auth/registro', { cuerpo: { nombre: 'Luis', correo: 'luis@correo.com', clave: 'clave-segura', codigoVinculacion: dispositivo.codigo.toLowerCase() } });
  assert.equal(r2.datos.usuario.rol, 'familiar');

  const repetido = await pedir('POST', '/auth/registro', { cuerpo: { nombre: 'Ana', correo: 'ana@correo.com', clave: 'clave-segura', codigoVinculacion: dispositivo.codigo } });
  assert.equal(repetido.estado, 409);
  const sinCodigo = await pedir('POST', '/auth/registro', { cuerpo: { nombre: 'X', correo: 'x@correo.com', clave: 'clave-segura', codigoVinculacion: 'ZZZZZZ' } });
  assert.equal(sinCodigo.estado, 404);
});

test('ingreso: rechaza una contraseña incorrecta', async () => {
  assert.equal((await pedir('POST', '/auth/ingresar', { cuerpo: { correo: 'ana@correo.com', clave: 'otra' } })).estado, 401);
  const ok = await pedir('POST', '/auth/ingresar', { cuerpo: { correo: 'ANA@correo.com', clave: 'clave-segura' } });
  assert.equal(ok.estado, 200);
  assert.ok(ok.datos.token);
});

test('las rutas exigen sesión', async () => {
  assert.equal((await pedir('GET', '/recordatorios')).estado, 401);
  assert.equal((await pedir('GET', '/recordatorios', { token: 'falso' })).estado, 401);
  assert.equal((await pedir('GET', '/equipo/sincronizar', { tokenDispositivo: 'falso' })).estado, 401);
});

test('recordatorios: crear, validar, editar y eliminar', async () => {
  const malo = await pedir('POST', '/recordatorios', { token: sesion, cuerpo: { titulo: 'Cita', hora: '25:00' } });
  assert.equal(malo.estado, 400);

  const creado = await pedir('POST', '/recordatorios', { token: sesion, cuerpo: { titulo: 'Ejercicios', hora: '11:00', repeticion: 'semanal', diasSemana: [5, 1, 3] } });
  assert.equal(creado.estado, 201);
  assert.equal(creado.datos.horaTexto, '11:00 AM');
  assert.equal(creado.datos.repeticionTexto, 'Repetición: L-X-V');

  const editado = await pedir('PUT', `/recordatorios/${creado.datos.id}`, { token: sesion, cuerpo: { hora: '16:30' } });
  assert.equal(editado.datos.hora, '16:30');
  assert.equal(editado.datos.titulo, 'Ejercicios');

  assert.equal((await pedir('DELETE', `/recordatorios/${creado.datos.id}`, { token: sesion })).estado, 204);
  assert.equal((await pedir('DELETE', `/recordatorios/${creado.datos.id}`, { token: sesion })).estado, 404);
});

test('medicamentos: se guardan cifrados y se devuelven legibles', async () => {
  const creado = await pedir('POST', '/medicamentos', { token: sesion, cuerpo: { nombre: 'Metformina', dosis: '500 mg', frecuencia: 'cada_12_horas', hora: '09:00' } });
  assert.equal(creado.estado, 201);
  assert.equal(creado.datos.frecuenciaTexto, 'Cada 12 horas – 9:00 AM');
  const fila = db.prepare('SELECT nombre FROM medicamentos WHERE id = ?').get(creado.datos.id);
  assert.ok(fila.nombre.startsWith('c1:'));
  assert.ok(!fila.nombre.includes('Metformina'));

  const semanalSinDia = await pedir('POST', '/medicamentos', { token: sesion, cuerpo: { nombre: 'Vitamina D', frecuencia: 'semanal', hora: '07:00' } });
  assert.equal(semanalSinDia.estado, 400);
});

test('familiares: el teléfono se cifra y se valida', async () => {
  const creado = await pedir('POST', '/familiares', { token: sesion, cuerpo: { nombre: 'Andrés', relacion: 'Hijo', telefono: '300 555 0101' } });
  assert.equal(creado.datos.relacion, 'hijo');
  assert.equal(creado.datos.telefono, '300 555 0101');
  assert.ok(db.prepare('SELECT telefono FROM familiares WHERE id = ?').get(creado.datos.id).telefono.startsWith('c1:'));
  assert.equal((await pedir('POST', '/familiares', { token: sesion, cuerpo: { nombre: 'X', relacion: 'hijo', telefono: 'abc' } })).estado, 400);
});

test('dispositivo: sincroniza, reporta estado y confirma una toma', async () => {
  const tokenDispositivo = dispositivo.token;
  await pedir('POST', '/mensajes', { token: sesion, cuerpo: { texto: 'Hola mamá' } });

  const sync = await pedir('GET', '/equipo/sincronizar', { tokenDispositivo });
  assert.equal(sync.estado, 200);
  assert.equal(sync.datos.configuracion.palabraClave, 'hola tivo');
  assert.equal(sync.datos.medicamentos.length, 1);
  assert.equal(sync.datos.mensajes.length, 1);

  const medicamento = sync.datos.medicamentos[0];
  assert.equal(medicamento.estadoHoy, 'pendiente');
  const hoy = ahoraLocal('America/Bogota').fecha;
  for (const hora of ['09:00', '21:00']) {
    const r = await pedir('POST', '/equipo/registros', { tokenDispositivo, cuerpo: { origen: 'medicamento', origenId: medicamento.id, fecha: hoy, hora, estado: 'confirmado' } });
    assert.equal(r.estado, 204);
  }
  const lista = await pedir('GET', '/medicamentos', { token: sesion });
  assert.equal(lista.datos[0].estadoHoy, 'confirmado');

  await pedir('POST', '/equipo/estado', { tokenDispositivo, cuerpo: { internet: true, microfono: true, altavoz: true, volumen: 80, pantalla: true, temperaturaCpu: 42.3, memoriaUsada: 61 } });
  const estado = await pedir('GET', '/dispositivo', { token: sesion });
  assert.equal(estado.datos.enLinea, true);
  assert.equal(estado.datos.estado.temperaturaCpu, 42.3);

  await pedir('POST', `/equipo/mensajes/${sync.datos.mensajes[0].id}/escuchado`, { tokenDispositivo });
  assert.equal((await pedir('GET', '/equipo/sincronizar', { tokenDispositivo })).datos.mensajes.length, 0);
});

test('un recordatorio de una sola vez se desactiva al confirmarse', async () => {
  const hoy = ahoraLocal('America/Bogota').fecha;
  const creado = await pedir('POST', '/equipo/recordatorios', { tokenDispositivo: dispositivo.token, cuerpo: { titulo: 'Llamar a la familia', tipo: 'llamada', hora: '15:00' } });
  assert.equal(creado.datos.origen, 'voz');
  assert.equal(creado.datos.fecha, hoy);
  await pedir('POST', '/equipo/registros', { tokenDispositivo: dispositivo.token, cuerpo: { origen: 'recordatorio', origenId: creado.datos.id, fecha: hoy, hora: '15:00', estado: 'confirmado' } });
  const lista = await pedir('GET', '/recordatorios', { token: sesion });
  assert.equal(lista.datos.find((r) => r.id === creado.datos.id).activo, false);
});

test('configuración: valida rangos y el dispositivo puede cambiar el volumen', async () => {
  assert.equal((await pedir('PUT', '/dispositivo/configuracion', { token: sesion, cuerpo: { volumen: 150 } })).estado, 400);
  const ok = await pedir('PUT', '/dispositivo/configuracion', { token: sesion, cuerpo: { tamanoLetra: 'extra_grande', sensibilidadMicrofono: 'alta' } });
  assert.equal(ok.datos.tamanoLetra, 'extra_grande');
  const porVoz = await pedir('PUT', '/equipo/configuracion', { tokenDispositivo: dispositivo.token, cuerpo: { volumen: 90 } });
  assert.equal(porVoz.datos.volumen, 90);
  assert.equal(porVoz.datos.sensibilidadMicrofono, 'alta');
});

test('diagnóstico: resume tiempos de respuesta', async () => {
  const eventos = [
    { tipo: 'comando', intencion: 'hora', latenciaMs: 400, exito: true },
    { tipo: 'comando', intencion: 'pregunta_ia', latenciaMs: 3200, exito: true },
    { tipo: 'comando', intencion: 'desconocido', latenciaMs: 300, exito: false },
  ];
  assert.equal((await pedir('POST', '/equipo/diagnostico', { tokenDispositivo: dispositivo.token, cuerpo: { eventos } })).estado, 204);
  const resumen = await pedir('GET', '/diagnostico', { token: sesion });
  assert.equal(resumen.datos.comandos, 3);
  assert.equal(resumen.datos.fallidos, 1);
  assert.equal(resumen.datos.latenciaPromedioMs, 1300);
  assert.equal(resumen.datos.porcentajeBajo2s, 67);
});

test('roles: una cuenta "usuario" solo puede leer; solo el administrador borra datos', async () => {
  const luis = (await pedir('POST', '/auth/ingresar', { cuerpo: { correo: 'luis@correo.com', clave: 'clave-segura' } })).datos;
  assert.equal((await pedir('DELETE', '/datos', { token: luis.token })).estado, 403);

  await pedir('PUT', `/usuarios/${luis.usuario.id}/rol`, { token: sesion, cuerpo: { rol: 'usuario' } });
  assert.equal((await pedir('GET', '/recordatorios', { token: luis.token })).estado, 200);
  assert.equal((await pedir('POST', '/recordatorios', { token: luis.token, cuerpo: { titulo: 'X', hora: '10:00' } })).estado, 403);

  const exportado = await pedir('GET', '/datos/exportar', { token: sesion });
  assert.equal(exportado.datos.familiares[0].nombre, 'Andrés');
  assert.equal((await pedir('DELETE', '/datos', { token: sesion })).estado, 204);
  assert.equal((await pedir('GET', '/medicamentos', { token: sesion })).datos.length, 0);
});

test('un dispositivo no ve los datos de otro', async () => {
  const otro = crearDispositivo('Otro TIVO');
  await pedir('POST', '/recordatorios', { token: sesion, cuerpo: { titulo: 'Privado', hora: '10:00' } });
  const sync = await pedir('GET', '/equipo/sincronizar', { tokenDispositivo: otro.token });
  assert.equal(sync.datos.recordatorios.length, 0);
});
