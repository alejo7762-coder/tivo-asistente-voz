import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extraerRecordatorio, interpretar, quitarPalabraClave } from '../src/intenciones.js';
import { buscarHora, normalizar } from '../src/texto.js';

const ahora = { fecha: '2026-11-12', hora: '10:00', diaSemana: 4 }; // jueves

test('normalizar quita tildes y signos', () => {
  assert.equal(normalizar('¿Qué  hora es, TIVO?'), 'que hora es tivo');
  assert.equal(normalizar('Mañana'), 'manana');
});

test('buscarHora entiende horas dichas en palabras', () => {
  const casos = {
    'a las ocho de la noche': '20:00',
    'a las ocho de la manana': '08:00',
    'a las siete y media': '07:30',
    'a las tres y cuarto de la tarde': '15:15',
    'a las tres': '15:00',
    'a la una': '13:00',
    'a las diez y quince': '10:15',
    'a las nueve menos cuarto': '08:45',
    'a las ocho y treinta y cinco de la noche': '20:35',
    'a las 8:30 pm': '20:30',
    'a las 20:00': '20:00',
    'a las doce de la noche': '00:00',
    'al mediodia': '12:00',
    'a las 6 am': '06:00',
  };
  for (const [frase, esperada] of Object.entries(casos)) assert.equal(buscarHora(frase)?.hora, esperada, frase);
  assert.equal(buscarHora('en veinte minutos', 600).hora, '10:20');
  assert.equal(buscarHora('dentro de media hora', 600).hora, '10:30');
  assert.equal(buscarHora('en dos horas', 600).hora, '12:00');
  assert.equal(buscarHora('tomar la pastilla'), null);
});

test('extraerRecordatorio separa título, hora y repetición, conservando las tildes', () => {
  assert.deepEqual(extraerRecordatorio('Recuérdame tomar la pastilla todos los días a las ocho de la noche', ahora),
    { titulo: 'Tomar la pastilla', hora: '20:00', repeticion: 'diario', diasSemana: [], fecha: '2026-11-12', tipo: 'medicamento' });

  const semanal = extraerRecordatorio('recuérdame hacer ejercicio los lunes miércoles y viernes a las once', ahora);
  assert.deepEqual([semanal.titulo, semanal.hora, semanal.repeticion, semanal.diasSemana], ['Hacer ejercicio', '11:00', 'semanal', [1, 3, 5]]);

  const manana = extraerRecordatorio('ponme un recordatorio para llamar a María mañana a las nueve de la mañana', ahora);
  assert.deepEqual([manana.titulo, manana.hora, manana.fecha, manana.tipo], ['Llamar a María', '09:00', '2026-11-13', 'llamada']);

  // La hora ya pasó hoy: queda para mañana
  assert.equal(extraerRecordatorio('recuérdame la cita médica a las nueve de la mañana', ahora).fecha, '2026-11-13');
  assert.equal(extraerRecordatorio('recuérdame la cita médica a las cuatro', ahora).fecha, '2026-11-12');

  const relativo = extraerRecordatorio('avísame en veinte minutos que apague la estufa', ahora);
  assert.deepEqual([relativo.titulo, relativo.hora, relativo.fecha], ['Apague la estufa', '10:20', '2026-11-12']);

  assert.equal(extraerRecordatorio('recuérdame regar las matas', ahora).hora, null);
});

test('interpretar reconoce los comandos principales', () => {
  const casos = {
    '¿Qué hora es?': 'hora',
    'qué día es hoy': 'fecha',
    'qué tengo para hoy': 'listar_recordatorios',
    'qué pastillas me toca tomar': 'listar_medicamentos',
    'ya me la tomé': 'confirmar_toma',
    'cuál es el número de mi hijo': 'telefono_familiar',
    'llama a mi nieta': 'llamar',
    'léeme los mensajes': 'leer_mensajes',
    'pon música': 'musica_reproducir',
    'para la música': 'musica_detener',
    'pausa': 'musica_pausar',
    'sube el volumen': 'volumen_subir',
    'habla más duro': 'volumen_subir',
    'más pasito por favor': 'volumen_bajar',
    'volumen al cincuenta': 'volumen_fijar',
    'elimina el recordatorio de ejercicios': 'eliminar_recordatorio',
    'recuérdame tomar agua a las tres': 'crear_recordatorio',
    'qué puedes hacer': 'ayuda',
    'repite': 'repetir',
    'sí': 'afirmacion',
    'todavía no': 'negacion',
    'gracias': 'gracias',
    'adiós': 'despedida',
    'cuál es la capital de Francia': 'desconocido',
  };
  for (const [frase, esperada] of Object.entries(casos)) assert.equal(interpretar(frase, ahora).intencion, esperada, frase);
  assert.equal(interpretar('cuál es el número de mi hijo', ahora).datos.quien, 'hijo');
  assert.equal(interpretar('volumen al cincuenta', ahora).datos.volumen, 50);
  assert.equal(interpretar('pon la canción de Carlos Gardel', ahora).datos.consulta, 'carlos gardel');
});

test('quitarPalabraClave acepta las formas en que el reconocedor escribe "tivo"', () => {
  assert.equal(quitarPalabraClave('hola tivo qué hora es'), 'qué hora es');
  assert.equal(quitarPalabraClave('Hola tibo'), '');
  assert.equal(quitarPalabraClave('oye tipo pon música'), 'pon música');
  assert.equal(quitarPalabraClave('qué hora es'), null);
  assert.equal(quitarPalabraClave('ese tipo de cosas no me gustan'), null);
});
