// Cliente de la API con copia local: si no hay Internet, el asistente sigue con los últimos datos
// y guarda los cambios pendientes para enviarlos cuando vuelva la conexión.
import fs from 'node:fs';
import path from 'node:path';

const VACIO = {
  dispositivo: { nombre: 'TIVO', adultoNombre: null },
  configuracion: {
    sensibilidadMicrofono: 'media', activacionPorVoz: true, palabraClave: 'hola tivo', volumen: 70, velocidadVoz: 'lenta',
    repetirCadaMinutos: 5, repeticionesMaximas: 3, zonaHoraria: 'America/Bogota',
  },
  recordatorios: [], medicamentos: [], familiares: [], mensajes: [],
};

export class ClienteApi {
  constructor({ urlApi, token, rutaDatos, pedir = fetch }) {
    this.urlApi = urlApi;
    this.token = token;
    this.pedir = pedir;
    this.rutaCache = rutaDatos ? path.join(rutaDatos, 'cache.json') : null;
    this.rutaPendientes = rutaDatos ? path.join(rutaDatos, 'pendientes.json') : null;
    this.datos = this.#leer(this.rutaCache) ?? structuredClone(VACIO);
    this.pendientes = this.#leer(this.rutaPendientes) ?? [];
    this.conectado = false;
    this.idTemporal = -1;
  }

  #leer(ruta) {
    try {
      return ruta ? JSON.parse(fs.readFileSync(ruta, 'utf8')) : null;
    } catch {
      return null;
    }
  }

  #guardar(ruta, contenido) {
    if (!ruta) return;
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(`${ruta}.tmp`, JSON.stringify(contenido));
    fs.renameSync(`${ruta}.tmp`, ruta);
  }

  async #llamar(metodo, ruta, cuerpo) {
    const respuesta = await this.pedir(`${this.urlApi}/equipo${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', 'X-Token-Dispositivo': this.token },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(8000),
    });
    const texto = await respuesta.text();
    const datos = texto ? JSON.parse(texto) : null;
    if (!respuesta.ok) {
      const error = new Error(datos?.error || `Error ${respuesta.status}`);
      error.estado = respuesta.status;
      throw error;
    }
    return datos;
  }

  /** Envía lo pendiente y trae los datos actuales. Devuelve true si hubo conexión. */
  async sincronizar() {
    try {
      await this.#enviarPendientes();
      this.datos = await this.#llamar('GET', '/sincronizar');
      this.#guardar(this.rutaCache, this.datos);
      this.conectado = true;
      this.rechazado = false;
    } catch (error) {
      this.conectado = false;
      this.rechazado = Boolean(error.estado); // la API respondió, pero no aceptó la solicitud
      this.ultimoError = error.estado === 401 ? 'El token del dispositivo no es válido (revise TOKEN_DISPOSITIVO).' : error.message;
    }
    return this.conectado;
  }

  async #enviarPendientes() {
    while (this.pendientes.length) {
      const [metodo, ruta, cuerpo] = this.pendientes[0];
      try {
        await this.#llamar(metodo, ruta, cuerpo);
      } catch (error) {
        if (!error.estado) throw error; // sin conexión: se reintenta en la próxima sincronización
        // La API lo rechazó (por ejemplo, el recordatorio ya no existe): se descarta.
      }
      this.pendientes.shift();
      this.#guardar(this.rutaPendientes, this.pendientes);
    }
  }

  /** Intenta enviar ahora; si no hay conexión lo deja en cola. */
  async #enviarOEncolar(metodo, ruta, cuerpo) {
    try {
      const datos = await this.#llamar(metodo, ruta, cuerpo);
      this.conectado = true;
      return datos;
    } catch (error) {
      if (error.estado) throw error;
      this.conectado = false;
      this.pendientes.push([metodo, ruta, cuerpo]);
      this.#guardar(this.rutaPendientes, this.pendientes);
      return null;
    }
  }

  async crearRecordatorio(recordatorio) {
    const creado = await this.#enviarOEncolar('POST', '/recordatorios', recordatorio);
    const local = creado ?? { ...recordatorio, id: this.idTemporal--, activo: true, diasSemana: recordatorio.diasSemana ?? [] };
    this.datos.recordatorios.push(local);
    this.#guardar(this.rutaCache, this.datos);
    return local;
  }

  async eliminarRecordatorio(id) {
    this.datos.recordatorios = this.datos.recordatorios.filter((r) => r.id !== id);
    this.#guardar(this.rutaCache, this.datos);
    if (id > 0) await this.#enviarOEncolar('DELETE', `/recordatorios/${id}`);
  }

  async registrar(origen, origenId, fecha, hora, estado) {
    if (origen === 'recordatorio' && estado !== 'anunciado') {
      const r = this.datos.recordatorios.find((x) => x.id === origenId);
      if (r && r.repeticion === 'una_vez') r.activo = false;
    }
    if (origenId > 0) await this.#enviarOEncolar('POST', '/registros', { origen, origenId, fecha, hora, estado }).catch(() => {});
  }

  async fijarVolumen(volumen) {
    this.datos.configuracion.volumen = volumen;
    this.#guardar(this.rutaCache, this.datos);
    await this.#enviarOEncolar('PUT', '/configuracion', { volumen }).catch(() => {});
  }

  async marcarMensajeEscuchado(id) {
    this.datos.mensajes = this.datos.mensajes.filter((m) => m.id !== id);
    await this.#enviarOEncolar('POST', `/mensajes/${id}/escuchado`).catch(() => {});
  }

  async enviarEstado(estado) {
    try { await this.#llamar('POST', '/estado', estado); } catch { /* se reporta en la siguiente vuelta */ }
  }

  async enviarDiagnostico(eventos) {
    if (!eventos.length) return true;
    try { await this.#llamar('POST', '/diagnostico', { eventos }); return true; } catch { return false; }
  }
}
