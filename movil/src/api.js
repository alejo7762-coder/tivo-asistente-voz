// Cliente de la API de TIVO.
export const URL_INICIAL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');

export class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.estado = estado;
  }
}

export function normalizarUrl(url) {
  let limpia = String(url || '').trim().replace(/\/+$/, '');
  if (limpia && !/^https?:\/\//i.test(limpia)) limpia = `http://${limpia}`;
  if (limpia && !/\/api$/i.test(limpia)) limpia += '/api';
  return limpia;
}

export async function pedir(urlBase, metodo, ruta, { cuerpo, token } = {}) {
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), 10000);
  let respuesta;
  try {
    respuesta = await fetch(`${urlBase}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: control.signal,
    });
  } catch {
    throw new ErrorApi('No se pudo conectar con el servidor de TIVO. Revise su conexión y la dirección del servidor.', 0);
  } finally {
    clearTimeout(limite);
  }
  const texto = await respuesta.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { /* respuesta que no es JSON */ }
  if (!respuesta.ok) throw new ErrorApi(datos?.error || `El servidor respondió con un error (${respuesta.status}).`, respuesta.status);
  return datos;
}
