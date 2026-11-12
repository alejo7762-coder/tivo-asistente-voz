// Utilidades para entender frases en español: normalizar texto y encontrar horas dichas en palabras.
import { deMinutos } from '../../compartido/horario.js';

/**
 * Pasa a minúsculas y quita tildes y signos SIN cambiar la longitud del texto,
 * para poder recortar el mismo tramo en el texto original (que sí conserva las tildes).
 */
export function normalizarIgualLargo(texto) {
  let salida = '';
  for (const c of texto.normalize('NFC')) {
    if (/[¿?¡!.,;"()]/.test(c)) { salida += ' '.repeat(c.length); continue; }
    if (c === 'ñ' || c === 'Ñ') { salida += 'n'; continue; }
    const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    salida += base.length === c.length ? base : c.toLowerCase();
  }
  return salida;
}

export function limpiar(texto) {
  return String(texto ?? '').normalize('NFC').replace(/[¿?¡!.,;"()]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizar(texto) {
  return normalizarIgualLargo(limpiar(texto));
}

const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
  'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidos', 'veintitres', 'veinticuatro', 'veinticinco', 'veintiseis',
  'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = { 30: 'treinta', 40: 'cuarenta', 50: 'cincuenta' };

const NUMEROS = new Map();
UNIDADES.forEach((palabra, n) => NUMEROS.set(palabra, n));
NUMEROS.set('un', 1).set('una', 1).set('veintiun', 21).set('veintiuna', 21);
for (const [valor, palabra] of Object.entries(DECENAS)) {
  NUMEROS.set(palabra, Number(valor));
  for (let u = 1; u <= 9; u += 1) NUMEROS.set(`${palabra} y ${UNIDADES[u]}`, Number(valor) + u);
}

/** "veinticinco" -> 25, "treinta y cinco" -> 35, "8" -> 8. Devuelve null si no es un número de 0 a 59. */
export function aNumero(palabra) {
  if (palabra === undefined || palabra === null) return null;
  if (/^\d{1,2}$/.test(palabra)) return Number(palabra);
  return NUMEROS.has(palabra) ? NUMEROS.get(palabra) : null;
}

const alternativas = (palabras) => [...palabras].sort((a, b) => b.length - a.length).join('|');
const PALABRAS_NUMERO = alternativas(NUMEROS.keys());
const HORA = `\\d{1,2}|${alternativas(['una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce'])}`;
const MINUTO = `\\d{1,2}|media|cuarto|${PALABRAS_NUMERO}`;

const RE_HORA = new RegExp(
  `\\b(?:a|para) las? (${HORA})(?:(?::| y | con )(${MINUTO}))?(?: menos (${MINUTO}))?(?: en punto)?`
  + '(?: (?:de|por|en) la (manana|tarde|noche|madrugada)| del? (mediodia)| ?(am|pm|a m|p m)\\b)?',
);
const RE_RELATIVA = new RegExp(`\\b(?:en|dentro de) (media|${PALABRAS_NUMERO}|\\d{1,3}) (minutos?|horas?)\\b`);

function minutosDe(palabra) {
  if (palabra === 'media') return 30;
  if (palabra === 'cuarto') return 15;
  return aNumero(palabra);
}

/**
 * Busca una hora en una frase ya normalizada.
 * Devuelve { hora: 'HH:MM', inicio, fin, relativaMinutos? } o null.
 * Sin "de la mañana/tarde/noche": de 1 a 6 se toma como tarde, de 7 a 11 como mañana.
 */
export function buscarHora(frase, minutosActuales = null) {
  const relativa = RE_RELATIVA.exec(frase);
  if (relativa && minutosActuales !== null) {
    const cantidad = relativa[1] === 'media' ? 0.5 : (aNumero(relativa[1]) ?? Number(relativa[1]));
    const minutos = Math.round(cantidad * (relativa[2].startsWith('hora') ? 60 : 1));
    if (minutos > 0 && minutos < 24 * 60) {
      return { hora: deMinutos(minutosActuales + minutos), relativaMinutos: minutos, inicio: relativa.index, fin: relativa.index + relativa[0].length };
    }
  }

  const fija = /\b(?:al|a) (mediodia|medianoche|media noche)\b/.exec(frase);
  if (fija) return { hora: fija[1] === 'mediodia' ? '12:00' : '00:00', inicio: fija.index, fin: fija.index + fija[0].length };

  const m = RE_HORA.exec(frase);
  if (!m) return null;
  let h = aNumero(m[1]);
  let minutos = m[2] ? minutosDe(m[2]) : 0;
  if (h === null || h > 23 || minutos === null || minutos > 59) return null;
  const franja = m[4] || m[5] || (m[6] ? m[6].replace(' ', '') : null);

  if (franja === 'tarde' || franja === 'pm') h = h < 12 ? h + 12 : h;
  else if (franja === 'noche') h = h === 12 ? 0 : (h >= 5 && h < 12 ? h + 12 : h);
  else if (franja === 'manana' || franja === 'madrugada' || franja === 'am') h = h === 12 ? 0 : h;
  else if (franja === 'mediodia') h = 12;
  else if (h >= 1 && h <= 6) h += 12;

  let total = h * 60 + minutos;
  if (m[3]) {
    const resta = minutosDe(m[3]);
    if (resta === null) return null;
    total -= resta;
  }
  return { hora: deMinutos(total), inicio: m.index, fin: m.index + m[0].length };
}

export function mayusculaInicial(texto) {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto;
}
