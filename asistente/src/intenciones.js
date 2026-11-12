// Convierte una frase reconocida en una intención con sus datos. Reglas simples, sin Internet.
import { aMinutos } from '../../compartido/horario.js';
import { aNumero, buscarHora, limpiar, mayusculaInicial, normalizarIgualLargo } from './texto.js';

const DIAS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const RE_DIAS = /\b(?:todos )?los ((?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)(?:(?: y | e | )(?:los )?(?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?))*)\b/;
const RE_CREAR = /^(?:por favor )?(?:recuerdame|recuerdeme|recordarme|recordar|acuerdame|avisame|aviseme|(?:pon|ponga|crea|cree|agrega|agregue|programa|programe|anota|anote)(?:me)? (?:un |una |el |la )?(?:recordatorio|alarma)|recordatorio|alarma)\b/;
const RE_ELIMINAR = /^(?:por favor )?(?:elimina|eliminar|elimine|borra|borrar|borre|quita|quitar|quite|cancela|cancelar|cancele)(?:me)? (?:el |la |mi |un )?(?:recordatorio|alarma)(?: (?:de|del|para|que dice))?\s*(.*)$/;

/** Par de textos (original y normalizado) del mismo largo, para recortar tramos en los dos a la vez. */
class Frase {
  constructor(texto) {
    this.original = limpiar(texto);
    this.norm = normalizarIgualLargo(this.original);
  }

  quitar(inicio, fin) {
    this.original = `${this.original.slice(0, inicio)} ${this.original.slice(fin)}`;
    this.norm = `${this.norm.slice(0, inicio)} ${this.norm.slice(fin)}`;
  }

  quitarPatron(regex) {
    const m = regex.exec(this.norm);
    if (m) this.quitar(m.index, m.index + m[0].length);
    return m;
  }

  resto() {
    return this.original.replace(/\s+/g, ' ').trim();
  }
}

function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function tipoDe(tituloNorm) {
  if (/\b(pastilla|pastillas|medicamento|medicina|remedio|insulina|jarabe|gotas|capsula|tableta|inyeccion)\b/.test(tituloNorm)) return 'medicamento';
  if (/\b(llamar|llamada|telefonear)\b/.test(tituloNorm)) return 'llamada';
  return 'otro';
}

/** Extrae hora, repetición, fecha y título de "recuérdame tomar la pastilla todos los días a las ocho". */
export function extraerRecordatorio(texto, ahora) {
  const frase = new Frase(texto);
  frase.quitarPatron(RE_CREAR);

  const hallada = buscarHora(frase.norm, aMinutos(ahora.hora));
  if (hallada) frase.quitar(hallada.inicio, hallada.fin);

  let repeticion = 'una_vez';
  let diasSemana = [];
  let fecha = ahora.fecha;
  if (frase.quitarPatron(/\b(?:todos los dias|todas las (?:mananas|tardes|noches)|cada dia|diariamente|a diario|diario)\b/)) {
    repeticion = 'diario';
  } else {
    const dias = frase.quitarPatron(RE_DIAS);
    if (dias) {
      repeticion = 'semanal';
      diasSemana = [...new Set(dias[1].split(/ y | e | /).map((d) => DIAS[d.replace(/^(sabado|domingo)s$/, '$1')]).filter((d) => d !== undefined))].sort();
    } else if (frase.quitarPatron(/\bpasado manana\b/)) fecha = sumarDias(ahora.fecha, 2);
    else if (frase.quitarPatron(/\bmanana\b/)) fecha = sumarDias(ahora.fecha, 1);
    else frase.quitarPatron(/\bhoy\b/);
  }
  frase.quitarPatron(/\bpor favor\b/);

  // Si no dijeron "mañana" y la hora ya pasó hoy, el aviso queda para mañana.
  if (hallada && repeticion === 'una_vez' && fecha === ahora.fecha && !hallada.relativaMinutos && hallada.hora <= ahora.hora) {
    fecha = sumarDias(ahora.fecha, 1);
  }
  if (hallada?.relativaMinutos && aMinutos(ahora.hora) + hallada.relativaMinutos >= 1440) fecha = sumarDias(ahora.fecha, 1);

  let titulo = frase.resto().replace(/^(?:que debo |que tengo que |que |de |para |sobre |el |la )+/i, '').replace(/(?: a| de| para| y)$/i, '').trim();
  titulo = mayusculaInicial(titulo) || 'Recordatorio';
  return { titulo: titulo.slice(0, 60), hora: hallada?.hora ?? null, repeticion, diasSemana, fecha, tipo: tipoDe(normalizarIgualLargo(titulo)) };
}

