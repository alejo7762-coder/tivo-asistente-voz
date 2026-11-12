export class ErrorHttp extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}

export function texto(valor, campo, { min = 1, max = 120, opcional = false } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (opcional) return null;
    throw new ErrorHttp(400, `El campo "${campo}" es obligatorio.`);
  }
  if (typeof valor !== 'string') throw new ErrorHttp(400, `El campo "${campo}" debe ser texto.`);
  const limpio = valor.trim();
  if (limpio.length < min || limpio.length > max) {
    throw new ErrorHttp(400, `El campo "${campo}" debe tener entre ${min} y ${max} caracteres.`);
  }
  return limpio;
}

export function opcion(valor, campo, permitidos, porDefecto) {
  if (valor === undefined || valor === null) {
    if (porDefecto !== undefined) return porDefecto;
    throw new ErrorHttp(400, `El campo "${campo}" es obligatorio.`);
  }
  if (!permitidos.includes(valor)) {
    throw new ErrorHttp(400, `El campo "${campo}" debe ser uno de: ${permitidos.join(', ')}.`);
  }
  return valor;
}

export function entero(valor, campo, { min, max, porDefecto } = {}) {
  if (valor === undefined || valor === null) {
    if (porDefecto !== undefined) return porDefecto;
    throw new ErrorHttp(400, `El campo "${campo}" es obligatorio.`);
  }
  const n = Number(valor);
  if (!Number.isInteger(n) || (min !== undefined && n < min) || (max !== undefined && n > max)) {
    throw new ErrorHttp(400, `El campo "${campo}" debe ser un número entero entre ${min} y ${max}.`);
  }
  return n;
}

export function booleano(valor, campo, porDefecto) {
  if (valor === undefined || valor === null) return porDefecto;
  if (typeof valor !== 'boolean') throw new ErrorHttp(400, `El campo "${campo}" debe ser verdadero o falso.`);
  return valor;
}

export function idDe(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new ErrorHttp(400, 'Identificador no válido.');
  return id;
}
