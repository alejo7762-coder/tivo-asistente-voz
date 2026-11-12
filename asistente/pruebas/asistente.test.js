import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Asistente } from '../src/asistente.js';
import { Planificador } from '../src/planificador.js';

// Jueves 12 de noviembre de 2026, 10:00 a. m. en Bogotá
const INICIO = new Date('2026-11-12T15:00:00Z');

function montar({ conIA = false, requierePalabraClave = false } = {}) {
  let ahora = INICIO;
  const dichos = [];
  const registros = [];
  const api = {
    conectado: true,
    datos: {
      dispositivo: { adultoNombre: 'Doña Carmen' },
      configuracion: { activacionPorVoz: true, palabraClave: 'hola tivo', volumen: 70, repetirCadaMinutos: 5, repeticionesMaximas: 3, zonaHoraria: 'America/Bogota' },
      recordatorios: [{ id: 1, titulo: 'Ejercicios', hora: '11:00', fecha: '2026-11-12', repeticion: 'diario', diasSemana: [], activo: true }],
      medicamentos: [{ id: 7, nombre: 'Losartán', dosis: '50 mg', frecuencia: 'diario', hora: '10:00', activo: true }],
      familiares: [{ id: 1, nombre: 'Andrés', relacion: 'hijo', telefono: '300 555 0101' }],
      mensajes: [{ id: 3, autor: 'Laura', texto: 'Hola abuela' }],
    },
    async crearRecordatorio(r) { const nuevo = { ...r, id: 50, activo: true }; this.datos.recordatorios.push(nuevo); return nuevo; },
    async eliminarRecordatorio(id) { this.datos.recordatorios = this.datos.recordatorios.filter((r) => r.id !== id); },
    async registrar(...datos) { registros.push(datos); },
    async fijarVolumen(v) { this.datos.configuracion.volumen = v; },
    async marcarMensajeEscuchado(id) { this.datos.mensajes = this.datos.mensajes.filter((m) => m.id !== id); },
  };
  const voz = { hablando: false, finUltimaFrase: 0, ultimaFrase: '', configurar() {}, async decir(t) { this.ultimaFrase = t; dichos.push(t); } };
  const reproductor = { sonando: false, pausar: () => false, continuar: () => false, detener: () => false, buscar: () => [], canciones: () => [] };
  const ia = { disponible: conIA, async preguntar() { return 'La capital de Francia es París.'; } };
  const asistente = new Asistente({
    api, voz, ia, reproductor, requierePalabraClave,
    planificador: new Planificador({ api }),
    pantalla: { mostrar() {} },
    reloj: () => ahora,
  });
  return { asistente, api, dichos, registros, avanzar: (minutos) => { ahora = new Date(ahora.getTime() + minutos * 60_000); } };
}

test('responde la hora y la fecha', async () => {
  const { asistente, dichos } = montar();
  await asistente.escuchar('¿Qué hora es?');
  assert.equal(dichos.at(-1), 'Son las 10 de la mañana.');
  await asistente.escuchar('qué día es hoy');
  assert.match(dichos.at(-1), /^Hoy es jueves, 12 de noviembre de 2026\.$/);
});

test('anuncia el medicamento, lo repite y acepta "ya lo tomé"', async () => {
  const { asistente, dichos, registros, avanzar } = montar();
  await asistente.anunciarAvisos();
  assert.equal(dichos.at(-1), 'Doña Carmen, es hora de tomar Losartán de 50 mg. Cuando lo haya tomado, dígame: ya lo tomé.');
  assert.deepEqual(registros.at(-1), ['medicamento', 7, '2026-11-12', '10:00', 'anunciado']);

  await asistente.anunciarAvisos(); // todavía no pasan los 5 minutos: no repite
  assert.equal(dichos.length, 1);
  avanzar(5);
  await asistente.anunciarAvisos();
  assert.match(dichos.at(-1), /le recuerdo de nuevo: es hora de tomar Losartán/);

  await asistente.escuchar('ya me la tomé');
  assert.equal(dichos.at(-1), 'Muy bien, queda anotado.');
  assert.deepEqual(registros.at(-1), ['medicamento', 7, '2026-11-12', '10:00', 'confirmado']);
  avanzar(10);
  await asistente.anunciarAvisos();
  assert.equal(dichos.at(-1), 'Muy bien, queda anotado.');
});

test('marca como omitido un aviso que nadie confirmó', async () => {
  const { asistente, registros, avanzar } = montar();
  for (let i = 0; i < 4; i += 1) { await asistente.anunciarAvisos(); avanzar(5); }
  assert.deepEqual(registros.at(-1), ['medicamento', 7, '2026-11-12', '10:00', 'omitido']);
});