const REGLAS = [
  ['confirmar_toma', /\bya (?:me )?(?:l[oa]s? )?(?:tome|hice|termine|comi|llame)\b|\bya esta\b|\bya (?:me )?tome\b/],
  ['hora', /\bque hora\b|\bdime la hora\b|\bdigame la hora\b|\bla hora\b/],
  ['fecha', /\bque dia es\b|\bque fecha\b|\ba cuanto(?:s)? estamos\b|\bdia es hoy\b/],
  ['listar_medicamentos', /\b(?:que|cuales|cuando|mis)\b.*\b(?:medicamentos?|medicinas?|pastillas?|remedios?)\b|\bcuando me toca\b/],
  ['listar_recordatorios', /\bque tengo\b|\bmis recordatorios\b|\bque recordatorios\b|\bque (?:debo|tengo que) hacer\b|\bpendientes\b|\bmi agenda\b/],
  ['leer_mensajes', /\b(?:lee|leeme|leer|tengo|hay|escuchar|reproduce|reproducir|pon|dime)\b.*\bmensajes?\b|\bmis mensajes\b/],
  ['llamar', /^(?:por favor )?(?:llama|llamar|llame|llamame|marca|marcar|marque)(?: a| al)?(?: mi| la| el)? (.+)$/],
  ['telefono_familiar', /\b(?:numero|telefono|celular)\b.*\b(?:de|del) (?:mi |la |el )?(.+)$/],
  ['listar_familiares', /\bmis (?:familiares|contactos)\b|\bquienes son mi familia\b/],
  ['musica_pausar', /^(?:pausa|pausar|pause)\b|\bpausa la (?:musica|cancion)\b/],
  ['musica_continuar', /^(?:continua|continuar|continue|sigue|siga|reanuda|reanudar)\b/],
  ['musica_detener', /\b(?:deten|detener|detenga|para|pare|quita|quite|apaga|apague)\b.*\b(?:musica|cancion|eso)\b|^(?:silencio|basta|para|pare|deten|detener)$/],
  ['musica_reproducir', /\b(?:pon|ponga|ponme|reproduce|reproducir|reproduzca|toca|toque|quiero (?:oir|escuchar)|escuchar)\b.*?\b(?:musica|cancion|canciones)\b(?: (?:de|llamada|que se llama) )?(.*)$/],
  ['volumen_fijar', new RegExp('\\bvolumen (?:al?|en) (\\d{1,3}|cero|diez|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien)\\b')],
  ['volumen_subir', /\b(?:sube|suba|subir|subele|aumenta|aumente)\b.*\bvolumen\b|\b(?:habla|hable|ponlo|pongalo)? ?mas (?:alto|duro|fuerte)\b|\bno (?:te |le )?(?:oigo|escucho)\b/],
  ['volumen_bajar', /\b(?:baja|baje|bajar|bajale|reduce|reduzca)\b.*\bvolumen\b|\bmas (?:bajo|pasito|suave|bajito)\b/],
  ['repetir', /^(?:repite|repita|repetir|otra vez|de nuevo)\b|\bcomo dij(?:iste|o)\b|\bno (?:te |le )?entendi\b/],
  ['ayuda', /^ayuda\b|\bque (?:puedes|puede|sabes|sabe) hacer\b|\bpara que sirves?\b|\bcomo (?:te|lo) uso\b/],
  ['despedida', /^(?:adios|chao|hasta luego|hasta manana|nada mas|eso es todo|ya no mas)\b/],
  ['gracias', /^(?:muchas )?gracias\b/],
  ['saludo', /^(?:hola|buenos dias|buenas tardes|buenas noches|buenas)$/],
];

const DECENAS = { cero: 0, diez: 10, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100 };

/** Respuestas cortas a una pregunta de sí o no. */
export function esAfirmacion(norm) {
  return /^(?:si|claro|claro que si|listo|hecho|ya|correcto|de acuerdo|ok|okey|bueno|dale|por supuesto|afirmativo|eso|asi es|si señor|si senor|si por favor)\b/.test(norm);
}

export function esNegacion(norm) {
  return /^(?:no|todavia no|aun no|cancelar|cancela|cancele|despues|mas tarde|ahora no|dejalo|dejelo|olvidalo|olvidelo)\b/.test(norm);
}

/** Devuelve { intencion, datos, norm }. */
export function interpretar(texto, ahora) {
  const original = limpiar(texto);
  const norm = normalizarIgualLargo(original);
  if (!norm) return { intencion: 'vacio', datos: {}, norm };

  if (RE_CREAR.test(norm)) return { intencion: 'crear_recordatorio', datos: extraerRecordatorio(original, ahora), norm };

  const eliminar = RE_ELIMINAR.exec(norm);
  if (eliminar) return { intencion: 'eliminar_recordatorio', datos: { consulta: eliminar[1].trim() }, norm };

  for (const [intencion, regla] of REGLAS) {
    const m = regla.exec(norm);
    if (!m) continue;
    const datos = {};
    if (intencion === 'llamar' || intencion === 'telefono_familiar') datos.quien = m[1].trim();
    if (intencion === 'musica_reproducir') datos.consulta = (m[1] || '').trim();
    if (intencion === 'volumen_fijar') datos.volumen = Math.min(100, DECENAS[m[1]] ?? aNumero(m[1]) ?? Number(m[1]));
    return { intencion, datos, norm };
  }

  if (esAfirmacion(norm)) return { intencion: 'afirmacion', datos: {}, norm };
  if (esNegacion(norm)) return { intencion: 'negacion', datos: {}, norm };
  return { intencion: 'desconocido', datos: {}, norm };
}

/**
 * Detecta la palabra clave ("hola tivo"). Devuelve lo que se dijo después, o null si no la nombraron.
 * El reconocedor no conoce la palabra "tivo", así que se aceptan las formas en que suele escribirla.
 */
export function quitarPalabraClave(texto, palabraClave = 'hola tivo') {
  const original = limpiar(texto);
  const norm = normalizarIgualLargo(original);
  const nombre = normalizarIgualLargo(palabraClave).split(' ').pop();
  const variantes = nombre === 'tivo' ? 'tivo|tibo|tipo|tigo|divo|tiro|chivo|ti vo|ti bo|tio|tebeo' : nombre;
  const conSaludo = new RegExp(`\\b(?:hola|ola|oye|oiga|hey|ey)\\s+(?:${variantes})\\b`);
  const soloNombre = new RegExp(`^(?:${nombre === 'tivo' ? 'tivo|tibo|ti vo' : nombre})\\b`);
  const m = conSaludo.exec(norm) || soloNombre.exec(norm);
  if (!m) return null;
  return original.slice(m.index + m[0].length).trim();
}
