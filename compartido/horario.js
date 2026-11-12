// Lógica de horarios compartida entre la API y el asistente.
// Sin dependencias: solo trabaja con textos "HH:MM" y "AAAA-MM-DD".

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Fecha y hora locales de una zona horaria: { fecha:'AAAA-MM-DD', hora:'HH:MM', diaSemana:0-6 } */
export function ahoraLocal(zonaHoraria = 'America/Bogota', instante = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(instante);
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}`, diaSemana: dias[p.weekday] };
}

export function horaValida(texto) {
  return typeof texto === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(texto);
}

export function fechaValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const d = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}

export function diaSemanaDe(fecha) {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay();
}

export function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function deMinutos(minutos) {
  const total = ((minutos % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** "08:00" -> "8:00 AM" */
export function hora12(hora) {
  const [h, m] = hora.split(':').map(Number);
  const sufijo = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

/** "08:00" -> "las 8 de la mañana", pensado para decirlo en voz alta */
export function horaHablada(hora) {
  const [h, m] = hora.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const franja = h < 12 ? 'de la mañana' : h < 19 ? 'de la tarde' : 'de la noche';
  const articulo = h12 === 1 ? 'la' : 'las';
  const minutos = m === 0 ? '' : m === 15 ? ' y cuarto' : m === 30 ? ' y media' : ` y ${m}`;
  return `${articulo} ${h12}${minutos} ${franja}`;
}

/** Horas del día en las que suena un recordatorio en la fecha dada (lista vacía si ese día no aplica). */
export function horasRecordatorio(r, fecha) {
  if (!r.activo) return [];
  if (r.repeticion === 'diario') return [r.hora];
  if (r.repeticion === 'semanal') {
    const dias = (r.diasSemana && r.diasSemana.length) ? r.diasSemana : [diaSemanaDe(r.fecha || fecha)];
    return dias.includes(diaSemanaDe(fecha)) ? [r.hora] : [];
  }
  return r.fecha === fecha ? [r.hora] : []; // una_vez ("Solo hoy")
}

/** Horas del día en las que toca un medicamento en la fecha dada. */
export function horasMedicamento(m, fecha) {
  if (!m.activo) return [];
  const base = aMinutos(m.hora);
  switch (m.frecuencia) {
    case 'diario': return [m.hora];
    case 'cada_12_horas': return [base, base + 720].map(deMinutos).sort();
    case 'cada_8_horas': return [base, base + 480, base + 960].map(deMinutos).sort();
    case 'semanal': return m.diaSemana === diaSemanaDe(fecha) ? [m.hora] : [];
    default: return [];
  }
}

export function textoRepeticion(r) {
  if (r.repeticion === 'diario') return 'Repetición diaria';
  if (r.repeticion === 'semanal') {
    const letras = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const dias = (r.diasSemana && r.diasSemana.length) ? r.diasSemana : [diaSemanaDe(r.fecha)];
    return `Repetición: ${[...dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => letras[d]).join('-')}`;
  }
  return `Una vez: ${r.fecha}`;
}

export function textoFrecuencia(m) {
  switch (m.frecuencia) {
    case 'diario': return `Diario – ${hora12(m.hora)}`;
    case 'cada_12_horas': return `Cada 12 horas – ${hora12(m.hora)}`;
    case 'cada_8_horas': return `Cada 8 horas – ${hora12(m.hora)}`;
    case 'semanal': return `Semanal – ${DIAS[m.diaSemana][0].toUpperCase()}${DIAS[m.diaSemana].slice(1)} ${hora12(m.hora)}`;
    default: return hora12(m.hora);
  }
}