test('crea un recordatorio por voz y pregunta la hora si falta', async () => {
  const { asistente, api, dichos } = montar();
  await asistente.escuchar('recuérdame regar las matas');
  assert.equal(dichos.at(-1), '¿A qué hora le recuerdo: Regar las matas?');
  await asistente.escuchar('a las cuatro de la tarde');
  assert.equal(dichos.at(-1), 'Listo. Le recordaré: Regar las matas, hoy a las 4 de la tarde.');
  assert.equal(api.datos.recordatorios.at(-1).hora, '16:00');

  await asistente.escuchar('recuérdame tomar agua todos los días a las tres');
  assert.equal(dichos.at(-1), 'Listo. Le recordaré: Tomar agua, todos los días a las 3 de la tarde.');
  await asistente.escuchar('recuérdame la cita mañana a las ocho de la mañana');
  assert.equal(dichos.at(-1), 'Listo. Le recordaré: Cita, mañana a las 8 de la mañana.');
});

test('pide confirmación antes de eliminar un recordatorio', async () => {
  const { asistente, api, dichos } = montar();
  await asistente.escuchar('elimina el recordatorio de ejercicios');
  assert.match(dichos.at(-1), /¿Quiere eliminar el recordatorio: Ejercicios/);
  await asistente.escuchar('no');
  assert.equal(api.datos.recordatorios.length, 1);
  await asistente.escuchar('borra el recordatorio de ejercicios');
  await asistente.escuchar('sí');
  assert.equal(api.datos.recordatorios.length, 0);
});

test('dice el teléfono de un familiar dígito por dígito', async () => {
  const { asistente, dichos } = montar();
  await asistente.escuchar('cuál es el número de mi hijo');
  assert.equal(dichos.at(-1), 'El número de su hijo, Andrés, es: 3 0 0, 5 5 5, 0 1 0 1.');
  await asistente.escuchar('llama a Andrés');
  assert.match(dichos.at(-1), /^Yo no puedo hacer llamadas/);
});

test('lee los mensajes y los marca como escuchados', async () => {
  const { asistente, api, dichos } = montar();
  await asistente.escuchar('léeme los mensajes');
  assert.ok(dichos.includes('Mensaje de Laura: Hola abuela'));
  assert.equal(api.datos.mensajes.length, 0);
});

test('ofrece los mensajes nuevos después de sincronizar', async () => {
  const { asistente, dichos } = montar();
  await asistente.trasSincronizar(true);
  assert.equal(dichos.at(-1), 'Doña Carmen, tiene un mensaje nuevo de Laura. ¿Quiere que se lo lea?');
  await asistente.escuchar('sí');
  assert.ok(dichos.includes('Mensaje de Laura: Hola abuela'));
});

test('cambia el volumen por voz', async () => {
  const { asistente, api, dichos } = montar();
  await asistente.escuchar('sube el volumen');
  assert.equal(api.datos.configuracion.volumen, 85);
  await asistente.escuchar('volumen al treinta');
  assert.equal(dichos.at(-1), 'Volumen al 30 por ciento.');
});

test('pide aclaración dos veces y luego cancela', async () => {
  const { asistente, dichos } = montar();
  await asistente.escuchar('bla bla');
  await asistente.escuchar('bla bla');
  await asistente.escuchar('bla bla');
  assert.deepEqual(dichos, [
    'No le entendí. ¿Me lo puede repetir?',
    'Disculpe, sigo sin entender. Dígalo con pocas palabras, por favor.',
    'No logré entenderle. Cuando quiera intentarlo de nuevo, diga: hola TIVO.',
  ]);
});

test('las preguntas abiertas van a la IA', async () => {
  const { asistente, dichos } = montar({ conIA: true });
  await asistente.escuchar('cuál es la capital de Francia');
  assert.equal(dichos.at(-1), 'La capital de Francia es París.');
  assert.equal(asistente.tomarDiagnosticos().at(-1).intencion, 'pregunta_ia');
});

test('con micrófono ignora lo que no empieza con la palabra clave', async () => {
  const { asistente, dichos } = montar({ requierePalabraClave: true });
  await asistente.escuchar('qué hora es');
  assert.equal(dichos.length, 0);
  await asistente.escuchar('hola tivo');
  assert.equal(dichos.at(-1), 'Dígame.');
  await asistente.escuchar('qué hora es'); // dentro de la ventana de escucha
  assert.equal(dichos.at(-1), 'Son las 10 de la mañana.');
  await asistente.escuchar('hola tibo qué día es hoy');
  assert.match(dichos.at(-1), /^Hoy es jueves/);
});
